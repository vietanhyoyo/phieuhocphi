# Test bằng tài khoản `vietanh`

Tài khoản `vietanh` dùng để thử tính năng, đo tốc độ và kiểm tra đồng bộ.

> **Lưu ý quan trọng**
> - Tài khoản này nằm trên **Google Sheet thật** (cùng Sheet với trang production). Mọi thao tác test đều ghi thật vào Sheet.
> - Repo GitHub đang công khai: **không ghi mật khẩu vào tài liệu hay code**. Tên đăng nhập và mật khẩu nằm trong `.env.local` (file này không được đưa lên git):
>   `TEST_ACCOUNT_USERNAME`, `TEST_ACCOUNT_PASSWORD`.
> - Chỉ thêm/sửa/xoá dữ liệu test (mục 2). Không xoá học sinh thật của tài khoản.

| | |
|---|---|
| Tên đăng nhập | `vietanh` |
| Mật khẩu | `12345678` trong `.env.local` |
| Mã tài khoản (`userId`) | `user-f5ed329e-7aad-4ff0-b4c4-0cf9da92c8fb` |
| Môn học | Toán (`subject-math`) |

## 1. Đăng nhập

```bash
npm run dev
```

Mở <http://localhost:3000>, nhập tên đăng nhập và mật khẩu. Hoặc đăng nhập bằng Console của trình duyệt (DevTools) trên trang đang mở:

```js
await fetch('/api/auth', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'login', username: 'vietanh', password: '<TEST_ACCOUNT_PASSWORD>' }),
});
location.reload();
```

## 2. Dữ liệu test

Dữ liệu test có mã bắt đầu bằng `perf` để dễ nhận ra và dọn dẹp:

- Học sinh `student-perf-1` … `student-perf-10` (ghi chú "Dữ liệu test hiệu năng"), môn Toán, học phí 200.000–350.000 ₫.
- Mỗi học sinh 5 buổi `lesson-perf-<học sinh>-<1..5>` trong tháng 11/2026, 2 buổi đầu đã thu tiền.
- Một số học sinh test đã bị xoá trong các lần thử xoá; tại thời điểm viết tài liệu còn `student-perf-1` đến `student-perf-6`.

Học sinh tạm dùng khi test đồng bộ đặt mã `student-temp-…` và phải xoá sau khi test.

## 3. Đo tốc độ

Sau khi đăng nhập, chạy trong Console:

```js
const time = async (label, run) => { const t = performance.now(); await run(); return `${label}: ${Math.round(performance.now() - t)} ms`; };
[
  await time('Tải dữ liệu', () => fetch('/api/sheets', { cache: 'no-store' }).then((r) => r.json())),
  await time('Kiểm tra đăng nhập', () => fetch('/api/auth', { cache: 'no-store' }).then((r) => r.json())),
];
```

Lưu một thay đổi nhỏ (sửa ghi chú của một buổi test, rồi trả lại như cũ):

```js
const accountId = 'user-f5ed329e-7aad-4ff0-b4c4-0cf9da92c8fb';
const { data } = await fetch('/api/sheets', { cache: 'no-store' }).then((r) => r.json());
const { userId, ...lesson } = data.lessons.find((item) => item.id === 'lesson-perf-1-1');
const save = (note) => fetch('/api/sheets', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ accountId, changes: { lessons: { upsert: [{ ...lesson, note, updatedAt: new Date().toISOString() }], delete: [] } } }),
});
let t = performance.now(); await save('đo tốc độ'); console.log('Lưu:', Math.round(performance.now() - t), 'ms');
await save(lesson.note);
```

Mức tham khảo khi dùng Google Sheets API (đo tháng 11/2026, khoảng 10 học sinh, 50 buổi):

| Thao tác | Thời gian |
|---|---|
| Tải dữ liệu | 0,4–0,6 giây (lần đầu sau khi khởi động server ~2 giây) |
| Lưu một thay đổi | 0,9–1,2 giây |
| Kiểm tra đăng nhập khi đã có phiên | dưới 30 ms |
| Đăng nhập | ~0,7 giây |

Nếu "Tải dữ liệu" mất 8–14 giây thì server đang dùng Apps Script: kiểm tra biến `GOOGLE_SERVICE_ACCOUNT_*`.

## 4. Test đồng bộ giữa hai máy

Cần hai nơi có `localStorage` riêng, ví dụ hai trình duyệt khác nhau, hoặc cùng máy mở <http://localhost:3000> và <http://127.0.0.1:3000> (hai địa chỉ này không dùng chung dữ liệu trình duyệt, phải đăng nhập ở cả hai).

**Xoá ở máy A không bị máy B thêm lại**

1. Mở và đăng nhập `vietanh` ở cả trang A và B, chờ hết chữ "Đang tải dữ liệu…".
2. Ở trang A, tạo một học sinh tạm (ví dụ "HS tạm"), chờ lưu xong.
3. Bấm vào trang B: "HS tạm" xuất hiện sau 1–2 giây.
4. Ở trang A, xoá "HS tạm".
5. Bấm vào trang B: "HS tạm" biến mất sau 1–2 giây (hoặc tối đa ~30 giây nếu không bấm).
6. Ở trang B, sửa một buổi học khác, rồi mở Google Sheet: "HS tạm" **không** được thêm lại.

**Sửa ở hai máy**

1. Trang A sửa ghi chú buổi X; trang B (chưa tải lại) sửa ghi chú buổi Y.
2. Bấm qua lại hai trang: cả hai thay đổi đều có ở cả hai trang và trên Sheet.

**Mất mạng**

1. DevTools → Network → **Offline**.
2. Thêm hoặc sửa vài buổi: giao diện cập nhật ngay, có thông báo đang lưu tạm trên thiết bị.
3. Tải lại trang (vẫn offline): thay đổi vẫn còn.
4. Bật mạng lại: thay đổi tự gửi lên Sheet, trạng thái về "Đã đồng bộ Google Sheet".

## 5. Kiểm tra trang production

Không cần đăng nhập, mở <https://phieuhocphi.vercel.app/api/auth>:

- `HTTP 200` và `"hasUsers": true` → server kết nối Google Sheet bình thường.
- Có trường `message` (ví dụ lỗi đọc private key) → kiểm tra biến môi trường trên Vercel rồi Redeploy.

## 6. Dọn dữ liệu test

Xoá học sinh test và toàn bộ buổi, môn gán của họ (chạy khi đang đăng nhập `vietanh`):

```js
const accountId = 'user-f5ed329e-7aad-4ff0-b4c4-0cf9da92c8fb';
const { data } = await fetch('/api/sheets', { cache: 'no-store' }).then((r) => r.json());
const isTest = (id) => id.startsWith('student-perf-') || id.startsWith('student-temp-');
const ids = (items) => items.map((item) => item.id);
const changes = {
  students: { upsert: [], delete: ids(data.students.filter((item) => isTest(item.id))) },
  studentSubjects: { upsert: [], delete: ids(data.studentSubjects.filter((item) => isTest(item.studentId))) },
  lessons: { upsert: [], delete: ids(data.lessons.filter((item) => isTest(item.studentId))) },
};
await fetch('/api/sheets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accountId, changes }) });
```

Sau đó tải lại app trên mọi máy đang mở tài khoản này.
