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

1. Mở Google Sheet và tạo Apps Script từ file [`google-apps-script/Code.gs`](./google-apps-script/Code.gs).
2. Triển khai Apps Script dưới dạng Web App, quyền truy cập **Anyone**.
3. Điền URL triển khai, mã bí mật và `AUTH_SECRET` vào `.env.local`.

Khi cập nhật `Code.gs`, hãy triển khai phiên bản Web App mới để các chức năng tài khoản, gồm đổi mật khẩu, hoạt động với mã mới.

Xem hướng dẫn chi tiết tại [`docs/google-sheets-setup-vi.md`](./docs/google-sheets-setup-vi.md).

## Chức năng chính

- Đăng ký, đăng nhập và đăng xuất nhiều tài khoản.
- Quản lý học sinh, môn học, buổi dạy và học phí.
- Dữ liệu được phân tách theo tài khoản bằng `userId`.
- Hỗ trợ backup/restore và lưu đệm offline.

Không đưa `.env.local` hoặc các mã bí mật lên Git.
