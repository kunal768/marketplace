"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import { orchestratorApi } from "@/lib/api/orchestrator"
import type { FlaggedListing, FlagStatus } from "@/lib/api/types"
import { AlertCircle, Flag, Clock, User, FileText, ArrowLeft, Edit, Trash2 } from "lucide-react"
import Link from "next/link"

export default function FlaggedListingsPage() {
  const router = useRouter()
  const { user, token, isAuthenticated, isHydrated } = useAuth()
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [flaggedListings, setFlaggedListings] = useState<FlaggedListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<FlagStatus | "ALL">("ALL")
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [selectedFlag, setSelectedFlag] = useState<FlaggedListing | null>(null)
  const [updateStatus, setUpdateStatus] = useState<FlagStatus>("OPEN")
  const [updateResolutionNotes, setUpdateResolutionNotes] = useState<string>("")
  const [updating, setUpdating] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRefreshToken(localStorage.getItem("frontend-refreshToken"))
    }
  }, [])

  // Check if user is admin and redirect if not
  useEffect(() => {
    if (isHydrated) {
      if (!isAuthenticated) {
        router.push("/")
        return
      }
      if (user?.role !== "0") {
        // Not an admin, redirect to home
        router.push("/home")
        return
      }
    }
  }, [isHydrated, isAuthenticated, user, router])

  // Fetch flagged listings
  useEffect(() => {
    if (!isHydrated || !isAuthenticated || user?.role !== "0" || !token || !refreshToken) {
      return
    }

    const fetchFlaggedListings = async () => {
      try {
        setLoading(true)
        setError(null)
        const status = statusFilter === "ALL" ? undefined : statusFilter
        const response = await orchestratorApi.getFlaggedListings(token, refreshToken, status)
        // Handle null or undefined response
        if (response && response.flagged_listings) {
          setFlaggedListings(Array.isArray(response.flagged_listings) ? response.flagged_listings : [])
        } else {
          setFlaggedListings([])
        }
      } catch (err) {
        console.error("Error fetching flagged listings:", err)
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch flagged listings"
        setError(errorMessage)
        setFlaggedListings([]) // Reset to empty array on error
      } finally {
        setLoading(false)
      }
    }

    fetchFlaggedListings()
  }, [isHydrated, isAuthenticated, user, token, refreshToken, statusFilter])

  const getStatusBadgeVariant = (status: FlagStatus) => {
    switch (status) {
      case "OPEN":
        return "destructive"
      case "UNDER_REVIEW":
        return "default"
      case "RESOLVED":
        return "secondary"
      case "DISMISSED":
        return "outline"
      default:
        return "secondary"
    }
  }

  const getReasonBadgeVariant = (reason: string) => {
    switch (reason) {
      case "SPAM":
        return "destructive"
      case "SCAM":
        return "destructive"
      case "INAPPROPRIATE":
        return "destructive"
      case "MISLEADING":
        return "default"
      case "OTHER":
        return "secondary"
      default:
        return "secondary"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatPrice = (price: number) => {
    // Price is stored in cents, convert to dollars
    if (!price || price === 0) return "$0.00"
    return `$${(price / 100).toFixed(2)}`
  }

  const handleOpenUpdateDialog = (flagged: FlaggedListing) => {
    setSelectedFlag(flagged)
    setUpdateStatus(flagged.status)
    setUpdateResolutionNotes(flagged.resolution_notes || "")
    setUpdateDialogOpen(true)
  }

  const handleUpdateFlagListing = async () => {
    if (!selectedFlag || !token || !refreshToken) return

    try {
      setUpdating(true)
      setError(null)
      await orchestratorApi.updateFlagListing(token, refreshToken, selectedFlag.flag_id, updateStatus, updateResolutionNotes || undefined)
      
      // Refresh the flagged listings
      const status = statusFilter === "ALL" ? undefined : statusFilter
      const response = await orchestratorApi.getFlaggedListings(token, refreshToken, status)
      // Always set the flagged listings, even if empty array
      if (response && response.flagged_listings) {
        setFlaggedListings(Array.isArray(response.flagged_listings) ? response.flagged_listings : [])
      } else {
        setFlaggedListings([])
      }
      
      setUpdateDialogOpen(false)
      setSelectedFlag(null)
      setUpdateStatus("OPEN")
      setUpdateResolutionNotes("")
    } catch (err) {
      console.error("Error updating flagged listing:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to update flagged listing"
      setError(errorMessage)
    } finally {
      setUpdating(false)
    }
  }

  const handleOpenDeleteDialog = (flagged: FlaggedListing) => {
    setSelectedFlag(flagged)
    setDeleteDialogOpen(true)
  }

  const handleDeleteFlagListing = async () => {
    if (!selectedFlag || !token || !refreshToken) return

    try {
      setDeleting(true)
      setError(null)
      await orchestratorApi.deleteFlagListing(token, refreshToken, selectedFlag.flag_id)

      // Refresh the flagged listings
      const status = statusFilter === "ALL" ? undefined : statusFilter
      const response = await orchestratorApi.getFlaggedListings(token, refreshToken, status)
      // Always set the flagged listings, even if empty array
      if (response && response.flagged_listings) {
        setFlaggedListings(Array.isArray(response.flagged_listings) ? response.flagged_listings : [])
      } else {
        setFlaggedListings([])
      }

      setDeleteDialogOpen(false)
      setSelectedFlag(null)
    } catch (err) {
      console.error("Error deleting flagged listing:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to delete flagged listing"
      setError(errorMessage)
    } finally {
      setDeleting(false)
    }
  }

  if (!isHydrated || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading flagged listings...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || user?.role !== "0") {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-float-in-up">
          <div className="flex items-center gap-4 mb-4">
            <Button asChild variant="ghost" size="sm" className="magnetic-button">
              <Link href="/admin/dashboard" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-2 text-4xl font-bold text-foreground flex items-center gap-2">
                <Flag className="h-8 w-8" />
                Flagged Listings
              </h1>
              <p className="text-lg text-muted-foreground">Review and manage flagged listings</p>
            </div>
            <div className="flex items-center gap-4">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FlagStatus | "ALL")}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="DISMISSED">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        )}

        {!loading && flaggedListings && flaggedListings.length === 0 ? (
          <Card className="animate-float-in-up">
            <CardContent className="py-12 text-center">
              <Flag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">No flagged listings found</p>
            </CardContent>
          </Card>
        ) : !loading && flaggedListings && flaggedListings.length > 0 ? (
          <div className="space-y-6">
            {flaggedListings.map((flagged, index) => (
              <Card key={flagged.flag_id} className="animate-float-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-xl">
                          <Link
                            href={`/listing/${flagged.listing.id}`}
                            className="hover:text-primary transition-colors"
                          >
                            {flagged.listing.title}
                          </Link>
                        </CardTitle>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant={getStatusBadgeVariant(flagged.status)}>{flagged.status}</Badge>
                        <Badge variant={getReasonBadgeVariant(flagged.reason)}>{flagged.reason}</Badge>
                        <Badge variant="outline">{formatPrice(flagged.listing.price)}</Badge>
                        <Badge variant="outline">{flagged.listing.category}</Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                          <Flag className="h-4 w-4" />
                          Flag Information
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Flag className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Flag ID:</span>
                            <span className="font-mono text-xs">{flagged.flag_id}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Flagged:</span>
                            <span>{formatDate(flagged.flag_created_at)}</span>
                          </div>
                          {flagged.reporter_user_id && (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Reporter ID:</span>
                              <span className="font-mono text-xs">{flagged.reporter_user_id}</span>
                            </div>
                          )}
                          {flagged.details && (
                            <div className="flex items-start gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div>
                                <span className="text-muted-foreground">Details:</span>
                                <p className="mt-1">{flagged.details}</p>
                              </div>
                            </div>
                          )}
                          {flagged.resolution_notes && (
                            <div className="flex items-start gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <span className="text-muted-foreground block">Resolution Notes:</span>
                                <div className="
                                  mt-1
                                  w-[clamp(22rem,40vw,32rem)]  /* min 22rem, ideal 40vw, max 32rem */
                                  max-w-full
                                  h-40 overflow-auto
                                  rounded-md border bg-muted/30 p-2 text-sm
                                  whitespace-pre-wrap break-words
                                ">
                                  {flagged.resolution_notes}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold mb-2">Listing Information</h3>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Listing ID:</span>
                            <span className="ml-2 font-mono text-xs">{flagged.listing.id}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Seller ID:</span>
                            <span className="ml-2 font-mono text-xs">{flagged.listing.user_id}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status:</span>
                            <Badge variant="outline" className="ml-2">
                              {flagged.listing.status}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Created:</span>
                            <span className="ml-2">{formatDate(flagged.listing.created_at)}</span>
                          </div>
                          {flagged.listing.description && (
                            <div>
                              <span className="text-muted-foreground">Description:</span>
                              <p className="mt-1 text-sm">{flagged.listing.description}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="pt-4 space-y-2">
                        <Link href={`/listing/${flagged.listing.id}`}>
                          <Button variant="outline" className="w-full">
                            View Listing
                          </Button>
                        </Link>
                        <Button
                          variant="default"
                          className="w-full"
                          onClick={() => handleOpenUpdateDialog(flagged)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Update Status
                        </Button>
                        <Button
                          variant="destructive"
                          className="w-full"
                          onClick={() => handleOpenDeleteDialog(flagged)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Flag
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {!loading && flaggedListings && flaggedListings.length > 0 && (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Showing {flaggedListings.length} flagged listing{flaggedListings.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Update Flag Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Update Flagged Listing</DialogTitle>
            <DialogDescription>
              Update the status and add resolution notes for this flagged listing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedFlag && (
              <div className="space-y-2">
                <div>
                  <Label htmlFor="listing-title">Listing</Label>
                  <p className="text-sm font-medium mt-1">{selectedFlag.listing.title}</p>
                  <p className="text-xs text-muted-foreground">Flag ID: {selectedFlag.flag_id}</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={updateStatus} onValueChange={(value) => setUpdateStatus(value as FlagStatus)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="DISMISSED">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resolution-notes">Resolution Notes</Label>
              <Textarea
                id="resolution-notes"
                placeholder="Enter resolution notes (optional)"
                value={updateResolutionNotes}
                onChange={(e) => setUpdateResolutionNotes(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)} disabled={updating}>
              Cancel
            </Button>
            <Button onClick={handleUpdateFlagListing} disabled={updating}>
              {updating ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Flag Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Delete Flagged Listing</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this flagged listing? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedFlag && (
              <div className="space-y-2">
                <div>
                  <Label>Listing</Label>
                  <p className="text-sm font-medium mt-1">{selectedFlag.listing.title}</p>
                  <p className="text-xs text-muted-foreground">Flag ID: {selectedFlag.flag_id}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge variant={getStatusBadgeVariant(selectedFlag.status)} className="mt-1">
                    {selectedFlag.status}
                  </Badge>
                </div>
                <div>
                  <Label>Reason</Label>
                  <Badge variant={getReasonBadgeVariant(selectedFlag.reason)} className="mt-1">
                    {selectedFlag.reason}
                  </Badge>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteFlagListing} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

