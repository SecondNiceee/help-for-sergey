const express = require("express")
const next = require("next")

const dev = process.env.NODE_ENV !== "production"
const app = next({ dev, dir: __dirname })
const handle = app.getRequestHandler()

// Custom User-Agent for health checks
const USER_AGENT = "Mozilla/5.0+ (compatible; HealthChecker/1.0; САЙТГДЕЛЕЖИТМОНИТОРИНГ)"

// In-memory storage for status and history (keep last 10)
let statusStore = {
  success: false,
  timestamp: new Date().toISOString(),
  message: "Waiting for first check...",
  responseTime: 0,
  statusCode: null,
}
let historyStore = []

// Function to check CDEK API
async function checkCDEK() {
  const startTime = Date.now()
  console.log("[CDEK Monitor] Starting check...")

  try {
    const response = await fetch("https://lk.smartcardio.ru/cdek", {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(10000),
      cache: "no-cache",
      redirect: "manual",
    })

    const responseTime = Date.now() - startTime

    statusStore = {
      success: response.status >= 200 && response.status < 400,
      timestamp: new Date().toISOString(),
      message: (response.status >= 200 && response.status < 400)
        ? `Success: ${response.status} ${response.statusText}`
        : `Error: ${response.status} ${response.statusText}`,
      responseTime,
      statusCode: response.status,
    }

    historyStore.push(statusStore)
    if (historyStore.length > 10) historyStore.shift()

    console.log("[CDEK Monitor] Check completed:", statusStore)
  } catch (error) {
    const responseTime = Date.now() - startTime

    statusStore = {
      success: false,
      timestamp: new Date().toISOString(),
      message: error.message || "Unknown error",
      responseTime,
      statusCode: null,
    }

    historyStore.push(statusStore)
    if (historyStore.length > 10) historyStore.shift()

    console.log("[CDEK Monitor] Check failed:", statusStore)
  }
}

app.prepare().then(() => {
  const server = express()

  // API endpoint to get current status
  server.get("/api/status", (req, res) => {
    res.json({ latest: statusStore, history: historyStore })
  })

  // API endpoint to trigger manual check (support POST from client)
  server.post("/api/check-now", async (req, res) => {
    await checkCDEK()
    res.json({ success: true, status: { latest: statusStore, history: historyStore } })
  })

  // Handle all other routes with Next.js
  server.all(/.*/, (req, res) => {
    return handle(req, res)
  })

  const PORT = process.env.PORT || 3000

  server.listen(PORT, (err) => {
    if (err) throw err
    console.log(`> Ready on http://localhost:${PORT}`)
    console.log("[CDEK Monitor] Starting background checks every 60 seconds...")

    // Run first check immediately
    checkCDEK()

    // Then run every 60 seconds
    setInterval(checkCDEK, 60000)
  })
})
