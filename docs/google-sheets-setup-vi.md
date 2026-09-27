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
- `App_Timetable`
- `App_TimetableSettings`
- `App_Users`
- `App_Subjects`
- `App_Students`
- `App_StudentSubjects`
- `App_Lessons`

Nếu sheet chưa có dữ liệu, dữ liệu hiện có trong localStorage sẽ được tải lên lần đầu. Nếu sheet đã có dữ liệu, dữ liệu trên sheet được ưu tiên và ghi đè bản đệm local.

`localStorage` vẫn giữ một bản đệm riêng cho từng tài khoản để ứng dụng có thể mở khi mất mạng. Mọi thay đổi mới được lưu vào bản đệm trước, sau đó xếp hàng đồng bộ lên Google Sheet.

Các tab dữ liệu có thêm cột `userId`. Khi tài khoản đăng nhập, Apps Script chỉ tải và cập nhật các dòng có đúng `userId` đó; học sinh, môn học, buổi dạy và học phí giữa các tài khoản không bị trộn lẫn. Dữ liệu cũ chưa có `userId` sẽ được gán cho tài khoản đầu tiên khi Sheet vẫn chỉ có một tài khoản.

## Thông tin chuyển khoản theo tài khoản

Tab `App_Users` giữ các cột A:F hiện tại và bổ sung bốn cột G:J:

| Cột | Tên | Nội dung |
| --- | --- | --- |
| G | `bankName` | Tên ngân hàng, ví dụ `MB BANK` |
| H | `bankAccountName` | Tên chủ tài khoản, ví dụ `DANG VU KHA` |
| I | `bankAccountNumber` | Số tài khoản, định dạng văn bản để giữ số 0 đầu |
| J | `bankQrImage` | Đường dẫn ảnh trong `public`, ví dụ `/dang-vu-kha-qr.png` |

Quy tắc áp dụng cho cả tài khoản hiện có và tài khoản đăng ký mới:

- Chỉ `khadang2004cm@gmail.com` dùng MB BANK, DANG VU KHA, `20402023979`, ảnh `/dang-vu-kha-qr.png`.
- Tất cả tài khoản còn lại dùng TECHCOMBANK, DANH MINH HIEU, `8804040202`, ảnh `/danh-minh-hieu-qr.png`.

Khi nâng cấp, cập nhật Apps Script từ `google-apps-script/Code.gs`, cập nhật bản
triển khai Web App hiện có bằng phiên bản mới (giữ nguyên URL `/exec`), rồi chạy
`setupBankAccounts`. Hàm này ghi cấu hình theo quy tắc trên vào G:J của mọi tài
khoản hiện có, giữ nguyên dữ liệu đăng nhập. Đăng ký mới tự điền ngân hàng theo
cùng quy tắc. Có thể chạy lại để đồng bộ các dòng đã có.

Ứng dụng xác minh tài khoản từ Sheet mỗi lần mở phiếu và chọn trọn bộ thông tin
chuyển khoản theo email, không dùng cấu hình khác trong Sheet để thay đổi quy
tắc này. Nếu tải tài khoản thất bại, nút xuất bị khóa và hiển thị lỗi để thử lại.
Chế độ dùng trên máy không đăng nhập cũng dùng thông tin Danh Minh Hiếu.

## Thời khóa biểu hằng tuần

Mục **Lịch tuần** lưu các ca lặp lại từ Thứ 2 đến Chủ nhật. Mỗi ca có giờ bắt đầu,
giờ kết thúc, môn/lớp, học sinh hoặc nhóm học, hình thức học, màu và ghi chú.
Có thể chọn nhiều ngày khi thêm mới; sửa/xóa áp dụng cho từng ca. Các ca trùng
giờ trong cùng ngày được báo lỗi; hai ca nối tiếp nhau được phép.

`App_Timetable` dùng các cột `id`, `dayOfWeek` (1 = Thứ 2, 7 = Chủ nhật),
`startTime`, `endTime`, `title`, `studentName`, `mode`, `color`, `note`,
`createdAt`, `updatedAt`, `userId`. `App_TimetableSettings` chứa `id`, `title`,
`userId` để lưu tiêu đề riêng cho từng tài khoản. Giờ lưu dưới dạng văn bản
`HH:mm`. Lịch tuần không tự tạo buổi dạy hoặc cộng vào học phí.

Sau khi cập nhật và triển khai Apps Script, chạy `setupTimetable` để tạo hai tab
còn thiếu; hàm giữ nguyên tab đã có. Các phiên bản ứng dụng cũ không gửi trường
lịch tuần sẽ không xóa lịch khi đồng bộ. Bản sao lưu cũ vẫn đọc được, lịch tuần
ban đầu là rỗng. Backup mới bao gồm cả lịch và tiêu đề.

Trong **Lịch tuần**, chạm vào một ô có lịch để chỉnh sửa ca học. Lịch mới được lưu
tạm trên thiết bị trước rồi đồng bộ Sheet theo trạng thái hiển thị của ứng dụng.

## Lưu ý bảo mật

Google Sheet phù hợp với ứng dụng cá nhân hoặc quy mô nhỏ, nhưng không nên xem là cơ sở dữ liệu có phân quyền mạnh. Hạn chế chia sẻ sheet, không đưa các biến trong `.env.local` lên Git, và nên sao lưu sheet định kỳ. Nếu cần nhiều gia sư, phân quyền theo người dùng hoặc dữ liệu nhạy cảm hơn, nên chuyển phần đăng nhập sang dịch vụ xác thực và database chuyên dụng.
