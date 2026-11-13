# Cơ chế lưu dữ liệu với Google Sheet

Nguyên tắc: **lưu trên máy trước, đồng bộ lên Google Sheet sau**. Người dùng không bao giờ phải chờ mạng để thao tác; mất mạng hay lưu lỗi thì thay đổi vẫn nằm trên máy và được gửi lại khi có thể.

## 1. Nơi lưu

### Google Sheet

Sheet: `https://docs.google.com/spreadsheets/d/1zBAWSnDb0h1oLsTkJzgclUXHtUrcG8FSIQ32NJ1jiDI/edit` (đổi bằng `GOOGLE_SHEET_ID`). Mỗi loại dữ liệu là một tab; dòng 1 là tiêu đề cột; mọi tài khoản dùng chung tab, phân biệt bằng cột `userId`.

| Tab | Cột |
|---|---|
| `App_Users` | id, username, passwordHash, passwordSalt, createdAt, updatedAt, bankName, bankAccountName, bankAccountNumber, bankQrImage |
| `App_Subjects` | id, name, active, createdAt, updatedAt, userId |
| `App_Students` | id, name, phone, parentName, parentPhone, note, active, createdAt, updatedAt, userId |
| `App_StudentSubjects` | id, studentId, subjectId, defaultFee, defaultDurationMinutes, active, createdAt, updatedAt, userId |
| `App_Lessons` | id, studentId, subjectId, lessonDate, startTime, durationMinutes, fee, note, createdAt, updatedAt, userId, paid |
| `App_Timetable` | id, dayOfWeek, startTime, endTime, title, studentName, mode, color, note, createdAt, updatedAt, userId |
| `App_TimetableSettings` | id, title, userId |
| `App_Meta` | key, value (`version`, `updatedAt`) |

Tab chưa có sẽ được tự tạo khi ghi lần đầu. Không đổi tên tab, không chèn hoặc đổi thứ tự cột: code đọc theo vị trí cột (cột `paid` cố ý nằm cuối `App_Lessons` để Sheet cũ vẫn đọc được).

Giá trị được ghi đúng kiểu: chữ là chữ (ngày `2026-11-02`, giờ `18:00`, số điện thoại `0912…` không bị Sheets tự đổi), số là số, đúng/sai là `TRUE/FALSE`. Dữ liệu cũ do Apps Script ghi dưới dạng ô ngày giờ vẫn được đọc đúng.

### Trên trình duyệt (`localStorage`)

| Khoá | Nội dung |
|---|---|
| `tutor-manager:data:<userId>` | Bản dữ liệu đang hiển thị (bản đệm để mở app khi mất mạng). |
| `tutor-manager:data:pending:<userId>` | **Hàng chờ đồng bộ**: bản dữ liệu mới nhất chưa được server xác nhận, kèm mã `revision`. |
| `tutor-manager:data:synced:<userId>` | **Bản đồng bộ gần nhất**: dữ liệu mà máy này và server đã thống nhất lần cuối. Là mốc để tính "cái gì đã thay đổi". |
| `tutor-manager:last-account` | Tài khoản đăng nhập gần nhất (để mở app khi mất mạng). |

## 2. Hai cách server nói chuyện với Google

`lib/server-sheets.ts` → `callSheets()` tự chọn:

1. **Google Sheets API bằng service account** (khi có `GOOGLE_SERVICE_ACCOUNT_EMAIL` và `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`) — nhanh, dùng mặc định.
   - Server tự ký JWT bằng private key, đổi lấy access token (cache ~1 giờ).
   - Thông tin cấu trúc Sheet (tên tab, số dòng/cột, múi giờ) được cache 5 phút và xoá cache ngay khi số dòng/cột thay đổi.
   - Đọc: một request `values:batchGet` lấy mọi tab cần thiết.
   - Ghi: một request `spreadsheets:batchUpdate` **nguyên khối** (hoặc tất cả thay đổi được áp dụng, hoặc không gì cả).
2. **Apps Script** (`google-apps-script/Code.gs`, cần `GOOGLE_APPS_SCRIPT_URL` + `GOOGLE_SHEETS_SYNC_SECRET`) — dự phòng, chậm hơn nhiều (mỗi lần gọi ~2 giây khởi động). Apps Script chỉ lưu được cả bản dữ liệu, nên khi nhận phần thay đổi, server tải dữ liệu về, áp thay đổi, rồi lưu lại.

Hai cách đọc/ghi cùng định dạng bảng, chuyển qua lại không mất dữ liệu.

## 3. Lưu một thay đổi

Ví dụ: sửa ghi chú một buổi học.

1. `useAppStore.updateData()` cập nhật giao diện ngay, ghi `tutor-manager:data:<userId>` và đặt bản mới vào **hàng chờ** (`pending`).
2. Hàng chờ (chạy tuần tự, không bao giờ 2 lần lưu song song) tính phần thay đổi bằng `diffData(bản đồng bộ gần nhất, bản trong hàng chờ)` (`lib/change-set.ts`):
   - bản ghi mới hoặc có nội dung khác → `upsert` (gửi nguyên bản ghi);
   - bản ghi có trong bản đồng bộ nhưng không còn → `delete` (gửi `id`).
   - Không có gì thay đổi thì không gửi request.
3. Trình duyệt gửi `POST /api/sheets` với `{ changes, accountId }` — thường chỉ vài trăm byte.
4. Server (`applyChanges` trong `lib/sheets-store.ts`), trong khoá ghi của tiến trình:
   - đọc các tab liên quan một lần;
   - tìm dòng theo **`id` + `userId` của phiên** (không bao giờ đụng dòng của tài khoản khác);
   - bản ghi đã có → ghi đè đúng dòng đó; bản ghi mới → thêm cuối bảng; bản ghi bị xoá → xoá dòng (từ dưới lên để không lệch số dòng); dòng trùng `id` dư thừa → xoá;
   - gửi tất cả trong một `batchUpdate` nguyên khối.
5. Thành công → máy lưu bản vừa gửi làm **bản đồng bộ gần nhất** và xoá khỏi hàng chờ (chỉ khi `revision` chưa đổi, tức người dùng chưa sửa thêm trong lúc gửi; nếu đã sửa thêm thì lần lưu kế tiếp gửi tiếp phần còn lại).

Gửi lại nhiều lần cùng một thay đổi cho kết quả như nhau (không tạo dòng trùng), nên thử lại khi lỗi luôn an toàn.

## 4. Tải dữ liệu và gộp giữa nhiều máy

`GET /api/sheets` đọc mọi tab của tài khoản trong một request và trả về `AppData` (`null` nếu tài khoản chưa có dữ liệu).

Trình duyệt gộp 3 chiều (`reconcileData` trong `lib/sync-queue.ts`) giữa **bản trên máy (L)**, **bản trên server (R)** và **bản đồng bộ gần nhất (B)**, so từng bản ghi theo `id`, dùng `updatedAt` để biết bên nào đã sửa:

| Tình huống | Kết quả |
|---|---|
| Có ở L và R, chỉ một bên sửa so với B | Lấy bản của bên đã sửa |
| Có ở L và R, cả hai bên cùng sửa | Lấy bản có `updatedAt` mới hơn |
| Có ở L, không có ở R, L chưa sửa so với B | **Máy khác đã xoá → bỏ** |
| Có ở L, không có ở R, L mới tạo hoặc đã sửa | Giữ (sửa thắng xoá, tránh mất dữ liệu) |
| Có ở R, không có ở L, R chưa sửa so với B | **Máy này đã xoá → bỏ** |
| Có ở R, không có ở L, R mới hoặc đã sửa | Giữ |
| Server trả về rỗng (`null`) | Giữ nguyên dữ liệu trên máy (không coi là "đã xoá hết") |

Tiêu đề thời khóa biểu theo bên đã đổi. Sau khi gộp, bản server vừa đọc trở thành bản đồng bộ gần nhất; nếu máy còn thay đổi chưa có trên server thì chúng được đưa vào hàng chờ và gửi đi như mục 3.

**Khi nào trang tự tải lại:** lúc mở app, khi cửa sổ được bấm vào (`focus`), khi chuyển lại tab, khi trang được mở lại từ bộ nhớ đệm, khi có mạng trở lại, và mỗi 30 giây khi đang mở. Việc tải lại chạy ngầm, không hiện "Đang tải dữ liệu…" nếu dữ liệu đã đồng bộ.

Nhiều tab cùng trình duyệt dùng chung `localStorage`; tab này nhận thay đổi của tab kia ngay qua sự kiện `storage`.

## 5. Mất mạng và lỗi

- Mọi thay đổi vẫn được lưu trên máy; trạng thái chuyển sang "Đang lưu tạm trên thiết bị" và hiện một thông báo lỗi (một lần).
- Hàng chờ được thử lại khi có mạng, khi quay lại trang và khoảng mỗi 10 giây khi còn thay đổi chưa gửi được. Tải lại trang không làm mất hàng chờ.
- Server lỗi giữa chừng không làm hỏng Sheet vì lần ghi là nguyên khối.

## 6. Giới hạn đã biết

- **Khoá ghi chỉ trong một tiến trình server.** Trên Vercel có thể có nhiều tiến trình chạy cùng lúc; nếu hai lần ghi vào cùng một tab xảy ra đúng cùng lúc (khoảng dưới 1 giây) thì có rủi ro nhỏ lệch số dòng. Lần ghi bị lỗi sẽ được thử lại từ đầu với dữ liệu mới.
- **Không cập nhật tức thì:** máy khác chỉ thấy thay đổi khi trang tự tải lại (bấm vào trang hoặc tối đa ~30 giây).
- **Tab còn chạy bản app cũ** gửi cả bản dữ liệu (`{ data }`); server vẫn nhận để không lỗi, nhưng kiểu gửi này có thể làm sống lại bản ghi đã xoá. Sau mỗi lần deploy nên tải lại app trên mọi máy.
- Quota Google Sheets API miễn phí: khoảng 300 lượt đọc và 300 lượt ghi mỗi phút cho mỗi project. Vượt quota chỉ bị từ chối tạm thời (lỗi 429), không tốn tiền; hàng chờ sẽ gửi lại sau.

## 7. Cài đặt

### Cách khuyến nghị: Google Sheets API (service account) — miễn phí, không cần thẻ

1. Vào thẳng <https://console.cloud.google.com/projectcreate> (không bấm "Get started for free" ở trang giới thiệu, nút đó mới đòi thẻ), tạo project.
2. Bật **Google Sheets API**: <https://console.cloud.google.com/apis/library/sheets.googleapis.com>.
3. Tạo service account: <https://console.cloud.google.com/iam-admin/serviceaccounts/create> (bỏ qua bước cấp quyền).
4. Mở service account → **Keys → Add key → Create new key → JSON**.
5. Mở Google Sheet → **Share** → dán `client_email` → quyền **Editor**.
6. Thêm vào `.env.local` (và **Vercel → Settings → Environment Variables**, rồi **Redeploy**):

   ```env
   GOOGLE_SERVICE_ACCOUNT_EMAIL=giá_trị_client_email
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="giá_trị_private_key"
   AUTH_SECRET=chuỗi_bí_mật_dài_tối_thiểu_32_ký_tự
   ```

Kiểm tra nhanh trên server đã deploy: mở `https://<tên-miền>/api/auth` khi chưa đăng nhập. Kết quả `HTTP 200` và `"hasUsers": true` là kết nối được; có `message` báo lỗi là chưa.

### Cách cũ: Apps Script

1. Mở Sheet → **Extensions → Apps Script**, dán toàn bộ `google-apps-script/Code.gs`.
2. **Project Settings → Script properties**: thêm `TUTOR_SYNC_SECRET` (chuỗi bí mật) và `SPREADSHEET_ID`.
3. **Deploy → New deployment → Web app**, `Execute as: Me`, quyền `Anyone`. Mỗi lần sửa `Code.gs` phải **Deploy → Manage deployments → Edit → New version**.
4. Đặt `GOOGLE_APPS_SCRIPT_URL` (URL `/exec`) và `GOOGLE_SHEETS_SYNC_SECRET` (đúng `TUTOR_SYNC_SECRET`). Nếu đã có service account thì Apps Script không được dùng.
