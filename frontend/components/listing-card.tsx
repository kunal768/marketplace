"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock } from "lucide-react"
import type { Listing, ListingMedia } from "@/lib/api/types"
import { formatPrice, formatTimeAgo, mapCategoryToDisplay } from "@/lib/utils/listings"
import { orchestratorApi } from "@/lib/api/orchestrator"
import { getCachedMedia, setCachedMedia } from "@/lib/utils/media-cache"

interface ListingCardProps {
  listing: Listing
  token: string
  refreshToken: string | null
  index: number
}

export function ListingCard({ listing, token, refreshToken, index }: ListingCardProps) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [loadingMedia, setLoadingMedia] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    if (!cardRef.current || hasFetchedRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasFetchedRef.current) {
            hasFetchedRef.current = true
            fetchMedia()
            observer.disconnect()
          }
        })
      },
      { rootMargin: "100px" }, // Preload 100px before entering viewport
    )

    observer.observe(cardRef.current)

    return () => observer.disconnect()
  }, [])

  const fetchMedia = async () => {
    // Check cache first
    const cached = getCachedMedia(listing.id)
    if (cached && cached.length > 0) {
      setMediaUrl(cached[0].media_url)
      return
    }

    try {
      setLoadingMedia(true)
      const media = await orchestratorApi.getListingMedia(token, refreshToken, listing.id)
      if (media && Array.isArray(media) && media.length > 0) {
        setMediaUrl(media[0].media_url)
        setCachedMedia(listing.id, media)
      }
    } catch (err) {
      console.error(`Error fetching media for listing ${listing.id}:`, err)
      // Use placeholder on error
    } finally {
      setLoadingMedia(false)
    }
  }

  return (
    <Link href={`/listing/${listing.id}`}>
      <Card
        ref={cardRef}
        className={`overflow-hidden premium-card cursor-pointer h-full scroll-reveal stagger-${(index % 3) + 1}`}
      >
        <CardHeader className="p-0">
          <div className="relative aspect-square overflow-hidden bg-muted">
            {loadingMedia ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <img
                src={mediaUrl || "/placeholder.svg"}
                alt={listing.title}
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
                onError={(e) => {
                  // Fallback to placeholder if image fails to load
                  ;(e.target as HTMLImageElement).src = "/placeholder.svg"
                }}
              />
            )}
            <Badge className="absolute right-3 top-3 bg-background/90 text-foreground backdrop-blur-sm">
              {mapCategoryToDisplay(listing.category)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <h3 className="mb-3 font-semibold text-lg text-foreground line-clamp-2">{listing.title}</h3>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-3xl font-bold text-primary">{formatPrice(listing.price)}</span>
            <Badge variant="secondary" className="text-sm">
              {listing.status}
            </Badge>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between border-t border-border p-5 text-sm text-muted-foreground">
          <span className="font-medium text-xs truncate max-w-[120px]">{listing.user_id}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {formatTimeAgo(listing.created_at)}
          </span>
        </CardFooter>
      </Card>
    </Link>
  )
}

