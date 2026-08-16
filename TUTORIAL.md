# NeuroPulse AI — คู่มือการติดตั้งและใช้งาน

## สารบัญ
1. [การติดตั้ง](#การติดตั้ง)
2. [การเริ่มใช้งาน](#การเริ่มใช้งาน)
3. [การแชร์จากเครื่องอื่น](#การแชร์จากเครื่องอื่น)
4. [API Endpoints](#api-endpoints)
5. [การแก้ปัญหาค้าง](#การแก้ปัญหาค้าง)

---

## การติดตั้ง

### ข้อกำหนด
- Python 3.11+
- Node.js 18+
- npm หรือ yarn

### Backend
```powershell
cd neuropulse-backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend
```powershell
cd neuropulse-ai
npm install
```

---

## การเริ่มใช้งาน

### วิธีที่ 1: ใช้สคริปต์อัตโนมัติ (แนะนำ)
```powershell
# เปิด Terminal 1 — Backend
cd neuropulse-backend
start-backend.bat

# เปิด Terminal 2 — Frontend
cd neuropulse-ai
start-frontend.bat
```

### วิธีที่ 2: ใช้งานเอง
```powershell
# Backend
cd neuropulse-backend
venv\Scripts\activate
uvicorn main:app --reload --port 8765 --host 0.0.0.0

# Frontend
cd neuropulse-ai
$env:HOST="0.0.0.0"
npm run dev
```

### เข้าใช้งาน
- Frontend: http://localhost:3000
- Backend API Docs: http://localhost:8765/docs
- Health Check: http://localhost:8765/health

---

## การแชร์จากเครื่องอื่น

### ขั้นตอนที่ 1: เปิด Firewall
```powershell
# เปิดพอร์ต 8765 (Backend)
netsh advfirewall firewall add rule name="NeuroPulse Backend" dir=in action=allow protocol=TCP localport=8765

# เปิดพอร์ต 3000 (Frontend)
netsh advfirewall firewall add rule name="NeuroPulse Frontend" dir=in action=allow protocol=TCP localport=3000
```

### ขั้นตอนที่ 2: หา IP เครื่องของคุณ
```powershell
ipconfig
```
ดูเลข `IPv4 Address` (เช่น 192.168.1.100)

### ขั้นตอนที่ 3: เข้าจากเครื่องอื่น
- Frontend: http://192.168.1.100:3000
- Backend: http://192.168.1.100:8765

### ขั้นตอนที่ 4: แชร์จากภายนอก (Tunnel)
```powershell
# ติดตั้ง localtunnel
npm install -g localtunnel

# รัน Tunnel
lt --port 3000
# จะได้ URL เช่น http://abc123.localtunnel.me

# หรือใช้ ngrok
npm install -g ngrok
ngrok http 3000
```

---

## API Endpoints

### WebSocket
| Path | Description |
|------|-------------|
| `/ws/eeg-stream` | Live EEG stream (WebSocket) |

### REST API
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/decompose` | Decompose raw signal to brain bands |
| POST | `/api/share/report` | Create shareable report |
| GET | `/api/share/report/{id}` | Get shared report |
| DELETE | `/api/share/report/{id}` | Delete shared report |

### Decompose API Example
```bash
curl -X POST http://localhost:8765/api/decompose \
  -H "Content-Type: application/json" \
  -d '{
    "samples": [0.5, 1.2, -0.3, 0.8, ...],
    "sampling_rate_hz": 256.0,
    "channel_name": "F3"
  }'
```

---

## การแก้ปัญหาค้าง

### WebSocket ติดสถานะ "Connecting"
1. ตรวจสอบว่า Backend กำลังรันอยู่
2. ตรวจสอบ URL ใน Data Input Panel ว่าถูกต้อง: `ws://localhost:8765/ws/eeg-stream`
3. ตรวจสอบ Firewall ว่าไม่บล็อก WebSocket
4. ระบบมี Auto-reconnect 50 ครั้งอยู่แล้ว

### Backend ไม่เริ่มทำงาน
1. ตรวจสอบว่า activate venv แล้ว: `venv\Scripts\activate`
2. ตรวจสอบว่าติดตั้ง dependencies แล้ว: `pip install -r requirements.txt`
3. ตรวจสอบว่าพอร์ต 8765 ว่าง: `netstat -ano | findstr :8765`

### Frontend ไม่เชื่อมต่อ Backend
1. ตรวจสอบ `.env.local` ว่ามี:
   ```
   NEXT_PUBLIC_API_URL=http://127.0.0.1:8765
   NEXT_PUBLIC_WS_URL=
   ```
2. ตรวจสอบว่า Backend กำลังรันอยู่: `curl http://localhost:8765/health`

---

## โครงสร้างโปรเจกต์
```
neuropulse/
├── neuropulse-ai/              # Next.js 14 Frontend
│   ├── app/                    # Pages (App Router)
│   ├── components/             # React Components
│   ├── hooks/                  # Custom Hooks
│   ├── lib/                    # Utilities & Types
│   ├── .env.local              # Environment Config
│   ├── start-frontend.bat      # Startup Script
│   └── package.json
├── neuropulse-backend/          # FastAPI Backend
│   ├── main.py                 # Entry Point
│   ├── services/               # Business Logic
│   ├── db/                     # Database Layer
│   ├── schemas.py              # Pydantic Models
│   ├── requirements.txt        # Python Dependencies
│   └── start-backend.bat       # Startup Script
├── PROJECT_LOG.md               # Activity Log
└── AI_INSTRUCTIONS.md           # AI Collaborator Rules
```

---

*คู่มือนี้เขียนขึ้นเพื่อช่วยในการติดตั้งและใช้งาน NeuroPulse AI*
