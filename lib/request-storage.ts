// In-memory storage for the last 10 requests
// This will reset on serverless cold starts, but that's acceptable

export interface RequestLog {
  success: boolean
  timestamp: string
  statusCode: number
  message: string
  responseTime: number
}

// Module-level variable to store requests
let requestHistory: RequestLog[] = []

export function addRequest(log: RequestLog) {
  requestHistory.unshift(log) // Add to beginning
  if (requestHistory.length > 10) {
    requestHistory = requestHistory.slice(0, 10) // Keep only last 10
  }
}

export function getRequestHistory(): RequestLog[] {
  return requestHistory
}

export function getLatestRequest(): RequestLog | null {
  return requestHistory[0] || null
}
