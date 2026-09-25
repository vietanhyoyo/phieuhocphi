# Kết nối Google Sheet

Ứng dụng đã hỗ trợ đồng bộ dữ liệu với sheet:

`https://docs.google.com/spreadsheets/d/1zBAWSnDb0h1oLsTkJzgclUXHtUrcG8FSIQ32NJ1jiDI/edit`

## 1. Tạo Apps Script cho sheet

1. Mở sheet, chọn `Extensions > Apps Script`.
2. Xóa nội dung file mặc định và dán toàn bộ file `google-apps-script/Code.gs`.
3. Vào `Project Settings > Script properties`, tạo hai thuộc tính:

   - `TUTOR_SYNC_SECRET`: một chuỗi bí mật dài, khó đoán.
   - `SPREADSHEET_ID`: `1zBAWSnDb0h1oLsTkJzgclUXHtUrcG8FSIQ32NJ1jiDI`.

4. Chọn `Deploy > New deployment > Web app`.
5. Chọn `Execute as: Me` và quyền truy cập `Anyone`.
6. Sao chép URL kết thúc bằng `/exec`.

`Anyone` ở bước 5 không có nghĩa là ai cũng ghi được dữ liệu. Apps Script vẫn kiểm tra `TUTOR_SYNC_SECRET`; URL này chỉ nên được gọi qua ứng dụng.

## 2. Cấu hình Next.js

Tạo file `.env.local` ở thư mục gốc:

```env
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
GOOGLE_SHEETS_SYNC_SECRET=đúng_chuỗi_TUTOR_SYNC_SECRET
GOOGLE_SHEET_ID=1zBAWSnDb0h1oLsTkJzgclUXHtUrcG8FSIQ32NJ1jiDI
AUTH_SECRET=một_chuỗi_bí_mật_khác_dài_tối_thiểu_32_ký_tự
```

`AUTH_SECRET` bật màn hình đăng nhập. Người dùng có thể đăng ký nhiều tài khoản và đăng nhập bằng tài khoản của mình. Ứng dụng chỉ lưu username, password hash và salt trong tab `App_Users`; không lưu mật khẩu rõ.

Sau khi tạo hoặc đổi `.env.local`, khởi động lại Next.js:

```bash
npm run dev
```

## 3. Dữ liệu được lưu ở đâu

Lần đồng bộ đầu tiên, Apps Script tự tạo các tab:

- `App_Meta`
- `App_Users`
- `App_Subjects`
- `App_Students`
- `App_StudentSubjects`
- `App_Lessons`

Nếu sheet chưa có dữ liệu, dữ liệu hiện có trong localStorage sẽ được tải lên lần đầu. Nếu sheet đã có dữ liệu, dữ liệu trên sheet được ưu tiên và ghi đè bản đệm local.

`localStorage` vẫn giữ một bản đệm riêng cho từng tài khoản để ứng dụng có thể mở khi mất mạng. Mọi thay đổi mới được lưu vào bản đệm trước, sau đó xếp hàng đồng bộ lên Google Sheet.

Các tab dữ liệu có thêm cột `userId`. Khi tài khoản đăng nhập, Apps Script chỉ tải và cập nhật các dòng có đúng `userId` đó; học sinh, môn học, buổi dạy và học phí giữa các tài khoản không bị trộn lẫn. Dữ liệu cũ chưa có `userId` sẽ được gán cho tài khoản đầu tiên khi Sheet vẫn chỉ có một tài khoản.

## Lưu ý bảo mật

Google Sheet phù hợp với ứng dụng cá nhân hoặc quy mô nhỏ, nhưng không nên xem là cơ sở dữ liệu có phân quyền mạnh. Hạn chế chia sẻ sheet, không đưa các biến trong `.env.local` lên Git, và nên sao lưu sheet định kỳ. Nếu cần nhiều gia sư, phân quyền theo người dùng hoặc dữ liệu nhạy cảm hơn, nên chuyển phần đăng nhập sang dịch vụ xác thực và database chuyên dụng.
