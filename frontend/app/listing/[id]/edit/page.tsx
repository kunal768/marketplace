"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Edit, Tag, Package, AlertCircle, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { orchestratorApi } from "@/lib/api/orchestrator"
import type { Listing } from "@/lib/api/types"
import {
  getDisplayCategories,
  mapCategoryToDisplay,
  mapDisplayToCategory,
  getDisplayStatuses,
  mapStatusToDisplay,
  mapDisplayToStatus,
  centsToDollars,
  dollarsToCents,
} from "@/lib/utils/listings"
import { useToast } from "@/hooks/use-toast"

const categories = getDisplayCategories()
const statuses = getDisplayStatuses()

export default function EditListingPage() {
  const router = useRouter()
  const params = useParams()
  const { token, isAuthenticated, isHydrated, user } = useAuth()
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listing, setListing] = useState<Listing | null>(null)
  const { toast } = useToast()

  const listingId = params?.id ? parseInt(params.id as string, 10) : null

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    status: "",
  })

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

  // Fetch listing by ID on mount
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

        // Check if user owns the listing or is an admin
        if (user && data.user_id !== user.user_id && user.role !== "0") {
          setError("You don't have permission to edit this listing")
          return
        }

        // Populate form with existing data
        setFormData({
          title: data.title || "",
          description: data.description || "",
          price: data.price ? centsToDollars(data.price).toString() : "",
          category: mapCategoryToDisplay(data.category),
          status: mapStatusToDisplay(data.status),
        })
      } catch (err) {
        console.error("Error fetching listing:", err)
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch listing"
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchListing()
  }, [isHydrated, isAuthenticated, token, refreshToken, listingId, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token || !refreshToken || !listingId) {
      toast({
        title: "Error",
        description: "Authentication required",
        variant: "destructive",
      })
      return
    }

    // Validate form
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Title is required",
        variant: "destructive",
      })
      return
    }

    if (!formData.category) {
      toast({
        title: "Validation Error",
        description: "Category is required",
        variant: "destructive",
      })
      return
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast({
        title: "Validation Error",
        description: "Price must be greater than 0",
        variant: "destructive",
      })
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      // Prepare update payload
      const updates: {
        title?: string
        description?: string
        price?: number
        category?: string
        status?: string
      } = {}

      // Only include fields that have changed
      if (listing) {
        if (formData.title !== listing.title) {
          updates.title = formData.title.trim()
        }
        if (formData.description !== (listing.description || "")) {
          updates.description = formData.description.trim() || undefined
        }
        const priceInCents = dollarsToCents(parseFloat(formData.price))
        if (priceInCents !== listing.price) {
          updates.price = priceInCents
        }
        const backendCategory = mapDisplayToCategory(formData.category)
        if (backendCategory !== listing.category) {
          updates.category = backendCategory
        }
        const backendStatus = mapDisplayToStatus(formData.status)
        if (backendStatus && backendStatus !== listing.status) {
          updates.status = backendStatus
        }
      }

      // Check if there are any changes
      if (Object.keys(updates).length === 0) {
        toast({
          title: "No Changes",
          description: "No changes were made to the listing",
        })
        return
      }

      // Update the listing
      const updatedListing = await orchestratorApi.updateListing(token, refreshToken, listingId, updates)

      toast({
        title: "Success",
        description: "Listing updated successfully",
      })

      // Navigate to the listing detail page
      router.push(`/listing/${listingId}`)
    } catch (err) {
      console.error("Error updating listing:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to update listing"
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Show loading state
  if (!isHydrated || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
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
                <h2 className="text-2xl font-bold mb-2">Error</h2>
                <p className="text-muted-foreground mb-6">
                  {error || "Listing not found or you don't have permission to edit it."}
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
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 animate-float-in-up">
            <h1 className="mb-3 text-4xl font-bold text-foreground">Edit Listing</h1>
            <p className="text-lg text-muted-foreground">Update the details of your listing below</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              <Card className="premium-card animate-scale-in-bounce stagger-1">
                <CardHeader>
                  <CardTitle className="text-xl">Basic Information</CardTitle>
                  <CardDescription className="text-base">Update details about your item</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-base">
                      Title *
                    </Label>
                    <Input
                      id="title"
                      placeholder="e.g., Calculus Textbook - 8th Edition"
                      className="h-12 text-base"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-base">
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Describe your item, its condition, and any important details..."
                      rows={6}
                      className="text-base resize-none"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="category" className="text-base">
                        Category *
                      </Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                        required
                      >
                        <SelectTrigger id="category" className="h-12">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="status" className="text-base">
                        Status *
                      </Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                        required
                      >
                        <SelectTrigger id="status" className="h-12">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses
                            .filter((status) => status !== "All") // Remove "All" from edit options
                            .map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="premium-card animate-scale-in-bounce stagger-2">
                <CardHeader>
                  <CardTitle className="text-xl">Pricing</CardTitle>
                  <CardDescription className="text-base">Update your price</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="price" className="text-base">
                      Price (in dollars) *
                    </Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-base">
                        $
                      </span>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-8 h-12 text-base"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Current price: ${centsToDollars(listing.price).toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 animate-scale-in-bounce stagger-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Tag className="h-6 w-6 text-primary" />
                    Editing Tips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-base text-muted-foreground">
                    <li className="flex gap-3 items-start">
                      <span className="text-primary text-xl">•</span>
                      <span>Make sure your title is clear and descriptive</span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="text-primary text-xl">•</span>
                      <span>Include all relevant details in the description</span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="text-primary text-xl">•</span>
                      <span>Update status to reflect availability</span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="text-primary text-xl">•</span>
                      <span>Price competitively by checking similar listings</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {error && (
                <Card className="border-destructive bg-destructive/10">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-5 w-5" />
                      <p className="font-medium">{error}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-4 animate-float-in-up stagger-4">
                <Button
                  type="submit"
                  size="lg"
                  className="flex-1 h-14 text-base font-semibold magnetic-button"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Edit className="mr-2 h-5 w-5" />
                      Update Listing
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-14 px-8 magnetic-button bg-transparent"
                  onClick={() => router.back()}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}