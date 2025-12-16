"use client"

import { useEffect, useState } from "react"

interface OverallStatsData {
  totalWatchTime: number
  distinctUsers: number
}

export default function OverallStats({ tenantId }: { tenantId: string }) {
  const [stats, setStats] = useState<OverallStatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`https://media-stat.rumex.lk/watch-sessions/overall`, {
          headers: {
            "X-Tenant-Id": tenantId,
          },
        })
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (err) {
        console.error("Failed to fetch overall stats:", err)
      } finally {
        setLoading(false)
      }
    }

    if (tenantId) {
      fetchStats()
    }
  }, [tenantId])

  const formatWatchTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
        <p className="text-muted text-sm font-medium mb-2">Total Watch Time</p>
        <p className="text-4xl font-bold text-accent">{loading ? "-" : formatWatchTime(stats?.totalWatchTime || 0)}</p>
      </div>
      <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
        <p className="text-muted text-sm font-medium mb-2">Distinct Users</p>
        <p className="text-4xl font-bold text-primary">
          {loading ? "-" : (stats?.distinctUsers || 0).toLocaleString()}
        </p>
      </div>
    </div>
  )
}
