# Sổ học phí

Ứng dụng quản lý học sinh, môn học, lịch dạy và học phí bằng Next.js. Dữ liệu được lưu theo từng tài khoản và đồng bộ với Google Sheets.

## Chạy ứng dụng

```bash
npm install
cp .env.example .env.local
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Cấu hình Google Sheets

**Khuyến nghị: Google Sheets API (service account)** — nhanh hơn Apps Script nhiều lần. Tạo service account, chia sẻ Sheet cho email của nó với quyền Editor, rồi điền `GOOGLE_SERVICE_ACCOUNT_EMAIL` và `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` vào `.env.local`. Khi hai biến này có giá trị, app gọi thẳng Sheets API và bỏ qua Apps Script.

**Cách cũ: Apps Script** (dùng khi chưa có service account):

1. Mở Google Sheet và tạo Apps Script từ file [`google-apps-script/Code.gs`](./google-apps-script/Code.gs).
2. Triển khai Apps Script dưới dạng Web App, quyền truy cập **Anyone**.
3. Điền URL triển khai, mã bí mật và `AUTH_SECRET` vào `.env.local`.

Khi cập nhật `Code.gs`, hãy triển khai phiên bản Web App mới để các thay đổi đồng bộ, gồm trạng thái đã thu học phí của buổi dạy, hoạt động với mã mới. Lần ghi dữ liệu tiếp theo sẽ tự thêm cột `paid` vào cuối bảng `App_Lessons`; các buổi cũ mặc định là chưa thu tiền.

Tài liệu:

- [`docs/kien-truc.md`](./docs/kien-truc.md) — kiến trúc mã nguồn.
- [`docs/luu-du-lieu-google-sheet.md`](./docs/luu-du-lieu-google-sheet.md) — cơ chế lưu và đồng bộ dữ liệu với Google Sheet, cách cài đặt.
- [`docs/test-tai-khoan-vietanh.md`](./docs/test-tai-khoan-vietanh.md) — test bằng tài khoản `vietanh`.

## Chức năng chính

- Đăng ký, đăng nhập và đăng xuất nhiều tài khoản.
- Quản lý học sinh, môn học, buổi dạy và học phí.
- Quản lý thời khóa biểu hằng tuần theo khung giờ, thêm ca vào nhiều ngày, màu riêng, trực tiếp/online, kiểm tra trùng giờ và xuất PNG.
- Dữ liệu được phân tách theo tài khoản bằng `userId`.
- Hỗ trợ backup/restore và lưu đệm offline.

Không đưa `.env.local` hoặc các mã bí mật lên Git.
