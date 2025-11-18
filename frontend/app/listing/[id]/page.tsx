"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MessageSquare,
  Clock,
  ChevronLeft,
  ChevronRight,
  Heart,
  Share2,
  Flag,
  Shield,
  AlertCircle,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { orchestratorApi } from "@/lib/api/orchestrator"
import type { Listing, FlagReason, ListingMedia } from "@/lib/api/types"
import { formatPrice, formatTimeAgo, mapCategoryToDisplay } from "@/lib/utils/listings"
import { useToast } from "@/hooks/use-toast"
import { getCachedMedia, setCachedMedia, invalidateMediaCache } from "@/lib/utils/media-cache"

export default function ListingDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { token, isAuthenticated, isHydrated, user } = useAuth()
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isSaved, setIsSaved] = useState(false)
  const [flagDialogOpen, setFlagDialogOpen] = useState(false)
  const [flagReason, setFlagReason] = useState<FlagReason | "">("")
  const [flagDetails, setFlagDetails] = useState("")
  const [flagging, setFlagging] = useState(false)
  const [hasFlagged, setHasFlagged] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mediaUrls, setMediaUrls] = useState<ListingMedia[]>([])
  const [loadingMedia, setLoadingMedia] = useState(false)
  const { toast } = useToast()

  const listingId = params?.id ? parseInt(params.id as string, 10) : null

  // Get refresh token from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      setRefreshToken(localStorage.getItem("frontend-refreshToken"))
    }
  }, [])

  // Redirect if not authenticated
  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/")
    }
  }, [isHydrated, isAuthenticated, router])

  // Fetch listing by ID
  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !token || !refreshToken || !listingId || isNaN(listingId)) {
      return
    }

    const fetchListing = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await orchestratorApi.getListingById(token, refreshToken, listingId)
        setListing(data)
      } catch (err) {
        console.error("Error fetching listing:", err)
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch listing"
        setError(errorMessage)
        if (errorMessage === "Listing not found") {
          // Handle 404
        }
      } finally {
        setLoading(false)
      }
    }

    fetchListing()
  }, [isHydrated, isAuthenticated, token, refreshToken, listingId, router])

  // Fetch media URLs for the listing
  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !token || !refreshToken || !listingId || isNaN(listingId)) {
      return
    }

    const fetchMedia = async () => {
      // Check cache first
      const cached = getCachedMedia(listingId)
      if (cached) {
        setMediaUrls(cached)
        return
      }

      try {
        setLoadingMedia(true)
        const media = await orchestratorApi.getListingMedia(token, refreshToken, listingId)
        if (media && Array.isArray(media)) {
          setMediaUrls(media)
          setCachedMedia(listingId, media)
        } else {
          setMediaUrls([])
        }
      } catch (err) {
        console.error("Error fetching media URLs:", err)
        // Don't show error to user, just use placeholder
        setMediaUrls([])
      } finally {
        setLoadingMedia(false)
      }
    }

    fetchMedia()
  }, [isHydrated, isAuthenticated, token, refreshToken, listingId])

  // Check if user has already flagged this listing
  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !token || !refreshToken || !listingId || isNaN(listingId) || !user) {
      return
    }

    const checkIfFlagged = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || "http://localhost:8080"}/api/listings/flag/${listingId}/check`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        )

        if (response.ok) {
          const data = await response.json()
          setHasFlagged(data.has_flagged || false)
        }
      } catch (err) {
        console.error("Error checking flag status:", err)
        // Don't show error to user, just assume not flagged
      }
    }

    checkIfFlagged()
  }, [isHydrated, isAuthenticated, token, refreshToken, listingId, user])

  // Use actual media URLs or placeholder
  const images =
    mediaUrls.length > 0
      ? mediaUrls.map((m) => m.media_url)
      : listing
        ? ["/placeholder.svg"]
        : []

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed")
          }
        })
      },
      { threshold: 0.1 },
    )

    document.querySelectorAll(".scroll-reveal").forEach((el) => {
      observer.observe(el)
    })

    return () => observer.disconnect()
  }, [listing])

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const handleFlagListing = async () => {
    if (!flagReason || !listingId || !token || !refreshToken) {
      toast({
        title: "Error",
        description: "Please select a reason for flagging this listing.",
        variant: "destructive",
      })
      return
    }

    try {
      setFlagging(true)
      await orchestratorApi.flagListing(
        token,
        refreshToken,
        listingId,
        flagReason as FlagReason,
        flagDetails || undefined,
      )
      toast({
        title: "Listing Flagged",
        description: "Thank you for reporting this listing. Our team will review it shortly.",
      })
      setFlagDialogOpen(false)
      setFlagReason("")
      setFlagDetails("")
      setHasFlagged(true) // Update state to reflect that user has flagged
      // Refresh the listing to show updated status
      if (listingId && token && refreshToken) {
        const updatedListing = await orchestratorApi.getListingById(token, refreshToken, listingId)
        setListing(updatedListing)
      }
    } catch (err) {
      console.error("Error flagging listing:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to flag listing"
      // Check if it's a duplicate flag error
      if (errorMessage.includes("already flagged") || errorMessage.includes("Already flagged")) {
        setHasFlagged(true)
        toast({
          title: "Already Flagged",
          description: "You have already flagged this listing.",
          variant: "default",
        })
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } finally {
      setFlagging(false)
    }
  }

  const handleDeleteListing = async () => {
    if (!listingId || !token || !refreshToken) {
      toast({
        title: "Error",
        description: "Authentication required",
        variant: "destructive",
      })
      return
    }

    try {
      setDeleting(true)
      await orchestratorApi.deleteListing(token, refreshToken, listingId, true) // Soft delete by default

      toast({
        title: "Listing Deleted",
        description: "The listing has been successfully deleted.",
      })

      // Navigate to profile page after deletion
      router.push("/profile")
    } catch (err) {
      console.error("Error deleting listing:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to delete listing"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const flagReasons: { value: FlagReason; label: string }[] = [
    { value: "SPAM", label: "Spam" },
    { value: "SCAM", label: "Scam" },
    { value: "INAPPROPRIATE", label: "Inappropriate Content" },
    { value: "MISLEADING", label: "Misleading Information" },
    { value: "OTHER", label: "Other" },
  ]

  // Check if current user can edit this listing (owner or admin)
  const canEdit = listing && user && (listing.user_id === user.user_id || user.role === "0")
  // Check if current user is the owner
  const isOwner = listing && user && listing.user_id === user.user_id

  // Show loading state
  if (!isHydrated || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading listing...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error || !listing) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md w-full">
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Listing Not Found</h2>
                <p className="text-muted-foreground mb-6">
                  {error || "The listing you're looking for doesn't exist or has been removed."}
                </p>
                <div className="flex gap-4 justify-center">
                  <Button variant="outline" onClick={() => router.push("/listings")}>
                    Browse Listings
                  </Button>
                  <Button onClick={() => router.back()}>Go Back</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Images and Details */}
          <div className="lg:col-span-2">
            <Card className="mb-6 overflow-hidden premium-card animate-scale-in-bounce">
              <div className="relative aspect-square bg-muted">
                {loadingMedia ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <img
                    src={images[currentImageIndex] || "/placeholder.svg"}
                    alt={listing.title}
                    className="h-full w-full object-cover transition-transform duration-700"
                    onError={(e) => {
                      // Fallback to placeholder if image fails to load
                      ;(e.target as HTMLImageElement).src = "/placeholder.svg"
                    }}
                  />
                )}
                {images.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute left-4 top-1/2 -translate-y-1/2 glass-morphism magnetic-button"
                      onClick={prevImage}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-4 top-1/2 -translate-y-1/2 glass-morphism magnetic-button"
                      onClick={nextImage}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                      {images.map((_, index) => (
                        <button
                          key={index}
                          className={`h-2 rounded-full transition-all duration-300 ${
                            index === currentImageIndex ? "w-8 bg-primary" : "w-2 bg-white/50"
                          }`}
                          onClick={() => setCurrentImageIndex(index)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2 p-4">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      className={`aspect-square overflow-hidden rounded-xl border-2 transition-all duration-300 hover:scale-105 ${
                        index === currentImageIndex ? "border-primary shadow-lg" : "border-transparent"
                      }`}
                      onClick={() => setCurrentImageIndex(index)}
                    >
                      <img
                        src={image || "/placeholder.svg"}
                        alt={`Thumbnail ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <Card className="scroll-reveal">
              <CardHeader>
                <CardTitle className="text-2xl">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground leading-relaxed text-lg">
                  {listing.description || "No description provided."}
                </p>
              </CardContent>
            </Card>

            <Card className="mt-6 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 scroll-reveal">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-6 w-6 text-primary" />
                  Safety Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-base text-muted-foreground">
                  <li className="flex gap-3 items-start">
                    <span className="text-primary text-xl">•</span>
                    <span>Meet in a public place on campus</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="text-primary text-xl">•</span>
                    <span>Inspect the item before paying</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="text-primary text-xl">•</span>
                    <span>Use the in-app messaging system</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="text-primary text-xl">•</span>
                    <span>Report suspicious activity</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Purchase Info */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <Card className="premium-card animate-slide-in-right">
                <CardContent className="p-6">
                  <div className="mb-6">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-4xl font-bold text-primary">{formatPrice(listing.price)}</span>
                      <Badge variant="secondary" className="text-base px-3 py-1">
                        {listing.status}
                      </Badge>
                    </div>
                    <h1 className="mb-3 text-2xl font-bold text-foreground text-balance">{listing.title}</h1>
                    <Badge className="text-sm">{mapCategoryToDisplay(listing.category)}</Badge>
                  </div>

                  <Separator className="my-6" />

                  <div className="mb-6 space-y-3 text-base">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Clock className="h-5 w-5 text-primary" />
                      <span>Posted {formatTimeAgo(listing.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="text-xs font-mono">ID: {listing.id}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {canEdit && (
                      <Button
                        className="w-full h-14 text-base font-semibold magnetic-button"
                        size="lg"
                        onClick={() => router.push(`/listing/${listing.id}/edit`)}
                      >
                        <Edit className="mr-2 h-5 w-5" />
                        Edit Listing
                      </Button>
                    )}
                    {!isOwner && (
                      <Button
                        className="w-full h-14 text-base font-semibold magnetic-button"
                        size="lg"
                        onClick={() => {
                          sessionStorage.setItem('openConversationWith', listing.user_id)
                          router.push('/messages')
                        }}
                      >
                        <MessageSquare className="mr-2 h-5 w-5" />
                        Contact Seller
                      </Button>
                    )}
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1 h-12 magnetic-button bg-transparent"
                        onClick={() => setIsSaved(!isSaved)}
                      >
                        <Heart
                          className={`mr-2 h-5 w-5 transition-all ${isSaved ? "fill-current text-red-500 scale-110" : ""}`}
                        />
                        {isSaved ? "Saved" : "Save"}
                      </Button>
                      <Button variant="outline" size="icon" className="h-12 w-12 magnetic-button bg-transparent">
                        <Share2 className="h-5 w-5" />
                      </Button>
                    </div>
                    {canEdit && (
                      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full h-12 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive magnetic-button bg-transparent"
                          >
                            <Trash2 className="mr-2 h-5 w-5" />
                            Delete Listing
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                          <DialogHeader>
                            <DialogTitle>Delete Listing</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to delete this listing? This action cannot be undone.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setDeleteDialogOpen(false)}
                              disabled={deleting}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={handleDeleteListing}
                              disabled={deleting}
                            >
                              {deleting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Listing
                                </>
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="premium-card animate-slide-in-right stagger-1">
                <CardHeader>
                  <CardTitle className="text-lg">Seller Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex items-center gap-4">
                    <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                      <AvatarImage src="/placeholder.svg" />
                      <AvatarFallback className="text-lg">
                        {listing.user_id.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground text-lg">Seller</h3>
                      <p className="text-sm text-muted-foreground font-mono truncate">{listing.user_id}</p>
                    </div>
                  </div>

                  <Button
                    asChild
                    variant="outline"
                    className="w-full h-12 magnetic-button bg-transparent"
                  >
                    <Link href={`/profile`}>View Profile</Link>
                  </Button>
                </CardContent>
              </Card>

              <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-12 text-muted-foreground hover:text-destructive hover:border-destructive magnetic-button bg-transparent"
                    disabled={hasFlagged}
                  >
                    <Flag className="mr-2 h-5 w-5" />
                    {hasFlagged ? "Already Reported" : "Report this listing"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Report Listing</DialogTitle>
                    <DialogDescription>
                      {hasFlagged
                        ? "You have already reported this listing. Our team will review it shortly."
                        : "Help us keep our marketplace safe by reporting listings that violate our policies."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="flag-reason">Reason for reporting *</Label>
                      <Select value={flagReason} onValueChange={(value) => setFlagReason(value as FlagReason)}>
                        <SelectTrigger id="flag-reason" className="w-full">
                          <SelectValue placeholder="Select a reason" />
                        </SelectTrigger>
                        <SelectContent>
                          {flagReasons.map((reason) => (
                            <SelectItem key={reason.value} value={reason.value}>
                              {reason.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="flag-details">Additional details (optional)</Label>
                      <Textarea
                        id="flag-details"
                        placeholder="Please provide any additional information that might help us review this listing..."
                        value={flagDetails}
                        onChange={(e) => setFlagDetails(e.target.value)}
                        className="min-h-24"
                        maxLength={500}
                      />
                      <p className="text-xs text-muted-foreground">{flagDetails.length}/500 characters</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFlagDialogOpen(false)
                        setFlagReason("")
                        setFlagDetails("")
                      }}
                      disabled={flagging}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleFlagListing} disabled={flagging || !flagReason || hasFlagged}>
                      {flagging ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Reporting...
                        </>
                      ) : hasFlagged ? (
                        <>
                          <Flag className="mr-2 h-4 w-4" />
                          Already Reported
                        </>
                      ) : (
                        <>
                          <Flag className="mr-2 h-4 w-4" />
                          Report Listing
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
