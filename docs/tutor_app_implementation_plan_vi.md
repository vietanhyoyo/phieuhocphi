# Kế hoạch triển khai ứng dụng quản lý buổi dạy và học phí gia sư

## 1. Mục tiêu dự án

Xây dựng một ứng dụng web mobile-first dành cho gia sư, tập trung vào các tác vụ chính:

- Quản lý môn học.
- Quản lý học sinh.
- Điểm danh / tạo một buổi dạy khi buổi học thực tế diễn ra.
- Quản lý các buổi đã dạy.
- Lưu học phí riêng cho từng buổi.
- Tổng hợp học phí theo tháng cho từng học sinh.
- Từ dữ liệu tổng hợp tháng, tạo phiếu học phí.
- Xem trước phiếu học phí.
- Xuất phiếu học phí dưới dạng PNG.
- Backup / Restore toàn bộ dữ liệu.

Ứng dụng **không cần tạo lịch dạy trước**, không có lịch lặp hàng tuần và không tự động điểm danh theo thời gian.

---

## 2. Công nghệ sử dụng

- **Next.js** với App Router
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **Lucide Icons**
- **localStorage** để lưu dữ liệu
- **Zod** cho validation khi cần
- **React Hook Form** cho form khi cần

### Yêu cầu giao diện

- Thiết kế **mobile-first**.
- Chiều rộng chính tối ưu cho điện thoại, tối đa khoảng `430px` trên màn hình lớn.
- Trên desktop, hiển thị giao diện điện thoại ở giữa màn hình, không chuyển thành dashboard desktop.
- Màu chủ đạo:

```css
oklch(58.8% 0.158 241.966)
```

- Ưu tiên sử dụng component của shadcn/ui.
- Các form trên mobile nên ưu tiên `Drawer` / bottom sheet khi phù hợp.
- Nút thao tác chính phải có vùng bấm lớn, dễ thao tác bằng ngón tay.

---

## 3. Quy tắc nghiệp vụ cốt lõi

### 3.1 Không tạo lịch dạy trước

Không tạo lịch tuần, lịch lặp hoặc các buổi học tương lai.

Một buổi học chỉ tồn tại khi gia sư chủ động tạo bản ghi vào thời điểm buổi dạy thực tế diễn ra.

### 3.2 Buổi dạy chính là bản ghi điểm danh

Không cần entity `Attendance` riêng trong MVP.

Nếu có một `Lesson` record thì được hiểu là:

```text
Buổi học đã diễn ra và được tính vào học phí.
```

### 3.3 Học phí phải được lưu snapshot theo từng buổi

Khi tạo buổi dạy, lấy mức học phí mặc định hiện tại của môn đó đối với học sinh và copy vào `Lesson.fee`.

Nếu mức học phí mặc định thay đổi sau này, các buổi cũ không được thay đổi theo.

Tổng học phí tháng phải được tính bằng:

```text
sum(lesson.fee)
```

Không dùng học phí hiện tại nhân với số buổi làm nguồn dữ liệu chính.

### 3.4 Quản lý môn học nằm trong Cài đặt

Môn học được quản lý tại:

```text
Cài đặt > Môn học
```

Khi khởi tạo ứng dụng phải có sẵn một môn mặc định:

```text
Toán
```

---

## 4. Điều hướng chính

Bottom navigation đề xuất:

1. **Trang chủ**
2. **Buổi dạy**
3. **Học sinh**
4. **Học phí**

Trang **Cài đặt** mở từ icon bánh răng ở header.

Action quan trọng nhất của toàn bộ ứng dụng:

```text
+ Điểm danh / Tạo buổi dạy
```

Nút này phải xuất hiện nổi bật ở Trang chủ.

---

# 5. Chức năng 1 — Quản lý môn học

## Vị trí

```text
Cài đặt > Môn học
```

## Yêu cầu

- Hiển thị danh sách môn học.
- Thêm môn học.
- Đổi tên môn học.
- Bật / tắt trạng thái hoạt động.
- Không xóa cứng một môn nếu môn đó đã được sử dụng trong lịch sử các buổi dạy.
- Với môn đã được sử dụng, ưu tiên `deactivate` thay vì xóa.
- Dữ liệu mặc định phải có môn:

```text
Toán
```

## Data model đề xuất

```ts
interface Subject {
  id: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
}
```

---

# 6. Chức năng 2 — Quản lý học sinh

## Yêu cầu

- Danh sách học sinh.
- Thêm học sinh.
- Sửa học sinh.
- Cho học sinh ngừng hoạt động / nghỉ học.
- Xem chi tiết học sinh.
- Xem lịch sử các buổi đã học.
- Xem tổng hợp học phí theo tháng của học sinh.

## Thông tin học sinh

```ts
interface Student {
  id: string
  name: string
  phone?: string
  parentName?: string
  parentPhone?: string
  note?: string
  active: boolean
  createdAt: string
  updatedAt: string
}
```

## Cấu hình môn học theo từng học sinh

Một học sinh có thể học một hoặc nhiều môn.

Mỗi cặp `Học sinh + Môn học` phải lưu:

- Học phí mặc định / buổi.
- Thời lượng mặc định.
- Trạng thái đang học môn đó hay không.

```ts
interface StudentSubject {
  id: string
  studentId: string
  subjectId: string
  defaultFee: number
  defaultDurationMinutes: number
  active: boolean
  createdAt: string
  updatedAt: string
}
```

Thời lượng mặc định ban đầu:

```text
90 phút
```

Tiền phải được lưu dạng integer VND.

Ví dụ:

```ts
defaultFee: 200000
```

---

# 7. Chức năng 3 — Điểm danh / Tạo buổi dạy

Đây là workflow quan trọng nhất của ứng dụng.

## Mục tiêu UX

Một buổi dạy thông thường phải có thể được tạo với số thao tác ít nhất có thể.

## Entry point

Trang chủ có nút chính:

```text
+ Điểm danh / Tạo buổi dạy
```

Có thể hiển thị thêm danh sách học sinh được sử dụng gần đây để tạo buổi nhanh hơn.

## Form tạo buổi dạy

Các trường:

- Học sinh
- Môn học
- Ngày
- Giờ bắt đầu
- Thời lượng
- Học phí
- Ghi chú tùy chọn

## Giá trị mặc định

Khi mở form:

- Ngày mặc định là ngày hiện tại.
- Giờ bắt đầu mặc định là giờ hiện tại.
- Sau khi chọn học sinh, chỉ hiển thị các môn đang gán cho học sinh đó.
- Nếu học sinh chỉ có một môn đang hoạt động, tự động chọn môn đó.
- Thời lượng lấy từ `StudentSubject.defaultDurationMinutes`.
- Học phí lấy từ `StudentSubject.defaultFee`.
- Người dùng vẫn được phép sửa thời lượng hoặc học phí cho riêng buổi này.

## Xác nhận

Action chính:

```text
Xác nhận buổi dạy
```

Sau khi xác nhận, tạo một `Lesson` record chứa toàn bộ dữ liệu thực tế của buổi học, bao gồm snapshot học phí.

## Data model đề xuất

```ts
interface Lesson {
  id: string
  studentId: string
  subjectId: string

  lessonDate: string // YYYY-MM-DD
  startTime: string  // HH:mm
  durationMinutes: number

  fee: number
  note?: string

  createdAt: string
  updatedAt: string
}
```

Không cần trường attendance status trong MVP.

```text
Có Lesson = đã học
```

---

# 8. Chức năng 4 — Quản lý các buổi đã dạy

## Yêu cầu

Tạo màn hình **Buổi dạy** để quản lý tất cả các buổi đã được ghi nhận.

Hỗ trợ:

- Xem danh sách theo ngày.
- Lọc theo học sinh.
- Lọc theo môn học.
- Lọc theo tháng.
- Sửa một buổi đã ghi nhận.
- Xóa một buổi ghi nhận nhầm.

Mỗi item tối thiểu hiển thị:

- Tên học sinh.
- Môn học.
- Ngày.
- Giờ bắt đầu.
- Thời lượng.
- Học phí.
- Indicator nếu có ghi chú.

## Quy tắc chỉnh sửa

- Thay đổi học phí mặc định của học sinh không được làm thay đổi các `Lesson` cũ.
- Sửa học phí trên một `Lesson` chỉ ảnh hưởng riêng buổi đó.
- Xóa buổi dạy phải có bước xác nhận vì thao tác này sẽ làm thay đổi tổng học phí tháng.

---

# 9. Chức năng 5 — Lưu học phí theo từng buổi

Đây là business rule, không cần màn hình riêng.

## Quy tắc

Khi tạo buổi dạy:

```ts
lesson.fee = studentSubject.defaultFee
```

Người dùng được phép sửa giá trị này trước khi xác nhận.

Sau khi tạo, `lesson.fee` là dữ liệu lịch sử độc lập.

Ví dụ:

```text
Tháng 9: học phí mặc định 100.000đ / buổi
Tháng 10: đổi thành 120.000đ / buổi
```

Các `Lesson` của tháng 9 vẫn phải giữ:

```text
100000
```

## Tính tổng học phí

Luôn tính bằng:

```ts
monthlyTotal = lessons.reduce((sum, lesson) => sum + lesson.fee, 0)
```

Không dùng:

```text
Học phí hiện tại × số buổi
```

làm nguồn dữ liệu chính.

---

# 10. Chức năng 6 — Tổng hợp học phí tháng theo học sinh

## Mục tiêu

Từ các `Lesson` đã được ghi nhận, tổng hợp học phí theo tháng và theo từng học sinh.

## Màn hình Học phí

Cho phép chọn tháng, ví dụ:

```text
Tháng 9 / 2026
```

Mỗi học sinh hiển thị:

- Tổng số buổi.
- Tổng số phút / giờ học.
- Tổng học phí.
- Breakdown theo từng môn.

Ví dụ:

```text
Văn Chí Dũng

Toán
7 buổi
700.000đ

Anh
5 buổi
1.500.000đ

12 buổi
Tổng: 2.200.000đ
```

## Logic tổng hợp

1. Lọc `Lesson` theo tháng được chọn.
2. Group theo `studentId`.
3. Trong từng học sinh, group tiếp theo `subjectId`.
4. Đếm số buổi.
5. Sum `lesson.fee` thực tế.
6. Sum thời lượng.
7. Lấy danh sách ngày học để dùng cho phiếu học phí.

Data structure đề xuất:

```ts
interface MonthlyStudentSummary {
  studentId: string
  month: string
  totalLessonCount: number
  totalDurationMinutes: number
  totalFee: number
  lessonDates: string[]
  subjects: Array<{
    subjectId: string
    subjectName: string
    lessonCount: number
    totalFee: number
  }>
}
```

## Quy tắc hiển thị

Nếu tất cả các buổi của một môn có cùng mức học phí thì UI có thể hiển thị:

```text
7 × 100.000đ = 700.000đ
```

Nhưng tổng tiền thật vẫn phải lấy bằng cách cộng `lesson.fee` của từng buổi.

---

# 11. Chức năng 7 — Tạo phiếu học phí

Phiếu học phí được tạo từ dữ liệu tổng hợp theo tháng của một học sinh.

## Entry point

Từ màn hình tổng hợp học phí tháng:

```text
Tạo phiếu học phí
```

## Nội dung phiếu tối thiểu

- Tiêu đề phiếu.
- Tháng / năm.
- Tên học sinh.
- Danh sách môn học.
- Số buổi theo từng môn.
- Học phí theo từng môn.
- Tổng học phí.
- Danh sách ngày đã học trong tháng.

Giao diện phiếu nên bám theo mẫu phiếu học phí đã được cung cấp trước đó: dạng dọc, rõ từng section, tổng tiền nổi bật và phù hợp để gửi qua điện thoại.

## Nguồn dữ liệu

Các thông tin sau phải được lấy trực tiếp từ `Lesson`:

- Số buổi.
- Ngày đi học.
- Tổng tiền.

Không nhập thủ công các số liệu này khi tạo phiếu.

---

# 12. Chức năng 8 — Preview phiếu học phí

Trước khi xuất ảnh phải có màn hình preview riêng.

## Yêu cầu

- Hiển thị đầy đủ phiếu.
- Sử dụng component dành riêng cho receipt, tách khỏi UI thông thường của app.
- Preview được scale để vừa màn hình điện thoại.
- Bản render dùng để export phải có chất lượng cao, không dựa trên việc screenshot viewport.

Component đề xuất:

```tsx
<TuitionReceipt />
```

Flow:

```text
Học phí tháng
      ↓
Chi tiết học sinh
      ↓
Tạo phiếu học phí
      ↓
Preview phiếu
      ↓
Xuất PNG
```

---

# 13. Chức năng 9 — Xuất phiếu học phí dạng PNG

PNG là định dạng export bắt buộc trong MVP.

## Yêu cầu

- Xuất component phiếu thành ảnh PNG độ phân giải cao.
- Chữ tiếng Việt phải hiển thị rõ và đúng dấu.
- Ảnh phải đủ nét để gửi qua Zalo, Messenger hoặc các ứng dụng nhắn tin khác.
- Không chụp screenshot toàn bộ browser viewport.
- Tên file phải dễ đọc và có quy tắc cố định.

Ví dụ:

```text
hoc-phi-van-chi-dung-2026-09.png
```

## Kiến trúc export

Đóng gói logic export thành utility riêng để có thể thay thư viện sau này mà không ảnh hưởng UI.

Ví dụ:

```ts
exportReceiptToPng(
  element: HTMLElement,
  fileName: string
): Promise<void>
```

Có thể dùng một thư viện DOM-to-image ổn định và tương thích tốt với Next.js phía client.

---

# 14. Chức năng 10 — Backup / Restore

Vì ứng dụng chỉ dùng `localStorage` và không có backend, Backup / Restore là chức năng bắt buộc của MVP.

## Backup

Vị trí:

```text
Cài đặt > Dữ liệu > Xuất bản sao lưu
```

Export toàn bộ dữ liệu ứng dụng thành file JSON.

Ví dụ tên file:

```text
tutor-app-backup-2026-09-25.json
```

## Restore

Vị trí:

```text
Cài đặt > Dữ liệu > Khôi phục dữ liệu
```

Quy trình:

1. Người dùng chọn file JSON.
2. Validate cấu trúc dữ liệu.
3. Nếu hợp lệ, hiển thị cảnh báo xác nhận.
4. Chỉ ghi đè dữ liệu hiện tại sau khi người dùng xác nhận.
5. Reload / rehydrate state sau khi restore thành công.

File backup không hợp lệ tuyệt đối không được ghi đè dữ liệu hiện tại.

---

# 15. Kiến trúc localStorage

Không gọi `localStorage` trực tiếp rải rác trong page hoặc component.

Phải có một lớp repository / storage riêng.

Cấu trúc đề xuất:

```text
src/
├── app/
├── components/
├── features/
│   ├── students/
│   ├── subjects/
│   ├── lessons/
│   ├── tuition/
│   └── receipts/
├── lib/
│   ├── storage/
│   │   ├── repository.ts
│   │   ├── schema.ts
│   │   ├── migration.ts
│   │   └── backup.ts
│   ├── tuition.ts
│   ├── receipt-export.ts
│   └── format.ts
└── types/
```

## Object dữ liệu chính

Dùng một object có `version` để lưu toàn bộ dữ liệu ứng dụng.

```ts
interface AppData {
  version: number
  subjects: Subject[]
  students: Student[]
  studentSubjects: StudentSubject[]
  lessons: Lesson[]
}
```

LocalStorage key đề xuất:

```text
tutor-manager:data
```

Phải có `version` để hỗ trợ migration khi cấu trúc dữ liệu thay đổi trong tương lai.

Dữ liệu khởi tạo:

```ts
{
  version: 1,
  subjects: [
    {
      id: "subject-math",
      name: "Toán",
      active: true,
      createdAt: "...",
      updatedAt: "..."
    }
  ],
  students: [],
  studentSubjects: [],
  lessons: []
}
```

---

# 16. Các màn hình cần triển khai

## Trang chủ

- Nút `+ Điểm danh / Tạo buổi dạy`.
- Các buổi đã tạo hôm nay.
- Tổng số buổi hôm nay.
- Tổng học phí hôm nay.
- Danh sách học sinh dùng gần đây để tạo buổi nhanh.

## Học sinh

- Danh sách học sinh.
- Thêm học sinh.
- Sửa học sinh.
- Chi tiết học sinh.
- Gán môn học và học phí mặc định.
- Lịch sử buổi dạy.

## Buổi dạy

- Danh sách các buổi đã ghi nhận.
- Filter ngày / tháng.
- Filter học sinh.
- Filter môn.
- Sửa buổi.
- Xóa buổi.

## Học phí

- Chọn tháng.
- Tổng hợp theo học sinh.
- Breakdown theo môn.
- Chi tiết các buổi.
- Nút tạo phiếu học phí.

## Preview phiếu

- Render phiếu học phí.
- Nút xuất PNG.

## Cài đặt

Các section chính:

```text
Môn học
Dữ liệu / Backup & Restore
```

---

# 17. Thứ tự triển khai

## Phase 1 — Nền tảng

- Khởi tạo Next.js App Router.
- Cấu hình Tailwind CSS.
- Cấu hình shadcn/ui.
- Cấu hình màu primary OKLCH.
- Tạo mobile app shell.
- Tạo bottom navigation.
- Khai báo các TypeScript model.
- Tạo versioned localStorage repository.
- Seed môn mặc định `Toán`.

## Phase 2 — Quản lý môn học

- Trang Cài đặt.
- Danh sách môn.
- Thêm môn.
- Đổi tên môn.
- Bật / tắt môn.

## Phase 3 — Quản lý học sinh

- Danh sách học sinh.
- Thêm / sửa học sinh.
- Gán môn cho học sinh.
- Cấu hình học phí mặc định theo từng môn.
- Cấu hình thời lượng mặc định.

## Phase 4 — Điểm danh / Tạo buổi dạy

- Drawer hoặc page tạo buổi.
- Auto-fill ngày / giờ hiện tại.
- Chọn học sinh nhanh.
- Chọn môn nhanh.
- Auto-fill học phí và thời lượng.
- Lưu snapshot học phí vào `Lesson`.
- Hiển thị các buổi đã tạo hôm nay trên Trang chủ.

## Phase 5 — Quản lý các buổi đã dạy

- Màn hình Buổi dạy.
- Filter.
- Sửa buổi.
- Xóa buổi với bước xác nhận.
- Lịch sử buổi theo từng học sinh.

## Phase 6 — Tổng hợp học phí tháng

- Month selector.
- Tổng hợp theo học sinh.
- Tổng hợp theo môn trong từng học sinh.
- Tính số buổi, tổng thời lượng và tổng học phí thật.
- Tập hợp danh sách ngày đi học.

## Phase 7 — Phiếu học phí

- Tạo component phiếu riêng.
- Populate dữ liệu từ monthly summary.
- Tạo màn hình preview.
- Preview responsive nhưng vẫn giữ chất lượng export.

## Phase 8 — Xuất PNG

- Thêm chức năng render ảnh PNG chất lượng cao.
- Quy tắc đặt tên file.
- Kiểm tra hiển thị font tiếng Việt.
- Kiểm tra định dạng tiền VND.

## Phase 9 — Backup / Restore

- Export JSON có version.
- Validate file restore.
- Xác nhận trước khi ghi đè.
- Restore toàn bộ dữ liệu.
- Xử lý file lỗi / sai schema.

## Phase 10 — QA / Hoàn thiện

Kiểm thử tối thiểu:

- Viewport iPhone.
- Viewport Android.
- Desktop với app mobile căn giữa.
- Empty state.
- Nhiều học sinh.
- Một học sinh có nhiều môn.
- Thay đổi học phí theo thời gian.
- Sửa một buổi lịch sử.
- Xóa buổi và kiểm tra tổng học phí được cập nhật.
- Lọc dữ liệu qua nhiều tháng.
- Chất lượng ảnh phiếu PNG.
- Backup và Restore đầy đủ.
- Reload trang vẫn giữ nguyên dữ liệu.

---

# 18. Tiêu chí hoàn thành MVP

MVP được xem là hoàn thành khi đáp ứng đủ các điều kiện sau:

1. Ứng dụng khởi tạo sẵn môn `Toán`.
2. Có thể quản lý môn học trong Cài đặt.
3. Có thể tạo và chỉnh sửa học sinh.
4. Có thể gán một hoặc nhiều môn cho từng học sinh.
5. Có thể cấu hình học phí và thời lượng mặc định theo từng `Học sinh + Môn`.
6. Có thể điểm danh / tạo một buổi dạy thủ công với ít thao tác.
7. Khi tạo buổi, hệ thống lưu ngày, giờ, môn, thời lượng và snapshot học phí.
8. Có thể xem, sửa và xóa các buổi đã ghi nhận.
9. Thay đổi học phí mặc định sau này không làm thay đổi học phí của buổi cũ.
10. Có thể tổng hợp học phí theo tháng cho từng học sinh.
11. Có breakdown theo từng môn và danh sách ngày đã học.
12. Có thể tạo phiếu học phí từ dữ liệu tổng hợp tháng.
13. Có thể preview phiếu trước khi xuất.
14. Có thể xuất phiếu thành ảnh PNG chất lượng cao.
15. Dữ liệu vẫn tồn tại sau khi reload trang bằng localStorage.
16. Có thể xuất backup JSON và restore lại dữ liệu.

---

# 19. Không triển khai trong MVP

Không triển khai các chức năng sau nếu chưa có yêu cầu mới:

- Lịch dạy cố định hàng tuần.
- Lịch lặp.
- Tạo trước các buổi học tương lai.
- Tự động điểm danh theo giờ.
- Đồng bộ Google Calendar.
- Đăng nhập / Authentication.
- Backend API.
- Cloud database.
- Đồng bộ nhiều thiết bị.
- Thanh toán online.
- Theo dõi trạng thái đã thanh toán.
- Xuất PDF.
- QR thanh toán.
- Push notification.
- Parent portal.
- Quản lý bài tập.
- Quản lý điểm số.

Mục tiêu của MVP là tối ưu đúng workflow cốt lõi:

```text
Quản lý học sinh
      ↓
Điểm danh / Tạo buổi dạy thực tế
      ↓
Lưu học phí theo từng buổi
      ↓
Tổng hợp học phí tháng
      ↓
Tạo và Preview phiếu học phí
      ↓
Xuất PNG
```
