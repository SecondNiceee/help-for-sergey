const express = require("express")
const next = require("next")

const dev = process.env.NODE_ENV !== "production"
const app = next({ dev, dir: __dirname })
const handle = app.getRequestHandler()

// === Telegram Bot Config ===
const TELEGRAM_BOT_TOKEN = "8420130408:AAFOo4Gkz3dTAfPXE3sA-nrpjm9FenxifIs" // например: "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
const TELEGRAM_CHAT_ID = "-1003212760063"  // например: "-1001234567890" или "123456789"

// === Constants ===
const USER_AGENT = "Mozilla/5.0 (compatible; HealthChecker/1.0; https://help-for-sergey.onrender.com/)"
const CHECK_URL = "https://lk.smartcardio.ru/cdek"

// === State ===
let statusStore = {
  success: false,
  timestamp: new Date().toISOString(),
  message: "Waiting for first check...",
  responseTime: 0,
  statusCode: null,
}
let historyStore = []
let wasDown = false // флаг: был ли сервис недоступен на предыдущей проверке

// === Telegram sender ===
async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("[Telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID — skipping notification")
    return
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        disable_notification: false,
      }),
    })

    if (!response.ok) {
      console.error("[Telegram] Failed to send message:", await response.text())
    } else {
      console.log("[Telegram] Message sent:", text)
    }
  } catch (err) {
    console.error("[Telegram] Error sending message:", err.message)
  }
}

// === CDEK Checker ===
async function checkCDEK() {
  const startTime = Date.now()
  console.log("[CDEK Monitor] Starting check...")

  try {
    const response = await fetch(CHECK_URL, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10000),
      cache: "no-cache",
      redirect: "manual",
    })

    const responseTime = Date.now() - startTime
    const isOk = response.status >= 200 && response.status < 400

    const newStatus = {
      success: isOk,
      timestamp: new Date().toISOString(),
      message: isOk
        ? `Success: ${response.status} ${response.statusText}`
        : `Error: ${response.status} ${response.statusText}`,
      responseTime,
      statusCode: response.status,
    }

    // === Логика уведомлений ===
    if (isOk && wasDown) {
      // Сервис восстановился!
      await sendTelegramMessage("✅ Сервис опять заработал!")
      wasDown = false
    } else if (!isOk && !wasDown) {
      // Только что упал
      await sendTelegramMessage("⚠️ Сервис перестал работать!")
      wasDown = true
    }
    // Если уже был down — не отправляем повторно

    // Обновляем статус
    statusStore = newStatus
    historyStore.push(statusStore)
    if (historyStore.length > 10) historyStore.shift()

    console.log("[CDEK Monitor] Check completed:", statusStore)
  } catch (error) {
    const responseTime = Date.now() - startTime

    const newStatus = {
      success: false,
      timestamp: new Date().toISOString(),
      message: error.message || "Unknown error",
      responseTime,
      statusCode: null,
    }

    // === Уведомление при падении ===
    if (!wasDown) {
      await sendTelegramMessage("⚠️ Сервис перестал работать!")
      wasDown = true
    }

    statusStore = newStatus
    historyStore.push(statusStore)
    if (historyStore.length > 10) historyStore.shift()

    console.log("[CDEK Monitor] Check failed:", statusStore)
  }
}

// === Express Server ===
app.prepare().then(() => {
  const server = express()

  server.get("/api/status", (req, res) => {
    res.json({ latest: statusStore, history: historyStore, wasDown })
  })

  server.post("/api/check-now", async (req, res) => {
    await checkCDEK()
    res.json({ success: true, status: { latest: statusStore, history: historyStore, wasDown } })
  })

  server.all(/.*/, (req, res) => {
    return handle(req, res)
  })

  const PORT = process.env.PORT || 3000

  server.listen(PORT, (err) => {
    if (err) throw err
    console.log(`> Ready on http://localhost:${PORT}`)
    console.log("[CDEK Monitor] Starting background checks every 60 seconds...")

    checkCDEK()
    setInterval(checkCDEK, 60000)
  })
})