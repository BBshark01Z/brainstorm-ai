# AI_INSTRUCTIONS.md

# กฎสำหรับ AI Collaborator — NeuroPulse AI Project

## สำคัญ: อ่านไฟล์นีก่อนเริ่มงานทกุ ครัง

ทกุ ครังที่ AI (Claude, Copilot, หรือ tool อื่ンๆ) จะเริ่มทำงานกับโปรเจกต์ NeuroPulse ต้องอ่านไฟล์นีก่อนเสมอ

---

## กฎบงคบ (Mandatory Rules)

### 1. ต้องอาน PROJECT_LOG.md ก่อนเริ่มงานทกุ ครัง

- ไฟล์ `PROJECT_LOG.md` บันทึกรายละเอียดการแก้ไขล่าสุด ทกุ ไฟล์ที่ถุกแก้ไข และข้่อควรระวัง
- การไม่อานไฟล์นีก่อนอาจทำให้งานซ้าซอน หรือกวนระบบทีกําลังดําเนินการอยู่

### 2. ต้องบันทึกลง PROJECT_LOG.md ก่อนจบบททํางาน

- ทกุ ครังที่มีการแก้ไข สร้าง หรือลบไฟล์ ต้องเพิ่บรายการลงใน `PROJECT_LOG.md`
- หน่วยงานที่ต้องมมีี:
  - **Timestamp**: วันเวลาที่แก้ไข (ISO 8601)
  - **Completed Tasks**: สรุปรายการงานที่ทำเสร็จ
  - **Files Changed**: รายชื่่อไฟล์ที่ถุกสร้าง/แก้ไข/ลบ
  - **Next Steps / Warnings**: สิ่งที่ต้องทำต่อ หรอข้อควรระวัง

### 3. ห้ามลบหรือทําลาย PROJECT_LOG.md

- ไฟล์นีกอ่เป็นประวติการพฒนาของโปรเจกต์
- การเพิ่บรายการใหมต่้องเพิ่บเพยี งสว่น "Completed Tasks" และ "Files Changed"
- ยคุ่ํอํานวยโครงสร้างเดิมไว้อย่างครบถ้วน

### 4. โครงสร้างโปรเจกตต์

```
neuropulse/
├── neuropulse-ai/          # Next.js 14 frontend
│   ├── app/                # Pages (App Router)
│   ├── components/         # React components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities & types
│   └── .env.local          # Environment config
├── neuropulse-backend/     # FastAPI backend
│   ├── main.py             # Entry point
│   ├── services/           # Business logic
│   ├── db/                 # Database layer
│   └── schemas.py          # Pydantic models
├── PROJECT_LOG.md          # Activity log (MANDATORY)
└── AI_INSTRUCTIONS.md      # This file
```

### 5. การเชือ่ มต่อ Frontend ↔ Backend

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8765`
- WebSocket: `ws://localhost:8765/ws/eeg-stream`
- URL ตางๆต้องอานจาก `.env.local` (NEXT_PUBLIC_API_URL)
- **ห้าม hardcode URL ใน frontend code**

### 6. กฎการเขียน Code

- Frontend: TypeScript, React 18+, Tailwind CSS
- Backend: Python 3.11+, FastAPI, Pydantic v2
- Comment เปนภาษาไทยหรอ English ก็ได้ แตให้อ่านง่าน
- ใช้รูปแบบการตั้งชื่อเร่ิมต้งแต่ frontend และ backend ตรงกนั

### 7. กฎความปลอดภัย

- **ไม่มี Authentication ใน production** — ใหเพิ่มกอน deploy จริง
- API key (DEEPSEEK_API_KEY) ต้องไม่ปรากฏใน code
- SQLite ใชง้านไดต้้ อง prototype; production ต้องใช Database อื่่น

### 8. การทดสอบ

- ทกุ ครังที่แก้ไข WebSocket ต้องทดสอบการ connect/disconnect/reconnect
- ทกุ ครังที่แก้ไข decompose API ต้องทดสอบกบสัญญาณดิบ
- ทกุ ครังที่เพิ่บ share feature ต้องทดสอบการ copy link

---

## สรุปกฎสำคัญ (Quick Reference)

| # | กฎ | รายละเอียด |
|---|---|------------|
| 1 | อ่าน PROJECT_LOG.md | ก่อนเริ่มงานทกุ ครัง |
| 2 | บันทึกลง PROJECT_LOG.md | ก่อนจบบททํางานทกุ ครัง |
| 3 | ห้ามลบ PROJECT_LOG.md | เป็นประวติการพฒนา |
| 4 | อ่าน AI_INSTRUCTIONS.md | ก่อนเริ่มงานทกุ ครัง |
| 5 | ไม่า hardcode URLs | ใช env vars เสมอ |
| 6 | ไม่าละเลยการทดสอบ | ทกุ การแกไขตอง test |

---

*ไฟล์นีก่อบงคบทังหมด AI Collaborator ทกุ ตวั ในโปรเจกต์ NeuroPulse AI*

---

## Standing Report Rules (added 2026-08-16, Task U)

Two rules that apply to **every task's final report**, in addition to the mandatory
rules above.

**RULE 1 — Test artifacts touching real/shared state MUST be listed.** Any test artifact
that touches real or shared state — test users, DB rows, uploaded files, background
processes left running, etc. — must be listed under a **"Test artifacts created / cleaned
up"** section in each final report, **even if it was already cleaned up**. Silence on this
is not acceptable, regardless of whether the cleanup succeeded.

**RULE 2 — Flag UX/product-level judgment calls explicitly.** If, while implementing a task
literally as written, you notice a behavior change a reasonable person would consider a
UX/product decision (not just an implementation detail) — even if it's not technically a
bug, and even if you're confident it's what the user "must have meant" — flag it explicitly
in the final report, the same way out-of-scope naming/renaming decisions are already
flagged. Do not silently absorb product-level judgment calls into "should be fine, I'll just
implement it as literally specified."

**RULE 3 — File/data deletion requires an explicit "yes" from the user.** A deletion is
only authorized by an unambiguous, explicit instruction to delete that specific target.
Proceeding on silence after showing a list of candidates — or because the user answered
OTHER (adjacent) questions — is NOT sufficient consent. Presenting a move-vs-delete list
does not by itself authorize the deletions on that list; deletions happen only once the
user explicitly confirms them. When a confirmation names only one item (e.g. one file),
delete only that item — do not broaden the deletion to its containing directory or other
nearby files.
