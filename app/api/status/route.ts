import { NextResponse } from "next/server"
import { getRequestHistory } from "@/lib/request-storage"

export async function GET() {
  const startTime = Date.now()

  try {
    const response = await fetch("https://lk.smartcardio.ru/cdek", {
      method: "GET",
      headers: {
        "User-Agent": "CDEK-Monitor/1.0",
      },
      signal: AbortSignal.timeout(10000),
    })

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      latest: {
        success: response.ok,
        timestamp: new Date().toISOString(),
        statusCode: response.status,
        message: response.ok
          ? `Success: ${response.status} ${response.statusText}`
          : `Error: ${response.status} ${response.statusText}`,
        responseTime,
      },
      history: getRequestHistory(),
    })
  } catch (error) {
    const responseTime = Date.now() - startTime

    return NextResponse.json({
      latest: {
        success: false,
        timestamp: new Date().toISOString(),
        statusCode: 0,
        message: error instanceof Error ? error.message : "Unknown error",
        responseTime,
      },
      history: getRequestHistory(),
    })
  }
}
