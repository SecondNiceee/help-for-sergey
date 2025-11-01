"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Clock, Activity, RefreshCw, TrendingUp } from "lucide-react"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface RequestLog {
  success: boolean
  timestamp: string
  statusCode: number
  message: string
  responseTime: number
}

interface StatusResponse {
  latest: RequestLog
  history: RequestLog[]
}

export default function MonitoringPage() {
  const [status, setStatus] = useState<RequestLog | null>(null)
  const [history, setHistory] = useState<RequestLog[]>([])
  const [isChecking, setIsChecking] = useState(false)

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/status")
      const data: StatusResponse = await response.json()
      setStatus(data.latest)
      setHistory(data.history)
    } catch (error) {
      console.error("Failed to fetch status:", error)
    }
  }

  const checkNow = async () => {
    setIsChecking(true)
    try {
      await fetch("/api/check-now", { method: "POST" })
      setTimeout(fetchStatus, 1000)
    } catch (error) {
      console.error("Failed to trigger check:", error)
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const formatChartTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const chartData = [...history].reverse().map((log) => ({
    time: formatChartTime(log.timestamp),
    responseTime: log.responseTime,
    statusCode: log.statusCode,
    success: log.success,
  }))

  const avgResponseTime =
    history.length > 0 ? Math.round(history.reduce((sum, log) => sum + log.responseTime, 0) / history.length) : 0

  const successRate =
    history.length > 0 ? Math.round((history.filter((log) => log.success).length / history.length) * 100) : 0

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Main Status Card */}
        <Card className="mb-8 overflow-hidden border-2">
          <div className={`p-8 ${status?.success ? "bg-emerald-500/5" : "bg-red-500/5"}`}>
            <div className="flex items-start justify-between gap-8">
              <div className="flex flex-col items-center justify-center">
                <div
                  className={`text-9xl font-bold font-mono tracking-tight ${
                    status?.success ? "text-emerald-500" : "text-red-500"
                  }`}
                >
                  {status?.statusCode || "—"}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">HTTP Status Code</p>
              </div>

              <div className="flex-1">
                <div className="mb-4 flex items-center gap-3">
                  {status?.success ? (
                    <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                  ) : (
                    <XCircle className="h-12 w-12 text-red-500" />
                  )}
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      {status?.success ? "Система работает" : "Ошибка подключения"}
                    </h2>
                    <p className="text-sm text-muted-foreground">https://api.smartcardio.ru/ping</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-background/50 p-4">
                    <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Последняя проверка</span>
                    </div>
                    <p className="font-mono text-sm font-medium text-foreground">
                      {status ? formatTime(status.timestamp) : "—"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-background/50 p-4">
                    <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Activity className="h-4 w-4" />
                      <span>Время ответа</span>
                    </div>
                    <p className="font-mono text-sm font-medium text-foreground">
                      {status ? `${status.responseTime}ms` : "—"}
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={checkNow} disabled={isChecking} size="lg" className="ml-4">
                <RefreshCw className={`mr-2 h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
                Проверить сейчас
              </Button>
            </div>
          </div>
        </Card>

        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <Card className="p-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Средний ответ</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-bold text-foreground">{avgResponseTime}ms</p>
            <p className="mt-1 text-xs text-muted-foreground">За последние {history.length} запросов</p>
          </Card>

          <Card className="p-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Успешность</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-foreground">{successRate}%</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {history.filter((log) => log.success).length} из {history.length} успешных
            </p>
          </Card>

          <Card className="p-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Всего запросов</span>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-bold text-foreground">{history.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Хранится последние 10</p>
          </Card>
        </div>

        {chartData.length > 0 && (
          <Card className="mb-8 p-6">
            <h3 className="mb-6 text-xl font-semibold text-foreground">История запросов</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" className="text-xs" stroke="hsl(var(--muted-foreground))" />
                <YAxis className="text-xs" stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="responseTime"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="Время ответа (ms)"
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {history.length > 0 && (
          <Card className="mb-8 overflow-hidden">
            <div className="p-6">
              <h3 className="mb-4 text-xl font-semibold text-foreground">Последние запросы</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Статус</th>
                      <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Код</th>
                      <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Время ответа</th>
                      <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Время проверки</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((log, index) => (
                      <tr key={index} className="border-b border-border last:border-0">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {log.success ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-sm text-foreground">{log.success ? "Успешно" : "Ошибка"}</span>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className="font-mono text-sm text-foreground">{log.statusCode || "—"}</span>
                        </td>
                        <td className="py-3">
                          <span className="font-mono text-sm text-foreground">{log.responseTime}ms</span>
                        </td>
                        <td className="py-3">
                          <span className="text-sm text-muted-foreground">{formatTime(log.timestamp)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        )}

        {/* Info Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-6">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">Автоматические проверки</h3>
            <p className="text-sm text-muted-foreground">
              Система автоматически проверяет доступность API каждую минуту через Vercel Cron
            </p>
          </Card>

          <Card className="p-6">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">Мониторинг в реальном времени</h3>
            <p className="text-sm text-muted-foreground">
              Статус обновляется автоматически каждые 5 секунд без перезагрузки страницы
            </p>
          </Card>

          <Card className="p-6">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">Независимая работа</h3>
            <p className="text-sm text-muted-foreground">
              Проверки выполняются на сервере независимо от того, открыт ли лэндинг
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
