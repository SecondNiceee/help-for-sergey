const express = require("express")
const next = require("next")

const dev = process.env.NODE_ENV !== "production"
const app = next({ dev, dir: __dirname })
const handle = app.getRequestHandler()

// === Telegram Bot Config ===
const TELEGRAM_BOT_TOKEN = "8420130408:AAFOo4Gkz3dTAfPXE3sA-nrpjm9FenxifIs"
const TELEGRAM_CHAT_ID = "-1003212760063"

// === Constants ===
const USER_AGENT = "Mozilla/5.0 (compatible; HealthChecker/1.0; https://help-for-sergey.onrender.com/)"
const CHECK_URL = "https://api.smartcardio.ru/ping"

// === State ===
let statusStore = {
  success: false,
  timestamp: new Date().toISOString(),
  message: "Waiting for first check...",
  responseTime: 0,
  statusCode: null,
}
let historyStore = []
let lastKnownStatusCode = null // для отслеживания изменений

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

// === SmartCardio Ping Checker ===
async function checkCDEK() {
  const startTime = Date.now()
  console.log("[SmartCardio Monitor] Starting check...")

  try {
    const response = await fetch(CHECK_URL, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10000),
      cache: "no-cache",
      redirect: "manual",
    })

    const responseTime = Date.now() - startTime
    const bodyText = await response.text()
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

    // === Формируем тело для Telegram ===
    const snippet = bodyText.substring(0, 200).replace(/\n/g, " ").trim()
    const telegramMessage = `GET ${CHECK_URL}\n${response.status} ${response.statusText}\n${snippet}`

    // === Отправляем, если статус изменился (включая тело) ===
    const currentKey = response.status === 200 && bodyText ? "200+" + (bodyText.length > 0 ? "content" : "empty") : String(response.status)
    if (lastKnownStatusCode !== currentKey) {
      await sendTelegramMessage(telegramMessage)
      lastKnownStatusCode = currentKey
    }

    statusStore = newStatus
    historyStore.push(newStatus)
    if (historyStore.length > 10) historyStore.shift()

    console.log("[SmartCardio Monitor] Check completed:", newStatus)
  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error.message || "Unknown error"

    const newStatus = {
      success: false,
      timestamp: new Date().toISOString(),
      message: errorMessage,
      responseTime,
      statusCode: null,
    }

    const telegramMessage = `GET ${CHECK_URL}\n⚠️ Ошибка: ${errorMessage}\n(время до ошибки: ${responseTime} мс)`

    if (lastKnownStatusCode !== "ERROR") {
      await sendTelegramMessage(telegramMessage)
      lastKnownStatusCode = "ERROR"
    }

    statusStore = newStatus
    historyStore.push(newStatus)
    if (historyStore.length > 10) historyStore.shift()

    console.log("[SmartCardio Monitor] Check failed:", newStatus)
  }
}

// === Express Server ===
app.prepare().then(() => {
  const server = express()

  server.get("/api/status", (req, res) => {
    res.json({ latest: statusStore, history: historyStore, lastKnownStatusCode })
  })

  server.post("/api/check-now", async (req, res) => {
    await checkCDEK()
    res.json({ success: true, status: { latest: statusStore, history: historyStore, lastKnownStatusCode } })
  })

  server.all(/.*/, (req, res) => {
    return handle(req, res)
  })

  const PORT = process.env.PORT || 3000

  server.listen(PORT, (err) => {
    if (err) throw err
    console.log(`> Ready on http://localhost:${PORT}`)
    console.log("[SmartCardio Monitor] Starting background checks every 60 seconds...")

    checkCDEK()
    setInterval(checkCDEK, 60000)
  })
})
