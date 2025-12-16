"use client"

import { useEffect, useState } from "react"
import { fetchTopMedia, type TopMediaItem } from "@/lib/stats-api"
import { fetchMovieById, fetchTVShowById, type Movie, type TVShow } from "@/lib/ott-api"

type TabType = "all" | "movies" | "tvshows"

interface EnrichedMediaItem extends TopMediaItem {
  details?: Movie | TVShow
}

export default function TopMediaList({ tenantId }: { tenantId: string }) {
  const [activeTab, setActiveTab] = useState<TabType>("all")
  const [data, setData] = useState<EnrichedMediaItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        let items: TopMediaItem[] = []

        if (activeTab === "all") {
          const [movies, tvShows] = await Promise.all([
            fetchTopMedia(tenantId, "MOVIE", 10),
            fetchTopMedia(tenantId, "TV_SHOW", 10),
          ])
          items = [...movies, ...tvShows]
            .sort((a, b) => b.totalWatchTime - a.totalWatchTime)
            .slice(0, 10)
        } else if (activeTab === "movies") {
          items = await fetchTopMedia(tenantId, "MOVIE", 10)
        } else {
          items = await fetchTopMedia(tenantId, "TV_SHOW", 10)
        }

        // Fetch full details for each item
        const enrichedItems: EnrichedMediaItem[] = await Promise.all(
          items.map(async (item) => {
            try {
              let details
              if (item.mediaType === "MOVIE") {
                details = await fetchMovieById(item.mediaId)
              } else if (item.mediaType === "TV_SHOW") {
                details = await fetchTVShowById(item.mediaId)
              }
              return { ...item, details }
            } catch (err) {
              console.error(`Failed to fetch details for ${item.mediaType} ${item.mediaId}`, err)
              return { ...item }
            }
          }),
        )

        // Filter out items with "Title Not Available" or "not available"
        const filteredItems = enrichedItems.filter((item) => {
          const title = item.details
            ? item.details.title.titleEn || item.details.title.titleSi || item.details.title.titleTa || item.title
            : item.title
            
          if (!title) return false
          const lowerTitle = title.toLowerCase()
          return !lowerTitle.includes("title not available") && !lowerTitle.includes("not available")
        })

        setData(filteredItems)
      } catch (err) {
        console.error("Failed to fetch top media:", err)
      } finally {
        setLoading(false)
      }
    }

    if (tenantId) {
      loadData()
    }
  }, [activeTab, tenantId])

  const formatWatchTime = (ms: number) => {
    const hours = Math.floor(ms / 3600)
    const minutes = Math.floor((ms % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const getPoster = (item: EnrichedMediaItem) => {
    if (!item.details) return "/placeholder.png"
    const posters = item.details.posters.filter(
      (p) => p.posterType === "WEB" && p.posterOrientation === "LANDSCAPE" && p.caption === "LANDSCAPE_WITH_TITLE",
    )
    const poster = posters.length > 0 ? posters[posters.length - 1] : null
    return poster?.cdnUrl || poster?.sourceUrl || "/placeholder.png"
  }

  const getTitle = (item: EnrichedMediaItem) => {
    if (!item.details) return item.title
    return item.details.title.titleEn || item.details.title.titleSi || item.details.title.titleTa || item.title
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">Popular Content</h2>
        <div className="flex space-x-2 bg-muted/20 p-1 rounded-lg">
          {(["all", "movies", "tvshows"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                activeTab === tab ? "bg-primary text-white shadow" : "text-muted hover:text-foreground"
              }`}
            >
              {tab === "all" ? "All" : tab === "movies" ? "Movies" : "TV Shows"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted/10 animate-pulse rounded" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-muted">Poster</th>
                <th className="text-left px-4 py-3 text-muted">Title</th>
                <th className="text-left px-4 py-3 text-muted">Type</th>
                <th className="text-right px-4 py-3 text-muted">Watch Time</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={`${item.mediaType}-${item.mediaId}-${idx}`} className="border-b border-border hover:bg-border/50 transition">
                  <td className="px-4 py-3">
                    <img
                      src={getPoster(item)}
                      alt={getTitle(item)}
                      className="w-16 h-9 object-cover rounded border border-border"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{getTitle(item)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                      {item.mediaType === "MOVIE" ? "Movie" : "TV Show"}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 text-muted font-mono">
                    {formatWatchTime(item.totalWatchTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
