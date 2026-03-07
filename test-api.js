const apiKey = "AIzaSyDlHnh6qW02uZS35Wxd1uqsVDbJxKx_GbQ"; // Key 1
const models = [
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-pro"
];

async function checkModels() {
  console.log("Checking models for Key 1...");
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] })
      });
      const data = await resp.json();
      if (resp.ok) {
        console.log(`[OK] ${model}`);
      } else {
        console.log(`[FAIL] ${model}: ${resp.status} - ${data.error?.message}`);
      }
    } catch (e) {
      console.log(`[ERR] ${model}: ${e.message}`);
    }
  }
}

checkModels();
