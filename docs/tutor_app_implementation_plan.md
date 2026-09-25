# Tutor Lesson & Tuition Management Web App — Implementation Plan

## 1. Project Goal

Build a mobile-first web application for a private tutor to:

- Manage subjects.
- Manage students.
- Quickly record a lesson when the lesson actually happens.
- Store the tuition fee snapshot for each recorded lesson.
- Review and edit previously recorded lessons.
- Aggregate monthly tuition per student.
- Generate a tuition receipt from the monthly lesson data.
- Preview the receipt before export.
- Export the receipt as a PNG image.
- Backup and restore all application data.

The application does **not** require pre-created teaching schedules, recurring weekly schedules, automatic attendance, authentication, a backend, or cloud synchronization for the MVP.

---

## 2. Required Technology

Use the following stack:

- **Next.js** with App Router
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **Lucide Icons**
- **localStorage** for persistence
- **Zod** for validation where useful
- **React Hook Form** for forms where useful

### UI requirements

- Mobile-first application.
- Main application width should be optimized for a phone and capped around `430px` on larger screens.
- On desktop, show the mobile app centered on the page rather than converting it into a desktop dashboard.
- Main brand color:

```css
oklch(58.8% 0.158 241.966)
```

- Prefer shadcn/ui components.
- Forms on mobile should preferably use `Drawer` / bottom sheet patterns where appropriate.
- Primary actions should have large touch targets.

---

## 3. Core Product Rules

These rules are important and should guide the implementation.

### 3.1 No predefined teaching schedule

Do not create weekly schedules or future lesson instances.

A lesson exists only after the tutor manually records it at or around the actual teaching time.

### 3.2 A recorded lesson is the attendance record

There is no separate attendance entity in the MVP.

If a `Lesson` record exists, the lesson is considered taught and is eligible for tuition calculation.

### 3.3 Tuition must be snapshotted per lesson

When a lesson is created, copy the current tuition fee into that lesson record.

If the student's tuition fee changes later, historical lessons must keep their original fee.

Monthly tuition must therefore be calculated using:

```text
sum(lesson.fee)
```

Do not recalculate historical tuition from the student's current fee.

### 3.4 Subject management belongs inside Settings

Subjects are managed from the Settings area.

The app must ship with one default subject:

```text
Mathematics
```

The user can add, rename, and deactivate subjects later.

---

## 4. Main Navigation

Recommended bottom navigation:

1. **Home**
2. **Lessons**
3. **Students**
4. **Tuition**

Settings can be opened from a gear icon in the header.

The most important action in the entire app is:

```text
+ Record Lesson
```

This action should be easily accessible from Home.

---

# 5. Feature 1 — Subject Management

## Location

`Settings > Subjects`

## Requirements

- Create subject.
- Rename subject.
- Activate/deactivate subject.
- Prevent accidental deletion when the subject is already referenced by historical lessons.
- Prefer soft deactivation instead of destructive deletion for subjects already in use.
- Default app data must contain:

```text
Mathematics
```

## Suggested data model

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

# 6. Feature 2 — Student Management

## Requirements

- List students.
- Add student.
- Edit student.
- Deactivate student.
- View student details.
- View the student's lesson history.
- View the student's monthly tuition summary.

## Student fields

Minimum fields:

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

## Student subject configuration

A student can study one or more subjects.

Each student-subject combination stores the default tuition fee and default duration used when recording a lesson.

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

Default lesson duration should initially be:

```text
90 minutes
```

Money must be stored as integer VND values.

Example:

```ts
defaultFee: 200000
```

Do not store money as floating-point decimal currency values.

---

# 7. Feature 3 — Record Lesson / Attendance

This is the highest-priority workflow in the app.

## Goal

A normal lesson should be recordable with as few taps as possible.

## Entry points

Primary button on Home:

```text
+ Record Lesson
```

Optionally show recently used students on Home to make repeated recording faster.

## Record Lesson form

Fields:

- Student
- Subject
- Date
- Start time
- Duration
- Tuition fee
- Optional note

## Default behavior

When the form opens:

- Date defaults to today.
- Start time defaults to the current time.
- After student selection, show only subjects assigned to that student.
- If the student has only one active subject, auto-select it.
- Duration defaults from `StudentSubject.defaultDurationMinutes`.
- Fee defaults from `StudentSubject.defaultFee`.
- Duration and fee can still be edited for this individual lesson.

## Confirmation

Primary action:

```text
Confirm Lesson
```

After confirmation, create one immutable-by-default historical lesson record containing the fee snapshot.

## Suggested lesson model

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

There is no separate attendance status for the MVP.

```text
Lesson exists = lesson was taught
```

---

# 8. Feature 4 — Manage Recorded Lessons

## Requirements

Provide a Lessons screen that displays recorded lessons.

Support:

- View lessons by date.
- Filter by student.
- Filter by subject.
- Filter by month.
- Edit a recorded lesson.
- Delete a lesson recorded by mistake.

Each lesson item should display at least:

- Student name
- Subject
- Date
- Start time
- Duration
- Fee
- Note indicator if a note exists

## Editing rule

Editing the student's default fee must not modify historical lessons.

Editing a specific lesson's fee modifies only that lesson.

Deletion must require confirmation because it affects monthly tuition totals.

---

# 9. Feature 5 — Store Tuition Per Lesson

This is not a separate UI screen; it is a required business rule.

## Rule

When creating a lesson:

```ts
lesson.fee = studentSubject.defaultFee
```

The user may override this amount before confirming the lesson.

After the lesson is created, the fee belongs to the lesson record.

Example:

```text
September lesson fee: 100,000 VND
October new default fee: 120,000 VND
```

September lesson records must remain `100000`.

## Monthly calculations

Always use:

```ts
monthlyTotal = lessons.reduce((sum, lesson) => sum + lesson.fee, 0)
```

Never use:

```text
current fee × lesson count
```

as the source of truth.

---

# 10. Feature 6 — Monthly Tuition Summary by Student

## Goal

Aggregate all recorded lessons for a selected month and group them by student.

## Tuition screen

Allow selecting a month, for example:

```text
September 2026
```

For each student show:

- Total lesson count
- Total duration
- Total tuition
- Breakdown by subject

Example:

```text
Van Chi Dung

Mathematics
7 lessons
700,000 VND

English
5 lessons
1,500,000 VND

12 lessons
Total: 2,200,000 VND
```

## Aggregation logic

1. Filter lessons by selected month.
2. Group by `studentId`.
3. Inside each student, group by `subjectId`.
4. Count lessons.
5. Sum actual `lesson.fee` values.
6. Collect lesson dates for receipt generation.

Pseudo-structure:

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

## Important display rule

If all lessons for a subject have the same fee, the UI may display:

```text
7 × 100,000 VND = 700,000 VND
```

However, the actual total must still come from summing the individual lesson fee snapshots.

---

# 11. Feature 7 — Create Tuition Receipt

A tuition receipt is generated from a student's monthly summary.

## Entry point

From the monthly tuition summary:

```text
Generate Receipt
```

## Receipt data

At minimum include:

- Receipt title
- Month/year
- Student name
- Subject breakdown
- Lesson count per subject
- Tuition amount per subject
- Total tuition
- Actual lesson dates in the selected month

The receipt should visually follow the reference tuition receipt style previously provided by the product owner: a clean vertical mobile-friendly receipt with clear sections and a strong total amount.

## Receipt data must come from recorded lessons

Do not manually enter the lesson count for the receipt.

Do not manually enter lesson dates.

They must be derived from the saved `Lesson` records.

---

# 12. Feature 8 — Receipt Preview

Before export, display a dedicated receipt preview screen.

## Requirements

- Show the complete receipt.
- Use a dedicated receipt component, separate from the normal application UI.
- Preview should scale to fit a phone screen.
- The underlying receipt must render at export quality rather than taking a screenshot of the visible mobile UI.

Suggested component:

```tsx
<TuitionReceipt />
```

Suggested page flow:

```text
Monthly Tuition
      ↓
Student Summary
      ↓
Generate Receipt
      ↓
Receipt Preview
      ↓
Export PNG
```

---

# 13. Feature 9 — Export Tuition Receipt as PNG

PNG is the only required receipt export format for this MVP.

## Requirements

- Export the dedicated receipt component as a high-resolution PNG.
- Output should be sharp enough to send through messaging applications.
- Do not export by taking a screenshot of the browser viewport.
- File naming convention should be deterministic and readable.

Example:

```text
tuition-van-chi-dung-2026-09.png
```

## Suggested implementation options

Use a reliable DOM-to-image approach compatible with the chosen Next.js client-side implementation, for example a maintained HTML-to-image library.

The export implementation must be isolated behind a utility so it can be replaced later without affecting the receipt UI.

Example abstraction:

```ts
exportReceiptToPng(element: HTMLElement, fileName: string): Promise<void>
```

---

# 14. Feature 10 — Backup / Restore

Because the application uses localStorage and has no backend, backup and restore are mandatory MVP functionality.

## Backup

Provide:

```text
Settings > Data > Export Backup
```

Export all application data into a JSON file.

Suggested filename:

```text
tutor-app-backup-2026-09-25.json
```

## Restore

Provide:

```text
Settings > Data > Restore Backup
```

Process:

1. User selects a JSON backup file.
2. Validate the backup structure.
3. Show a confirmation warning.
4. Replace current local data only after confirmation.
5. Reload/re-hydrate the app state.

Invalid backups must not overwrite current data.

---

# 15. localStorage Architecture

Do not call `localStorage` directly throughout page components.

Create a storage/repository layer.

Suggested structure:

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

## Main storage object

Use one versioned application data object.

```ts
interface AppData {
  version: number
  subjects: Subject[]
  students: Student[]
  studentSubjects: StudentSubject[]
  lessons: Lesson[]
}
```

Suggested localStorage key:

```text
tutor-manager:data
```

A schema `version` is required so future versions can migrate user data safely.

Example initial state:

```ts
{
  version: 1,
  subjects: [
    {
      id: "subject-math",
      name: "Mathematics",
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

# 16. Suggested Screens

Keep the screen set small.

## Home

Primary content:

- `+ Record Lesson`
- Today's recorded lessons
- Today's lesson count
- Today's total tuition
- Recent students for faster lesson recording

## Students

- Student list
- Add student
- Edit student
- Student details
- Student lesson history

## Lessons

- Recorded lesson list
- Date/month filter
- Student filter
- Subject filter
- Edit/delete lesson

## Tuition

- Month selector
- Monthly summary grouped by student
- Student monthly details
- Generate Receipt action

## Receipt Preview

- Dedicated receipt render
- Export PNG action

## Settings

Sections:

```text
Subjects
Data / Backup & Restore
```

---

# 17. Implementation Order

Implement in the following order.

## Phase 1 — Foundation

- Create Next.js project structure.
- Configure Tailwind CSS.
- Configure shadcn/ui.
- Configure primary OKLCH color.
- Build mobile app shell.
- Build bottom navigation.
- Create application types.
- Create versioned localStorage repository.
- Seed the default `Mathematics` subject.

## Phase 2 — Subject Management

- Settings screen.
- Subject list.
- Add subject.
- Rename subject.
- Activate/deactivate subject.

## Phase 3 — Student Management

- Student list.
- Add/edit student.
- Student subject assignment.
- Configure default fee per subject.
- Configure default lesson duration.

## Phase 4 — Record Lesson

- Record Lesson drawer/page.
- Auto-fill current date/time.
- Auto-fill subject fee and duration.
- Fast student/subject selection.
- Save fee snapshot into Lesson.
- Display today's recorded lessons on Home.

## Phase 5 — Lesson Management

- Lessons screen.
- Filters.
- Edit lesson.
- Delete lesson with confirmation.
- Student lesson history.

## Phase 6 — Monthly Tuition

- Month selector.
- Aggregate lessons per student.
- Aggregate subjects per student.
- Calculate lesson count, duration, and actual fee totals.
- Display lesson dates.

## Phase 7 — Tuition Receipt

- Build dedicated receipt component.
- Populate receipt from monthly summary.
- Build receipt preview screen.
- Make preview responsive while preserving export dimensions.

## Phase 8 — PNG Export

- Add high-resolution PNG generation.
- Add deterministic file naming.
- Test Vietnamese text rendering and currency formatting.

## Phase 9 — Backup / Restore

- Export versioned JSON backup.
- Validate restore file.
- Confirm destructive restore.
- Restore all data.
- Test corrupted/invalid backup handling.

## Phase 10 — QA / Polish

Test at minimum:

- iPhone-sized viewport.
- Android-sized viewport.
- Desktop centered phone layout.
- Empty states.
- Many students.
- Multiple subjects per student.
- Fee changes over time.
- Editing a historical lesson.
- Deleting a lesson and recalculating tuition.
- Cross-month lesson filtering.
- PNG receipt quality.
- Backup + full restore.
- App reload with persisted data.

---

# 18. MVP Acceptance Criteria

The MVP is complete when all of the following are true:

1. The app starts with `Mathematics` already available as a subject.
2. The user can manage subjects from Settings.
3. The user can create students and assign one or more subjects to each student.
4. A default fee and duration can be configured per student-subject combination.
5. The user can record a lesson manually in a few taps.
6. Recording a lesson stores the actual date/time, duration, subject, student, and tuition fee snapshot.
7. The user can view, edit, and delete recorded lessons.
8. Historical lesson fees do not change when default fees are changed later.
9. The app can aggregate monthly tuition for every student from recorded lessons.
10. The monthly summary can show a subject breakdown and actual lesson dates.
11. A tuition receipt can be generated directly from the monthly summary.
12. The user can preview the receipt before export.
13. The receipt can be exported as a high-resolution PNG.
14. All application data survives page reloads through localStorage.
15. The user can export a JSON backup and restore it later.

---

# 19. Explicit MVP Non-Goals

Do **not** implement these unless requirements change:

- Weekly teaching schedules
- Recurring schedules
- Future lesson generation
- Automatic attendance based on time
- Calendar synchronization
- Google Calendar integration
- Authentication
- Multi-user accounts
- Backend API
- Cloud database
- Cross-device synchronization
- Online payments
- Payment status tracking
- PDF receipt export
- QR payment generation
- Push notifications
- Parent portal
- Homework management
- Grade management

Keeping these out of the MVP is intentional. The product should first optimize the core workflow:

```text
Manage Student
    ↓
Record Actual Lesson
    ↓
Store Lesson Fee
    ↓
Monthly Tuition Summary
    ↓
Receipt Preview
    ↓
Export PNG
```
