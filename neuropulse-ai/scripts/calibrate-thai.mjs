// Calibration: can I emit the intended Thai codepoints?
// I type each word (no-tone-marks house style); expected hex is derived
// independently from Unicode values. A systematic emitter bug (dropped
// vowel, wrong consonant) shows up as FAIL.
const cases = [
  // [label, wordInThai, expectedCodepoints (no tone marks)]
  ["stream", "สตรีม", "0E2A 0E15 0E23 0E35 0E21"],
  ["connect", "เชื่อมตอ", "0E40 0E0A 0E37 0E2D 0E21 0E15 0E2D"],
  ["load", "โหลด", "0E42 0E25 0E25 0E14"],
  ["verify", "ยืมยน", "0E22 0E37 0E19 0E22 0E31 0E19"],
  ["data", "ขอมูล", "0E02 0E2D 0E21 0E39 0E25"],
  ["password", "รหสผาน", "0E23 0E25 0E2A 0E1C 0E32 0E19"],
  ["analyze", "วิเคราะห", "0E27 0E34 0E04 0E23 0E40 0E2D 0E30 0E2B 0E4C"],
  ["brain", "สมอง", "0E2A 0E21 0E2D 0E07"],
  ["home-face", "หนา", "0E25 0E19 0E32"],
  ["main", "ลัก", "0E25 0E31 0E01"],
  ["wave", "คลืน", "0E04 0E25 0E35 0E19 0E19"],
  ["signal", "สญั ญาณ", "0E2A 0E19 0E22 0E48 0E07"],
];

const hex = (s) => [...s].map((c) => c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")).join(" ");

let ok = 0, bad = 0;
for (const [label, my, exp] of cases) {
  const got = hex(my);
  const pass = got === exp;
  pass ? ok++ : bad++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) {
    console.log(`   mine:  ${my}`);
    console.log(`   got:   ${got}`);
    console.log(`   want:  ${exp}`);
  }
}
console.log(`\n${ok} pass, ${bad} fail of ${cases.length}`);
