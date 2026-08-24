// ---------------------------------------------------------------------------
// NeuroPulse AI — i18n translation dictionary (Thai / English)
//
// Flat key → { th, en } map. Keys are namespaced by area (e.g. "nav.home",
// "brainprint.scanning") so the file stays greppable. The English value is
// the source of truth for the UI's current copy; the Thai value is its
// translation. Add new keys as pages are wired up (Task X, Step 4).
//
// Interpolation: values may contain {placeholder} tokens; `t(key, { x: "v" })`
// substitutes them.
//
// Brand/technical tokens are intentionally NOT translated: "Brainstorm",
// "Brainprint", "EEG", "AI", "LIVE", "VERIFIED", "IMPROVING", band
// abbreviations (DEL/THR/ALP/BET/GAM).
// ---------------------------------------------------------------------------

export type Language = "th" | "en";

export interface TranslationEntry {
  th: string;
  en: string;
}

export const translations: Record<string, TranslationEntry> = {
  // --- Navigation (Sidebar / MobileTabBar) ---
  "nav.home": { th: "หน้าแรก", en: "Home" },
  "nav.brainprint": { th: "Brainprint", en: "Brainprint" },
  "nav.analytics": { th: "การวิเคราะห์", en: "Analytics" },
  "nav.aiConsultant": { th: "ที่ปรึกษา AI", en: "AI Consultant" },
  "nav.systemOnline": { th: "ระบบออนไลน์", en: "System Online" },

  // --- Header ---
  "header.realTimeMonitor": { th: "Brain Monitor แบบเรียลไทม์", en: "Real-time Brain Monitor" },
  "header.sessionActive": { th: "เซสชันใช้งาน · อัปเดตข้อมูลทุก 150ms", en: "Session active · data refreshes every 150ms" },
  "header.noEegStream": { th: "ไม่มี EEG Stream", en: "No EEG Stream" },
  "header.brainprintVerified": { th: "Brainprint VERIFIED", en: "Brainprint Verified" },
  "header.notVerified": { th: "ไม่ VERIFIED", en: "Not Verified" },
  "header.streamActive": { th: "EEG Stream · {name}", en: "EEG Stream · {name}" },
  "header.connectedLabel": { th: "{name} · {signal}%", en: "{name} · {signal}%" },

  // --- Connection / stream status labels ---
  "status.streaming": { th: "กำลัง Stream", en: "Streaming" },
  "status.connecting": { th: "กำลังเชื่อมต่อ", en: "Connecting" },
  "status.disconnected": { th: "ไม่เชื่อมต่อ", en: "Disconnected" },

  // --- Shell ---
  "shell.loading": { th: "กำลังโหลด...", en: "Loading..." },

  // --- Splash / landing (app/page.tsx) ---
  "splash.nav.features": { th: "ฟีเจอร์", en: "Features" },
  "splash.nav.demo": { th: "เดโม LIVE", en: "Live Demo" },
  "splash.nav.about": { th: "เกี่ยวกับ", en: "About" },
  "splash.signIn": { th: "เข้าสู่ระบบ", en: "Sign In" },
  "splash.getStarted": { th: "เริ่มต้นใช้งาน", en: "Get Started" },
  "splash.badge": { th: "แพลตฟอร์มวิจัย EEG แบบทดลอง", en: "Experimental EEG Research Platform" },
  "splash.headline": { th: "เบรนสตอร์ม", en: "Brainstorm" },
  "splash.subhead": {
    th: "แพลตฟอร์มทดลองสำหรับการติดตาม EEG การยืนยัน Brainprint และการวิเคราะห์ด้วย AI — พัฒนาบนข้อมูลอ้างอิงจำลองเพื่อการวิจัย ไม่ใช่เพื่อใช้งานทางคลินิก.",
    en: "An experimental platform for EEG monitoring, brain-print verification, and AI-driven analysis — built on simulated reference data for research, not clinical use.",
  },
  "splash.continueToLogin": { th: "ดำเนินการเข้าสู่ระบบ", en: "Continue to Login" },
  "splash.createAccount": { th: "สร้างบัญชี", en: "Create account" },
  "splash.metric.focus": { th: "คะแนนสมาธิ", en: "FOCUS SCORE" },
  "splash.metric.stress": { th: "ระดับความเครียด", en: "STRESS LEVEL" },
  "splash.metric.clarity": { th: "ความชัดเจนทางจิตใจ", en: "MENTAL CLARITY" },
  "splash.demo.title": { th: "เดโมสถานะสมองแบบโต้ตอบ", en: "Interactive Brain State Demo" },
  "splash.demo.sub": { th: "สลับสถานะเพื่อดูการเปลี่ยนแปลงของสีและแอนิเมชันแบบเรียลไทม์", en: "Switch states to see real-time color and animation changes" },
  "splash.state.focus": { th: "โฟกัส", en: "Focus" },
  "splash.state.stress": { th: "ความเครียด", en: "Stress" },
  "splash.state.sleep": { th: "การนอนหลับ", en: "Sleep" },
  "splash.features.title": { th: "ความสามารถของแพลตฟอร์ม", en: "Platform Capabilities" },
  "splash.features.sub": { th: "การตรวจสอบระบบประสาทแบบเรียลไทม์, ความปลอดภัยแบบ biometric และข้อมูลเชิงลึกจาก AI", en: "Real-time neural monitoring, biometric security, and AI insights" },
  "splash.card.liveMonitor": { th: "Monitor สด", en: "Live Monitor" },
  "splash.card.waveform": { th: "คลื่น EEG 5-แบนด์", en: "5-Band EEG Waveform" },
  "splash.card.security": { th: "ความปลอดภัย", en: "Security" },
  "splash.card.consultant": { th: "ที่ปรึกษา DeepSeek", en: "DeepSeek Consultant" },
  "splash.card.burnout": { th: "ดัชนี burnout & recovery", en: "Burnout & Recovery Index" },
  "splash.card.recovery": { th: "recovery", en: "Recovery" },
  "splash.card.burnoutRisk": { th: "ความเสี่ยง Burnout", en: "Burnout Risk" },
  "splash.card.trend": { th: "แนวโน้ม", en: "Trend" },
  "splash.badge.live": { th: "LIVE", en: "LIVE" },
  "splash.badge.verified": { th: "VERIFIED", en: "VERIFIED" },
  "splash.badge.improving": { th: "IMPROVING", en: "IMPROVING" },
  "splash.chat.ai1": { th: "จากค่าความไม่สมมาตร alpha ของคุณ...", en: "Based on your alpha asymmetry..." },
  "splash.chat.user": { th: "แสดงแนวโน้มเดือนที่แล้วให้ฉันดู", en: "Show me the trend for last month" },
  "splash.chat.ai2": { th: "นี่คือ burnout recovery index ของคุณ...", en: "Here is your burnout recovery index..." },
  "splash.cta.title": { th: "พร้อมที่จะสำรวจสมองของคุณหรือยัง?", en: "Ready to Explore Your Brain?" },
  "splash.cta.sub": { th: "เข้าร่วมอนาคตของการติดตามระบบประสาท ไม่ต้องใช้ฮาร์ดแวร์ - เริ่มจากข้อมูลจำลอง", en: "Join the future of neural monitoring. No hardware required - start with simulated data." },
  "splash.cta.button": { th: "สร้างบัญชีของคุณ", en: "Create Your Account" },
  "splash.footer.disclaimer": { th: "Brainstorm — แพลตฟอร์มวิจัย EEG แบบทดลอง ข้อมูลทั้งหมดเป็นข้อมูลอ้างอิงจำลอง ไม่ใช่เครื่องมือแพทย์", en: "Brainstorm — an experimental EEG research platform. All data is simulated reference data. Not a medical device." },
  "splash.footer.note": { th: "หน้าต้อนรับสำหรับ Brainstorm การดำเนินการเข้าสู่ระบบหรือลงทะเบียนจะยังคงใช้บัญชีที่ผ่านการยืนยันตัวตนของคุณ", en: "Welcome page for Brainstorm. Continuing to login or register keeps using your authenticated account." },

  // --- Splash feature pills ---
  "pill.monitor.label": { th: "Monitor สด", en: "Live Monitor" },
  "pill.monitor.tag": { th: "คลื่น EEG แบบเรียลไทม์ครอบคลุม 5 bands ความถี่บน Stream สด", en: "Real-time EEG waveforms across five frequency bands on a live stream." },
  "pill.brainprint.label": { th: "Brainprint", en: "Brainprint" },
  "pill.brainprint.tag": { th: "การจับคู่ Biometric identity จากคุณลักษณะทางประสาท เทียบกับโปรไฟล์ที่ลงทะเบียนแล้ว.", en: "Biometric identity matching from neural features against enrolled profiles." },
  "pill.analytics.label": { th: "การวิเคราะห์", en: "Analytics" },
  "pill.analytics.tag": { th: "แนวโน้ม Longitudinal และการเปรียบเทียบ baseline กับชุดข้อมูลอ้างอิงจาก 20 ผู้เข้าร่วม.", en: "Longitudinal trends and baseline comparison against a 20-subject reference set." },
  "pill.consultant.label": { th: "ที่ปรึกษา AI", en: "AI Consultant" },
  "pill.consultant.tag": { th: "ที่ปรึกษา Neuro แบบ AI ที่ตีความสัญญาณของคุณและตอบคำถาม.", en: "An AI neuro-consultant that interprets your signals and answers questions." },

  // --- Splash stats footer ---
  "stat.bands": { th: "ย่านความถี่ที่วิเคราะห์", en: "Frequency bands analyzed" },
  "stat.subjects": { th: "ผู้เข้าร่วมอ้างอิง", en: "Reference subjects" },
  "stat.samples": { th: "ตัวอย่างอ้างอิง", en: "Reference samples" },
  "stat.refresh": { th: "อัตราการรีเฟรช Stream", en: "Stream refresh rate" },

  // --- Auth (login / register) ---
  "auth.platform": { th: "แพลตฟอร์ม Neural Monitoring", en: "Neural Monitoring Platform" },
  "auth.secureConnection": { th: "การเชื่อมต่อที่ปลอดภัย", en: "Secure Connection" },
  "auth.email": { th: "อีเมล", en: "Email Address" },
  "auth.password": { th: "รหัสผ่าน", en: "Password" },
  "auth.signIn": { th: "เข้าสู่ระบบ", en: "Sign In" },
  "auth.connecting": { th: "กำลังเชื่อมต่อ...", en: "Connecting..." },
  "auth.noAccount": { th: "ยังไม่มีบัญชี?", en: "Don't have an account?" },
  "auth.createAccount": { th: "สร้างบัญชี", en: "Create account" },
  "auth.join": { th: "เข้าร่วม", en: "Join" },
  "auth.createProfile": { th: "สร้างโปรไฟล์ประสาทของคุณ", en: "Create your neural profile" },
  "auth.encrypted": { th: "การลงทะเบียนแบบเข้ารหัส", en: "Encrypted Registration" },
  "auth.nickname": { th: "ชื่อเล่น", en: "Nickname" },
  "auth.nicknamePlaceholder": { th: "นามแฝงทางประสาทของคุณ", en: "Your neural alias" },
  "auth.requirements": { th: "ข้อกำหนด", en: "Requirements" },
  "auth.req6": { th: "อย่างน้อย 6 ตัวอักษร", en: "At least 6 characters" },
  "auth.reqMix": { th: "ผสมตัวอักษร ตัวเลข และสัญลักษณ์", en: "Mix letters, numbers, and symbols" },
  "auth.creating": { th: "กำลังสร้าง...", en: "Creating..." },
  "auth.createAccountBtn": { th: "สร้างบัญชี", en: "Create Account" },
  "auth.haveAccount": { th: "มีบัญชีอยู่แล้ว?", en: "Already have an account?" },
  "auth.signInLink": { th: "เข้าสู่ระบบ", en: "Sign in" },

  // --- Auth errors (useAuth) ---
  "auth.err.invalid": { th: "อีเมลหรือรหัสผ่านไม่ถูกต้อง", en: "Invalid email or password" },
  "auth.err.invalidInput": { th: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบข้อมูลของคุณและลองใหม่", en: "Invalid input. Please check your data and try again" },
  "auth.err.emailTaken": { th: "อีเมลนี้ถูกลงทะเบียนแล้ว", en: "This email is already registered" },
  "auth.err.network": { th: "ไม่สามารถเชื่อมต่อ backend server ได้ (กรุณาตรวจสอบว่า Uvicorn ทำงานบนพอร์ต 8765)", en: "Cannot connect to the backend server (please ensure Uvicorn is running on port 8765)" },
  "auth.err.server": { th: "ข้อผิดพลาดของเซิร์ฟเวอร์ ({status})", en: "Server error ({status})" },
  "auth.err.unknown": { th: "ข้อผิดพลาดที่ไม่ทราบสาเหตุ", en: "Unknown error" },
  // --- Dashboard / Live Monitor ---
  "dash.home": { th: "หน้าแรก", en: "Home" },
  "dash.shareTitle": { th: "EEG Monitor — {date}", en: "EEG Monitor — {date}" },
  "dash.deviceName": { th: "EEG Stream", en: "EEG Stream" },
  "dash.about": { th: "เกี่ยวกับโปรเจกต์นี้", en: "About this project" },
  "dash.aboutBody": { th: "Brainstorm คือแพลตฟอร์ม NeuroTech แบบทดลองเพื่อสำรวจว่า pipeline สำหรับ EEG monitoring + analytics แบบ end-to-end จะเป็นอย่างไร โดยค่าเริ่มต้นทุกอย่างทำงานบนข้อมูลจำลอง — ตัวสร้างสัญญาณสังเคราะห์หรือไฟล์ที่อัปโหลดทำหน้าที่แทนอุปกรณ์ EEG จริง และที่ปรึกษา AI จะเปลี่ยนไปใช้คำตอบแบบ rule-based ในเครื่องเมื่อ model endpoint ไม่พร้อมใช้งาน เป็นโปรเจกต์เพื่อการเรียนรู้ที่สร้างเพื่อ prototype เส้นทาง signal-processing ที่แท้จริง, biometric identity, การวิเคราะห์ longitudinal และชั้นการตีความ AI — ไม่ใช่เครื่องมือทางคลินิกที่ผ่านการตรวจสอบยืนยัน", en: "Brainstorm is an experimental NeuroTech platform exploring what an end-to-end EEG monitoring + analytics pipeline looks like. By default everything runs on simulated data — a synthetic signal generator or uploaded files stand in for a real EEG device, and the AI consultant falls back to local rule-based responses when the model endpoint is unavailable. It's a learning project built to prototype the real signal-processing path, biometric identity, longitudinal analysis, and an AI interpretation layer — not a validated clinical tool." },
  "dash.step1Title": { th: "EEG แบบสด หรือข้อมูลที่อัปโหลด", en: "Live EEG or uploaded data" },
  "dash.step1Body": { th: "เชื่อมต่อ WebSocket Stream เพื่อดู band power ที่คำนวณได้แบบสด หรืออัปโหลด / วางไฟล์ EEG (CSV, JSON หรือตัวอย่างข้อมูลดิบ) เพื่อรีเพลย์บนกราฟคลื่น", en: "Connect to a WebSocket stream to see computed band powers live, or upload / paste an EEG file (CSV, JSON, or raw samples) to replay it on the waveform chart." },
  "dash.step2Title": { th: "Brainprint identity", en: "Brainprint identity" },
  "dash.step2Body": { th: "บันทึกการอ่านค่า EEG เพื่อสร้าง Brainprint ส่วนตัว — biometric signature — จากนั้นตรวจสอบเปรียบเทียบกับในเซสชันครั้งถัดไป", en: "Capture an EEG reading to build a personal brainprint — a biometric signature — then verify against it on later sessions." },
  "dash.step3Title": { th: "การวิเคราะห์ Longitudinal", en: "Longitudinal analytics" },
  "dash.step3Body": { th: "ดูแนวโน้มของตัวชี้วัดหลัก (ความเสี่ยง burnout, FAA, ความหนาแน่น spindle ในการนอนหลับ, slow-wave sleep) ตามเวลา และเปรียบเทียบกับ baseline 30 วันล่าสุดของคุณ", en: "Review how key markers (burnout risk, FAA, sleep spindle density, slow-wave sleep) trend over time and compare against your recent 30-day baseline." },
  "dash.step4Title": { th: "ที่ปรึกษา AI ด้าน Neuro", en: "AI neuro-consultant" },
  "dash.step4Body": { th: "ถามผู้ช่วย AI เพื่อตีความบริบท EEG ของคุณ และแสดงสิ่งที่น่าจับตามอง — พร้อมระบบสำรอง rule-based ในเครื่องเมื่อ model endpoint เข้าถึงไม่ได้", en: "Ask an AI assistant to interpret your EEG context and surface what's worth watching — with a local rule-based fallback whenever the model endpoint is unreachable." },
  "dash.dataInput": { th: "ข้อมูลอินพุตแบบเรียลไทม์", en: "Real-Time Data Input" },
  "dash.modeFile": { th: "อัปโหลดไฟล์", en: "File Upload" },
  "dash.modeWebSocket": { th: "WebSocket", en: "WebSocket" },
  "dash.dropPrefix": { th: "ลาก", en: "Drop a" },
  "dash.dropMid": { th: "หรือ", en: "or" },
  "dash.dropSuffix": { th: "ไฟล์ หรือคลิกเพื่อเรียกดู", en: "file, or click to browse" },
  "dash.pasteLabel": { th: "หรือวางข้อมูลดิบ", en: "Or paste raw data" },
  "dash.pastePlaceholder": { th: "เช่น 12.4, 15.1, 9.8, 22.3 ...", en: "e.g. 12.4, 15.1, 9.8, 22.3 ..." },
  "dash.playPasted": { th: "เล่นอาร์เรย์ที่วางไว้", en: "Play Pasted Array" },
  "dash.pause": { th: "หยุดชั่วคราว", en: "Pause" },
  "dash.play": { th: "เล่น", en: "Play" },
  "dash.samplesCount": { th: "{count} ตัวอย่าง · {format}", en: "{count} samples · {format}" },
  "dash.ws.disconnected": { th: "ไม่เชื่อมต่อ", en: "Disconnected" },
  "dash.ws.disconnectedSub": { th: "เชื่อมต่อเพื่อเริ่ม Stream", en: "Connect to start streaming" },
  "dash.ws.connecting": { th: "กำลังเชื่อมต่อ…", en: "Connecting…" },
  "dash.ws.connectingSub": { th: "กำลังสร้างลิงก์ WebSocket", en: "Establishing WebSocket link" },
  "dash.ws.connected": { th: "กำลัง Stream", en: "Streaming" },
  "dash.ws.connectedSub": { th: "ข้อมูล EEG แบบ LIVE กำลังไหล", en: "Live EEG data flowing" },
  "dash.ws.error": { th: "การเชื่อมต่อล้มเหลว", en: "Connection Failed" },
  "dash.ws.errorSub": { th: "ตรวจสอบ backend หรือลองอีกครั้ง", en: "Check backend or try again" },
  "dash.copyShareLink": { th: "คัดลอกลิงก์แชร์", en: "Copy share link" },
  "dash.copied": { th: "คัดลอกแล้ว!", en: "Copied!" },
  "dash.share": { th: "แชร์", en: "Share" },
  "dash.disconnect": { th: "ตัดการเชื่อมต่อ", en: "Disconnect" },
  "dash.connect": { th: "เชื่อมต่อ", en: "Connect" },
  "dash.wsEndpoint": { th: "Endpoint ของ WebSocket", en: "WebSocket Endpoint" },
  "dash.live": { th: "Live", en: "Live" },
  "dash.intervals": { th: "ช่วง ~300ms", en: "~300ms intervals" },
  "dash.heartbeat": { th: "Heartbeat", en: "Heartbeat" },
  "dash.on": { th: "ON", en: "ON" },
  "dash.autoReconnect": { th: "เปิดใช้งานการเชื่อมต่อใหม่อัตโนมัติ · สูงสุด 50 ครั้ง", en: "Auto-reconnect enabled · Max 50 attempts" },
  "dash.wsInfoPrefix": { th: "คาดหวังเฟรม JSON แบบ newline-delimited ที่มีโครงสร้างดังนี้", en: "Expects newline-delimited JSON frames shaped like" },
  "dash.wsInfoSuffix": { th: "จาก Python EEG bridge ของคุณ.", en: "from your Python EEG bridge." },
  "dash.waveformTitle": { th: "คลื่น EEG หลายช่อง", en: "Multi-Channel EEG Waveform" },
  "dash.waveformSub": { th: "band power แบบเรียลไทม์ · µV", en: "Live band power · µV" },
  "dash.headsetLink": { th: "การเชื่อมต่อ Headset", en: "Headset Link" },
  "dash.noConnection": { th: "ไม่มีการเชื่อมต่อ", en: "No Connection" },
  "dash.noConnectionHint": { th: "เชื่อมต่อ backend เพื่อเริ่ม Monitor", en: "Connect to a backend to start monitoring" },
  "dash.signal": { th: "สัญญาณ", en: "Signal" },
  "dash.battery": { th: "แบตเตอรี่", en: "Battery" },
  "dash.impedance": { th: "ค่าอิมพีแดนซ์ของอิเล็กโทรด", en: "Electrode Impedance" },
  "dash.channelsNominal": { th: "ทุกช่องทำงานปกติ · {count} อิเล็กโทรด", en: "All channels nominal · {count} electrodes" },
  "dash.createShareTitle": { th: "สร้างลิงก์รายงานที่แชร์ได้", en: "Create shareable report link" },
  "dash.creating": { th: "กำลังสร้าง...", en: "Creating..." },
  "dash.shareReport": { th: "แชร์รายงาน", en: "Share Report" },
  "dash.copyLink": { th: "คัดลอกลิงก์", en: "Copy Link" },

  // --- Brainprint (page 3) ---
  "bp.title": { th: "การยืนยันตัวตนด้วย Brainprint Biometric", en: "Brainprint Biometric Authentication" },
  "bp.shareTitle": { th: "รายงาน Brainprint — {date}", en: "Brainprint Report — {date}" },
  "bp.loadingProfiles": { th: "กำลังโหลดโปรไฟล์ Brainprint...", en: "Loading Brainprint profiles..." },
  "bp.noVerified": { th: "ยังไม่มีโปรไฟล์ VERIFIED", en: "No verified profile yet" },
  "bp.noVerifiedHint": { th: "ทำการสแกนเพื่อตรวจสอบกับฐานข้อมูล Brainprint.", en: "Run a scan to check it against the Brainprint database." },
  "bp.enrolledProfiles": { th: "โปรไฟล์ที่ลงทะเบียนแล้ว ({count})", en: "Enrolled profiles ({count})" },
  "bp.scanner.capturing": { th: "กำลังจับสัญญาณประสาท...", en: "Capturing Neural Signature..." },
  "bp.scanner.matching": { th: "กำลังจับคู่กับฐานข้อมูล Brainprint...", en: "Matching against Brainprint database..." },
  "bp.scanner.captured": { th: "จับสัญญาณประสาทแล้ว", en: "Signature Captured" },
  "bp.scanner.ready": { th: "พร้อมสแกน", en: "Ready to Scan" },
  "bp.scanner.holdStill": { th: "อยู่นิ่ง — กำลังอ่านกิจกรรมของอิเล็กโทรดบริเวณหน้าผากและขมับ", en: "Hold still — reading frontal & temporal electrode activity" },
  "bp.scanner.seeResult": { th: "ดูแผงผลลัพธ์ด้านขวา", en: "See the result panel to the right" },
  "bp.scanner.placeHeadset": { th: "สวมอุปกรณ์แล้วเริ่มสแกนยืนยัน", en: "Place the headset and start a verification scan" },
  "bp.scanner.start": { th: "เริ่มสแกนยืนยัน", en: "Start Verification Scan" },
  "bp.scanner.again": { th: "สแกนอีกครั้ง", en: "Scan Again" },
  "bp.scanner.simSubject": { th: "ผู้เข้าร่วมจำลอง", en: "Simulated subject" },
  "bp.scanner.scanningAs": { th: "กำลังสแกนในฐานะ {label}", en: "Scanning as {label}" },
  "bp.verified": { th: "ยืนยันโปรไฟล์แล้ว · อนุญาตการเข้าถึง", en: "Profile Verified · Access Granted" },
  "bp.matchScore": { th: "คะแนนความตรง", en: "Match score" },
  "bp.novelty": { th: "ความแปลกใหม่ (OOD dist.)", en: "Novelty (OOD dist.)" },
  "bp.enrolledOn": { th: "ลงทะเบียนเมื่อ {date}", en: "Enrolled {date}" },
  "bp.sessions": { th: "มี {count} ครั้งในบันทึก", en: "{count} sessions on record" },
  "bp.scanAgain": { th: "สแกนอีกครั้ง", en: "Scan Again" },
  "bp.viewAnalytics": { th: "ดูในการวิเคราะห์", en: "View in Analytics" },
  "bp.unknown.title": { th: "ลายเซ็นคลื่นสมองใหม่ / ไม่รู้จัก", en: "New / Unknown Brainwave Signature" },
  "bp.unknown.body": { th: "การจับสัญญาณนี้ไม่ตรงกับโปรไฟล์ที่ลงทะเบียนใด ๆ (คะแนนตรงสูงสุด: {score}%, ต่ำกว่าเกณฑ์การยืนยัน) ตั้งชื่อเล่นให้รูปแบบนี้เพื่อเพิ่มลงฐานข้อมูล Brainprint", en: "This capture didn't match any enrolled profile (best match: {score}%, below the verification threshold). Give this pattern a nickname to add it to the Brainprint database." },
  "bp.unknown.nicknameLabel": { th: "ตั้งชื่อเล่นสำหรับรูปแบบ / บุคคลนี้", en: "Set Nickname for this Pattern / Person" },
  "bp.unknown.nicknamePlaceholder": { th: "ตัวอย่าง: \"แม่ - นั่งสมาธิ\", \"ผู้ใช้ B\"", en: 'e.g. "Mom - Meditating", "User B"' },
  "bp.unknown.dismiss": { th: "ปิด", en: "Dismiss" },
  "bp.unknown.save": { th: "บันทึกและเทรนเข้าฐานข้อมูล Brainprint", en: "Save & Train into Brainprint Database" },
  "bp.ref.filter": { th: "ตัวกรองข้อมูลอ้างอิง", en: "Reference Data Filter" },
  "bp.ref.sleepStage": { th: "ระยะการนอนหลับ", en: "Sleep Stage" },
  "bp.ref.subject": { th: "ผู้เข้าร่วม", en: "Subject" },
  "bp.ref.both": { th: "รวมทั้งสอง", en: "Both combined" },
  "bp.ref.epochs": { th: "{count} epoch", en: "{count} epochs" },
  "bp.ref.compare": { th: "เปรียบเทียบ", en: "Compare" },
  "bp.ref.loading": { th: "กำลังโหลด...", en: "Loading..." },
  "bp.ref.boxTitle": { th: "ผู้เข้าร่วมอ้างอิง", en: "Reference Subject" },
  "bp.ref.epochsRow": { th: "จำนวน epoch", en: "Epochs" },
  "bp.ref.age": { th: "อายุ", en: "Age" },
  "bp.ref.yrs": { th: "{count} ปี", en: "{count} yrs" },
  "bp.ref.sex": { th: "เพศ", en: "Sex" },
  "bp.ref.recordings": { th: "การบันทึก", en: "Recordings" },
  "bp.ref.night": { th: "คืน", en: "night" },
  "bp.ref.nights": { th: "คืน", en: "nights" },
  "bp.ref.lightsOff": { th: "ปิดไฟ {times}", en: "lights off {times}" },
  "bp.ref.datasetSuffix": { th: "(การศึกษา Sleep Cassette), PhysioNet", en: "(Sleep Cassette study), PhysioNet" },
  "bp.ref.viewPhysionet": { th: "ดูบน PhysioNet", en: "View on PhysioNet" },
  "bp.ref.fileOnPhysionet": { th: "{file} บน PhysioNet", en: "{file} on PhysioNet" },
  "bp.band.title": { th: "Band Power เทียบกับชุดข้อมูลอ้างอิง", en: "Band Power vs. Reference Dataset" },
  "bp.band.connectHint": { th: "เชื่อมต่อแหล่งข้อมูล EEG เพื่อเปรียบเทียบ band power กับค่าอ้างอิง", en: "Connect to an EEG data source to compare band power against reference values." },
  "bp.band.loading": { th: "กำลังโหลดข้อมูลอ้างอิง...", en: "Loading reference data..." },
  "bp.band.noMatch": { th: "ไม่มีข้อมูลอ้างอิงที่ตรงกับตัวกรองที่เลือก", en: "No reference data matches the selected filters." },
  "bp.band.filter": { th: "ตัวกรอง: ", en: "Filter: " },
  "bp.band.colBand": { th: "Band", en: "Band" },
  "bp.band.colYour": { th: "ค่าของคุณ", en: "Your Value" },
  "bp.band.colRef": { th: "ค่าเฉลี่ยอ้างอิง ± SD", en: "Reference Mean ± SD" },
  "bp.band.colMatch": { th: "ตรงกัน", en: "Match" },
  "bp.band.inRange": { th: "อยู่ในช่วง", en: "In Range" },
  "bp.band.outside": { th: "อยู่นอกช่วง", en: "Outside" },
  "bp.band.reference": { th: "อ้างอิง: Sleep-EDF Database Expanded", en: "Reference: Sleep-EDF Database Expanded" },
  "bp.band.selectSubject": { th: "เลือกผู้เข้าร่วมเพื่อดูจำนวน epoch", en: "Select a subject to view its epoch count" },
  "bp.band.epochCount": { th: "{id}: {count} epoch{filter}", en: "{id}: {count} epochs{filter}" },
  "bp.error.network": { th: "ข้อมูลอ้างอิงไม่พร้อมใช้งาน — backend อาจออฟไลน์", en: "Reference data unavailable — backend may be offline" },
  "bp.error.generic": { th: "โหลดข้อมูลอ้างอิงไม่สำเร็จ", en: "Failed to load reference data" },
  "bp.error.unknown": { th: "ข้อผิดพลาดที่ไม่ทราบสาเหตุ", en: "Unknown error" },
  "bp.stage.W": { th: "ตื่น", en: "Wake" },
  "bp.stage.N1": { th: "N1 (หลับตื้น 1)", en: "N1 (Light 1)" },
  "bp.stage.N2": { th: "N2 (หลับตื้น 2)", en: "N2 (Light 2)" },
  "bp.stage.N3": { th: "N3 (หลับลึก)", en: "N3 (Deep)" },
  "bp.stage.REM": { th: "REM", en: "REM" },
  "bp.stage.all": { th: "ทุกช่วงการนอน", en: "All stages" },

  // --- Analytics (page 4) ---
  "an.title": { th: "การวิเคราะห์สมองเชิง Longitudinal", en: "Longitudinal Brain Analytics" },
  "an.subtitle": { th: "burnout, ภาวะซึมเศร้า และตัวบ่งชี้การถดถอยทางปัญญาตามเวลา", en: "Burnout, depression, and cognitive-decline markers over time" },
  "an.liveTag": { th: "แนวโน้ม 30 วัน · LIVE", en: "30-day trend · live" },
  "an.chart.burnout": { th: "ความเสี่ยง burnout และภาวะอ่อนเพลียเรื้อรัง", en: "Burnout & Chronic Fatigue Risk" },
  "an.chart.burnoutSub": { th: "คะแนนความเสี่ยงรวม 0–100", en: "Composite risk score, 0–100" },
  "an.chart.faa": { th: "ความไม่สมมาตรของ alpha ด้านหน้า (FAA)", en: "Frontal Alpha Asymmetry (FAA)" },
  "an.chart.faaSub": { th: "ตัวชี้วัดความเสี่ยงภาวะซึมเศร้า", en: "Depression-risk indicator" },
  "an.chart.spindle": { th: "ความหนาแน่น Spindle ในระยะหลับ", en: "Sleep Spindle Density" },
  "an.chart.spindleSub": { th: "spindles/min · ตัวบ่งชี้การถดถอยทางปัญญาในระยะเริ่มต้น", en: "Spindles/min · early cognitive-decline marker" },
  "an.chart.sws": { th: "Slow-Wave Sleep", en: "Slow-Wave Sleep" },
  "an.chart.swsSub": { th: "% ของการนอนทั้งหมดในช่วง 3/4", en: "% of total sleep in stage 3/4" },
  "an.latest": { th: "ล่าสุด", en: "Latest" },
  "an.baseline.title": { th: "baseline ปัจจุบัน เทียบกับค่าเฉลี่ยย้อนหลัง 30 วัน", en: "Current Baseline vs. Past 30-Day Average" },
  "an.baseline.sub": { th: "ทิศทางบวกขึ้นอยู่กับตัวชี้วัด", en: "Positive direction depends on the metric" },
  "an.baseline.improving": { th: "{count}/{total} กำลังดีขึ้น", en: "{count}/{total} improving" },
  "an.baseline.avg30": { th: "ค่าเฉลี่ย 30 วัน: {value}{unit}", en: "30-day avg: {value}{unit}" },
  "an.metric.burnout": { th: "ความเสี่ยง Burnout", en: "Burnout Risk" },
  "an.metric.faa": { th: "ดัชนี FAA", en: "FAA Index" },
  "an.metric.spindle": { th: "ความหนาแน่น Spindle ในระยะหลับ", en: "Sleep Spindle Density" },
  "an.metric.sws": { th: "Slow-Wave Sleep", en: "Slow-Wave Sleep" },
  "an.tip.title": { th: "ข้อมูลเชิงลึกแนวโน้ม AI", en: "AI Trend Insight" },
  "an.tip.offline": { th: "ค่าประมาณแบบออฟไลน์", en: "Offline estimate" },
  "an.tip.live": { th: "AI แบบเรียลไทม์", en: "AI live" },
  "an.tip.offlineTitle": { th: "ค่าประมาณ rule-based ในเครื่อง (DeepSeek ออฟไลน์)", en: "Local rule-based estimate (DeepSeek offline)" },
  "an.tip.liveTitle": { th: "สร้างโดย DeepSeek AI", en: "Generated by DeepSeek AI" },
  "an.tip.loading": { th: "กำลังสรุปแนวโน้มด้วย AI…", en: "Summarizing trends with AI…" },
  "an.tip.error": { th: "ยังไม่มีสรุปในขณะนี้", en: "No summary available right now" },
  "an.tip.unauth": { th: "เข้าสู่ระบบเพื่อให้ AI สรุปแนวโน้มสุขภาพสมองของคุณ", en: "Sign in to let AI summarize your brain-health trends" },
  "an.tip.nodata": { th: "ข้อมูลยังไม่เพียงพอที่จะสรุปแนวโน้ม", en: "Not enough data yet to summarize trends" },
  "an.tip.fbImproving": { th: "แนวโน้มสุขภาพสมองโดยรวมของคุณดีขึ้นในช่วง 30 วันที่ผ่านมา", en: "Your overall brain-health trend is improving over the past 30 days" },
  "an.tip.fbFlat": { th: "แนวโน้มสุขภาพสมองโดยรวมของคุณคงที่หรือมีความผันผวนในช่วง 30 วันที่ผ่านมา", en: "Your overall brain-health trend is holding steady or mixed over the past 30 days" },
  "an.tip.fbTail": { th: "คำแนะนำเบื้องต้น: โปรดติดตามตัวชี้วัดเหล่านี้ต่อไป และพิจารณาปรึกษาผู้เชี่ยวชาญหากคุณสังเกตเห็นความผันผวนผิดปกติ (นี่คือการคัดกรองเบื้องต้น ไม่ใช่การวินิจฉัย)", en: "Preliminary advice: keep tracking these indicators and consider consulting a specialist if you notice abnormal fluctuations (this is preliminary screening, not a diagnosis)" },

  // --- AI Consultant (page 5) ---
  "ai.title": { th: "ที่ปรึกษา Neuro AI", en: "AI Neuro-Consultant" },
  "ai.poweredBy": { th: "ขับเคลื่อนด้วย DeepSeek AI", en: "Powered by DeepSeek AI" },
  "ai.welcomeNoAuth": { th: "ยินดีต้อนรับ กรุณาเข้าสู่ระบบเพื่อเริ่มบทสนทนากับที่ปรึกษา Neuro AI", en: "Welcome. Please sign in to start a conversation with the AI Neuro-Consultant." },
  "ai.welcome": { th: "ฉันคือที่ปรึกษา Neuro ของคุณ ถามฉันเกี่ยวกับสุขภาพสมอง โปรโตคอล recovery หรือการวิเคราะห์ EEG ได้", en: "I'm your Neuro-Consultant. Ask me about your brain health, recovery protocols, or EEG analysis." },
  "ai.histError": { th: "โหลดประวัติการแชทไม่สำเร็จ", en: "Failed to load chat history" },
  "ai.notAuth": { th: "ยังไม่ได้ยืนยันตัวตน กรุณาเข้าสู่ระบบ", en: "Not authenticated. Please log in." },
  "ai.unknownError": { th: "ข้อผิดพลาดที่ไม่ทราบสาเหตุ", en: "Unknown error" },
  "ai.error": { th: "ข้อผิดพลาด", en: "Error" },
  "ai.errorPrefix": { th: "ข้อผิดพลาด: {message}", en: "Error: {message}" },
  "ai.statusLiveTitle": { th: "เชื่อมต่อ DeepSeek AI แล้ว — วิเคราะห์จริง", en: "Connected to DeepSeek AI — real analysis" },
  "ai.live": { th: "Live", en: "Live" },
  "ai.analyzing": { th: "กำลังวิเคราะห์รูปแบบประสาท…", en: "Analyzing neural patterns…" },
  "ai.chip.analyze": { th: "วิเคราะห์สถานะสมองของฉันในขณะนี้", en: "Analyze my current brain state" },
  "ai.chip.stress": { th: "ทำไมความเครียดของฉันถึงสูง?", en: "Why is my stress high?" },
  "ai.chip.recovery": { th: "สร้างโปรโตคอล recovery", en: "Generate a recovery protocol" },
  "ai.chip.bands": { th: "อธิบายแถบคลื่น EEG ของฉัน", en: "Explain my EEG bands" },
  "ai.inputPlaceholder": { th: "ถามเกี่ยวกับสุขภาพสมองของคุณ…", en: "Ask about your brain health…" },
  "ai.diag.title": { th: "การวินิจฉัย AI รายวันอัตโนมัติ", en: "Automated Daily AI Diagnostics" },
  "ai.diag.empty": { th: "ยังไม่มีข้อมูลวินิจฉัย", en: "No diagnostics yet" },
  "ai.diag.emptyHint": { th: "เชื่อมต่อ EEG Stream แบบสดและทำสแกน Brainprint ให้เสร็จ เพื่อสร้างข้อมูลเชิงลึกประจำวันอัตโนมัติที่นี่", en: "Connect a live EEG stream and complete a Brainprint scan to generate automated daily insights here." }

};

const MISSING_KEY = "[missing:";

/**
 * Look up a translation. Falls back to the key name (with a marker) if the
 * key is unknown, so missing strings are visible in the UI during dev.
 */
export function translate(
  lang: Language,
  key: string,
  vars?: Record<string, string | number>
): string {
  const entry = translations[key];
  let text: string;
  if (!entry) {
    text = `${MISSING_KEY}${key}]`;
  } else {
    text = entry[lang];
  }
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return text;
}
