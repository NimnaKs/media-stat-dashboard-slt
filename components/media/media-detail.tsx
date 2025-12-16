"use client"

import { useEffect, useState } from "react"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import { fetchBreakdown, fetchMediaStats, type MediaStats } from "@/lib/stats-api"
import { fetchEpisodesByTVShowId, type Episode } from "@/lib/ott-api"

interface DailyStats {
  date: string
  viewers: number
  watchTime: number
}

interface EpisodeStat extends Episode {
  stats: MediaStats | null
}

interface MediaDetailProps {
  mediaId: number
  mediaType: string
  title: string
  tenantId: string
  onBack?: () => void
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"]

interface BreakdownStat {
  name: string
  uniqueUserCount: number
  totalWatchTime: number
  [key: string]: any
}

export default function MediaDetail({ mediaId, mediaType, title, tenantId, onBack }: MediaDetailProps) {
  const [stats, setStats] = useState<MediaStats | null>(null)
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [deviceStats, setDeviceStats] = useState<BreakdownStat[]>([])
  const [interfaceStats, setInterfaceStats] = useState<BreakdownStat[]>([])
  const [episodeStats, setEpisodeStats] = useState<EpisodeStat[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBreakdown, setSelectedBreakdown] = useState<{
    type: "device" | "interface"
    value: string
  } | null>(null)
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeStat | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        // Get last 7 days dates in Sri Lanka time
        const dates = Array.from({ length: 7 }, (_, i) => {
          const d = new Date()
          d.setDate(d.getDate() - i)
          return d.toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" }) // YYYY-MM-DD format
        }).reverse()

        const [statsRes, ...dailyRes] = await Promise.all([
          fetch(`https://media-stat.rumex.lk/watch-sessions/combined?mediaId=${mediaId}&mediaType=${mediaType}`, {
            headers: { "X-Tenant-Id": tenantId },
          }),
          ...dates.map((date) =>
            fetch(
              `https://media-stat.rumex.lk/watch-sessions/stats-by-date?mediaId=${mediaId}&mediaType=${mediaType}&date=${date}`,
              { headers: { "X-Tenant-Id": tenantId } },
            ),
          ),
        ])

        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setStats(statsData)
        }

        const dailyData = await Promise.all(
          dailyRes.map(async (res, index) => {
            if (res.ok) {
              const data = await res.json()
              return {
                date: dates[index],
                viewers: data ? data.uniqueUserCount || 0 : 0,
                watchTime: data ? Math.round((data.totalWatchTime || 0) / 3600) : 0,
              }
            }
            return { date: dates[index], viewers: 0, watchTime: 0 }
          }),
        )
        setDailyStats(dailyData)

        // Fetch Breakdowns
        // Fetch Breakdowns
        const filters = selectedBreakdown
          ? { [selectedBreakdown.type === "device" ? "deviceType" : "interfaceType"]: selectedBreakdown.value }
          : {}

        const devices = await fetchBreakdown(
          tenantId,
          mediaId,
          mediaType,
          "deviceType",
          ["DESKTOP", "MOBILE", "TABLET", "TV"],
          filters,
        )
        setDeviceStats(devices)

        const interfaces = await fetchBreakdown(
          tenantId,
          mediaId,
          mediaType,
          "interfaceType",
          ["WEB", "ANDROID", "IOS", "IPAD"],
          filters,
        )
        setInterfaceStats(interfaces)

        // Fetch Episode Stats if TV Show
        if (mediaType === "TV_SHOW") {
          try {
            const episodes = await fetchEpisodesByTVShowId(mediaId)
            const episodesWithStats = await Promise.all(
              episodes.map(async (ep) => {
                try {
                  const epStats = await fetchMediaStats(tenantId, ep.id, "TV_EPISODE")
                  return { ...ep, stats: epStats }
                } catch {
                  return { ...ep, stats: null }
                }
              }),
            )
            const filteredEpisodes = episodesWithStats
              .filter((ep) => {
                const title = ep.title.titleEn || ep.title.titleSi || ep.title.titleTa || "Untitled"
                const lowerTitle = title.toLowerCase()
                return !lowerTitle.includes("title not available") && !lowerTitle.includes("not available")
              })
              .sort((a, b) => a.episodeNo - b.episodeNo)
            setEpisodeStats(filteredEpisodes)
          } catch (e) {
            console.error("Failed to fetch episodes", e)
          }
        }
      } catch (err) {
        console.error("Failed to fetch media details:", err)
      } finally {
        setLoading(false)
      }
    }

    if (mediaId && tenantId) {
      fetchData()
    }
  }, [mediaId, mediaType, tenantId, selectedBreakdown])

  const formatWatchTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600) // Corrected division
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  if (loading) {
    return <div className="bg-card border border-border rounded-lg p-8 h-96 animate-pulse" />
  }

  if (!stats) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <p className="text-muted">No data available</p>
      </div>
    )
  }

  if (selectedEpisode) {
    return (
      <MediaDetail
        mediaId={selectedEpisode.id}
        mediaType="TV_EPISODE"
        title={
          selectedEpisode.title.titleEn ||
          selectedEpisode.title.titleSi ||
          selectedEpisode.title.titleTa ||
          "Episode"
        }
        tenantId={tenantId}
        onBack={() => setSelectedEpisode(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-foreground">{stats.title || title}</h2>
          {onBack && (
            <button onClick={onBack} className="text-sm text-primary hover:underline">
              ← Back to Show
            </button>
          )}
        </div>
        <p className="text-sm text-muted mb-6">{stats.mediaType}</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-background border border-border rounded p-4">
            <p className="text-muted text-xs font-medium mb-1">Total Watch Time</p>
            <p className="text-2xl font-bold text-accent">{formatWatchTime(stats.totalWatchTime)}</p>
          </div>
          <div className="bg-background border border-border rounded p-4">
            <p className="text-muted text-xs font-medium mb-1">Unique Viewers</p>
            <p className="text-2xl font-bold text-primary">{stats.uniqueUserCount.toLocaleString()}</p>
          </div>
        </div>

        {/* Breakdown Section */}
        {/*<div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">
              {selectedBreakdown
                ? `${selectedBreakdown.type === "device" ? selectedBreakdown.value : selectedBreakdown.value} Statistics`
                : "Audience Breakdown"}
            </h3>
            {selectedBreakdown && (
              <button
                onClick={() => setSelectedBreakdown(null)}
                className="text-sm text-primary hover:underline"
              >
                ← Back to Overview
              </button>
            )}
          </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Device Distribution 
            {(selectedBreakdown?.type !== "interface" || selectedBreakdown === null) && (
              <div className={selectedBreakdown?.type === "device" ? "col-span-2 grid grid-cols-2 gap-8" : ""}>
                 <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted text-center">
                    {selectedBreakdown?.type === "device" ? "Interface Watch Time" : "Device Watch Time"}
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={selectedBreakdown?.type === "device" ? interfaceStats : deviceStats}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          fill="#8884d8"
                          paddingAngle={5}
                          dataKey="totalWatchTime"
                          onClick={(data) => {
                            if (!selectedBreakdown) {
                              setSelectedBreakdown({ type: "device", value: data.name })
                            }
                          }}
                          cursor={!selectedBreakdown ? "pointer" : "default"}
                        >
                          {(selectedBreakdown?.type === "device" ? interfaceStats : deviceStats).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-slate-900 border border-slate-800 p-2 rounded shadow-lg">
                                  <p className="text-slate-200 font-medium">{payload[0].name}</p>
                                  <p className="text-slate-400 text-sm">
                                    {formatWatchTime(payload[0].value as number)}
                                  </p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted text-center">
                     {selectedBreakdown?.type === "device" ? "Interface Unique Users" : "Device Unique Users"}
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={selectedBreakdown?.type === "device" ? interfaceStats : deviceStats}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          fill="#82ca9d"
                          paddingAngle={5}
                          dataKey="uniqueUserCount"
                           onClick={(data) => {
                            if (!selectedBreakdown) {
                              setSelectedBreakdown({ type: "device", value: data.name })
                            }
                          }}
                          cursor={!selectedBreakdown ? "pointer" : "default"}
                        >
                          {(selectedBreakdown?.type === "device" ? interfaceStats : deviceStats).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgb(19, 27, 61)",
                            border: "1px solid rgb(30, 41, 59)",
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )} 

             Interface Distribution 
            {(selectedBreakdown?.type !== "device" || selectedBreakdown === null) && (
               <div className={selectedBreakdown?.type === "interface" ? "col-span-2 grid grid-cols-2 gap-8" : ""}>
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted text-center">
                    {selectedBreakdown?.type === "interface" ? "Device Watch Time" : "Interface Watch Time"}
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={selectedBreakdown?.type === "interface" ? deviceStats : interfaceStats}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          fill="#8884d8"
                          paddingAngle={5}
                          dataKey="totalWatchTime"
                           onClick={(data) => {
                            if (!selectedBreakdown) {
                              setSelectedBreakdown({ type: "interface", value: data.name })
                            }
                          }}
                          cursor={!selectedBreakdown ? "pointer" : "default"}
                        >
                          {(selectedBreakdown?.type === "interface" ? deviceStats : interfaceStats).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                         <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-slate-900 border border-slate-800 p-2 rounded shadow-lg">
                                  <p className="text-slate-200 font-medium">{payload[0].name}</p>
                                  <p className="text-slate-400 text-sm">
                                    {formatWatchTime(payload[0].value as number)}
                                  </p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted text-center">
                    {selectedBreakdown?.type === "interface" ? "Device Unique Users" : "Interface Unique Users"}
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={selectedBreakdown?.type === "interface" ? deviceStats : interfaceStats}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          fill="#82ca9d"
                          paddingAngle={5}
                          dataKey="uniqueUserCount"
                           onClick={(data) => {
                            if (!selectedBreakdown) {
                              setSelectedBreakdown({ type: "interface", value: data.name })
                            }
                          }}
                          cursor={!selectedBreakdown ? "pointer" : "default"}
                        >
                          {(selectedBreakdown?.type === "interface" ? deviceStats : interfaceStats).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgb(19, 27, 61)",
                            border: "1px solid rgb(30, 41, 59)",
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div> 
        </div> */}
      </div>

      {dailyStats.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Daily Statistics</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(30, 41, 59)" />
              <XAxis dataKey="date" stroke="rgb(100, 116, 139)" />
              <YAxis stroke="rgb(100, 116, 139)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgb(19, 27, 61)",
                  border: "1px solid rgb(30, 41, 59)",
                }}
              />
              <Bar dataKey="viewers" fill="rgb(59, 130, 246)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {mediaType === "TV_SHOW" && episodeStats.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Episode Statistics</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted uppercase bg-background/50">
                <tr>
                  <th className="px-4 py-3">Episode</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Watch Time</th>
                  <th className="px-4 py-3">Viewers</th>
                </tr>
              </thead>
              <tbody>
                {episodeStats.map((ep) => (
                  <tr
                    key={ep.id}
                    className="border-b border-border hover:bg-border/30 cursor-pointer"
                    onClick={() => setSelectedEpisode(ep)}
                  >
                    <td className="px-4 py-3 font-medium">E{ep.episodeNo}</td>
                    <td className="px-4 py-3">{ep.title.titleEn || ep.title.titleSi || ep.title.titleTa}</td>
                    <td className="px-4 py-3">
                      {ep.stats ? formatWatchTime(ep.stats.totalWatchTime) : "-"}
                    </td>
                    <td className="px-4 py-3">{ep.stats ? ep.stats.uniqueUserCount : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
