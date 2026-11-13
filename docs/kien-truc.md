# Kiến trúc mã nguồn

Sổ học phí là ứng dụng Next.js 15 (App Router, React 19, TypeScript, Tailwind) giúp gia sư quản lý học sinh, buổi dạy, học phí và thời khóa biểu. Dữ liệu của từng tài khoản được lưu trên trình duyệt trước, rồi đồng bộ với Google Sheet thông qua API của chính ứng dụng.

```
Trình duyệt (React)                     Server Next.js (Vercel)                 Google
┌─────────────────────────┐   fetch     ┌───────────────────────────┐  HTTPS  ┌──────────────────┐
│ app/page.tsx            │ ──────────▶ │ app/api/auth              │ ──────▶ │ Google Sheets API│
│ hooks/useAppStore.ts    │ /api/sheets │ app/api/sheets            │         │ (service account)│
│ localStorage (bản đệm,  │ /api/auth   │ app/api/payment           │         ├──────────────────┤
│ hàng chờ đồng bộ)       │ ◀────────── │ lib/server-sheets.ts      │ ──────▶ │ Apps Script      │
└─────────────────────────┘    JSON     │ lib/sheets-store.ts       │ dự phòng│ (Code.gs)        │
                                        └───────────────────────────┘         └──────────────────┘
```

## Thư mục

| Đường dẫn | Vai trò |
|---|---|
| `app/page.tsx` | Trang duy nhất của app: kiểm tra đăng nhập, chọn màn hình đang mở, hiển thị modal, thông báo và trạng thái đồng bộ. |
| `app/layout.tsx`, `app/globals.css` | Khung HTML, font, CSS chung. |
| `app/api/auth/route.ts` | Đăng nhập, đăng ký, đổi mật khẩu, đăng xuất. |
| `app/api/sheets/route.ts` | `GET` tải dữ liệu của tài khoản; `POST` lưu phần thay đổi (hoặc cả bản dữ liệu từ bản app cũ). |
| `app/api/payment/route.ts` | Trả thông tin chuyển khoản/QR in trên phiếu học phí của tài khoản. |
| `hooks/useAppStore.ts` | Bộ não phía trình duyệt: giữ state, mọi thao tác thêm/sửa/xoá, hàng chờ đồng bộ, tự tải lại dữ liệu. |
| `components/views/*` | Các màn hình: `HomeView`, `LessonsView`, `StudentsView`, `StudentDetail`, `TuitionView`, `TimetableView`, `SettingsView`, `ReceiptPreview`, `AuthView`. |
| `components/modals/*` | Form thêm/sửa học sinh, môn học, buổi dạy, ca thời khóa biểu, xác nhận xoá, đổi mật khẩu. |
| `components/shared/*`, `components/ui/*`, `components/layout/*` | Thành phần dùng chung (chọn ngày/giờ/tháng tiếng Việt, lưới thời khóa biểu, nút, input, header, thanh điều hướng dưới). |
| `lib/types.ts` | Kiểu dữ liệu: `AppData`, `Subject`, `Student`, `StudentSubject`, `Lesson`, `TimetableEntry`, `AuthUser`… |
| `lib/storage.ts` | Đọc/ghi bản đệm trong `localStorage`, chuẩn hoá dữ liệu, kiểm tra hợp lệ, sao lưu ra file JSON. |
| `lib/sync-queue.ts` | Hàng chờ đồng bộ, bản đồng bộ gần nhất, gộp dữ liệu 3 chiều giữa máy và server. |
| `lib/change-set.ts` | Tính phần thay đổi (thêm/sửa/xoá) giữa hai bản dữ liệu; dùng chung cho trình duyệt và server. |
| `lib/cloud-storage.ts` | Hàm gọi `/api/sheets` từ trình duyệt. |
| `lib/account-cache.ts` | Nhớ tài khoản đăng nhập gần nhất để mở app khi mất mạng. |
| `lib/server-auth.ts` | Băm mật khẩu (PBKDF2), cookie phiên ký HMAC. |
| `lib/server-sheets.ts` | Chọn nơi lưu (Sheets API hoặc Apps Script) và cài đặt cách ghi xuống Sheet. |
| `lib/sheets-store.ts` | Logic bảng dữ liệu phía server: đọc, ghi, tạo tài khoản, đổi mật khẩu, áp dụng thay đổi theo từng dòng. |
| `lib/google-sheets-api.ts` | Client REST tối giản cho Google Sheets API, tự ký JWT của service account. |
| `lib/utils.ts`, `lib/timetable.ts` | Định dạng tiền/ngày, thống kê theo tháng, lọc buổi dạy, kiểm tra trùng giờ thời khóa biểu. |
| `lib/receipt-export.ts`, `lib/receipt-payment.ts` | Xuất phiếu học phí ra ảnh PNG; thông tin chuyển khoản theo tài khoản. |
| `google-apps-script/Code.gs` | Backend dự phòng chạy trên Apps Script, cùng định dạng bảng với `sheets-store.ts`. |
| `tests/*.test.cjs` | Test chạy bằng `node --test` (`npm test`). |

## Mô hình dữ liệu

Mỗi tài khoản có một `AppData`:

```ts
{
  version: number;
  subjects: Subject[];               // môn học
  students: Student[];               // học sinh
  studentSubjects: StudentSubject[]; // học sinh học môn nào, học phí & thời lượng mặc định
  lessons: Lesson[];                 // buổi dạy: ngày, giờ, thời lượng, học phí, đã thu chưa
  timetable: TimetableEntry[];       // các ca trong thời khóa biểu tuần
  timetableTitle: string;
}
```

Mọi bản ghi có `id` (chuỗi duy nhất, ví dụ `lesson-<uuid>`), `createdAt` và `updatedAt` (ISO). **Mỗi thao tác sửa đều cập nhật `updatedAt`**; cơ chế đồng bộ dựa vào trường này để biết bản ghi nào đã thay đổi.

## Luồng chạy chính

1. **Mở app** — `app/page.tsx` gọi `GET /api/auth`. Có cookie phiên hợp lệ thì trả kết quả ngay (không gọi Google). Mất mạng thì dùng tài khoản đã nhớ trong `account-cache`.
2. **Tải dữ liệu** — `useAppStore` hiện ngay bản đệm trong `localStorage`, sau đó gọi `GET /api/sheets` và gộp với dữ liệu server.
3. **Thao tác** — mọi thay đổi đi qua `updateData()`: lưu vào `localStorage`, đưa vào hàng chờ, rồi gửi phần thay đổi lên `POST /api/sheets` ở chế độ nền. Giao diện không phải chờ.
4. **Server** — route kiểm tra phiên và tài khoản, rồi `callSheets()` gọi Google Sheets API (hoặc Apps Script nếu chưa cấu hình service account).
5. **Đồng bộ giữa các máy** — trang tự tải lại khi được bấm vào/chuyển tab/có mạng lại và mỗi 30 giây.

Chi tiết lưu trữ và đồng bộ: xem [luu-du-lieu-google-sheet.md](./luu-du-lieu-google-sheet.md).

## Đăng nhập và bảo mật

- Mật khẩu băm bằng PBKDF2-SHA256, 310.000 vòng, salt ngẫu nhiên; Sheet chỉ lưu `passwordHash` và `passwordSalt`.
- Cookie `tutor_session` (httpOnly, 30 ngày) chứa `id`, `username`, hạn dùng, ký HMAC bằng `AUTH_SECRET`. Đổi `AUTH_SECRET` sẽ đăng xuất tất cả mọi người.
- Mọi route kiểm tra phiên; `POST /api/sheets` còn kiểm tra `accountId` gửi lên phải trùng tài khoản trong phiên. Server luôn tự gán `userId` từ phiên, trình duyệt không tự chọn được tài khoản.
- Key service account và các bí mật chỉ nằm trong biến môi trường server, không bao giờ gửi xuống trình duyệt.

## Biến môi trường

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Khuyến nghị | Email service account (`client_email` trong file JSON). |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Khuyến nghị | `private_key` trong file JSON; dán dạng nào cũng được (có/không ngoặc, `\n`, xuống dòng thật, cả file JSON). |
| `GOOGLE_SHEET_ID` | Không | ID Google Sheet; mặc định là Sheet của dự án. |
| `GOOGLE_APPS_SCRIPT_URL`, `GOOGLE_SHEETS_SYNC_SECRET` | Không | Chỉ dùng khi không có service account (backend Apps Script). |
| `AUTH_SECRET` | Có (để bật đăng nhập) | Khoá ký cookie phiên, tối thiểu 32 ký tự. |

## Chạy, test, deploy

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # node --test tests/*.test.cjs
npm run build
```

Deploy: push lên nhánh `main` của GitHub, Vercel tự build và deploy production. Biến môi trường production đặt trong **Vercel → Settings → Environment Variables**; đổi biến xong cần **Redeploy**.
