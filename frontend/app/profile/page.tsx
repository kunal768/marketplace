"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Edit, Trash2, MapPin, Mail, Calendar, Package, Filter } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { orchestratorApi } from "@/lib/api/orchestrator"
import type { Listing, User } from "@/lib/api/types"
import {
  formatPrice,
  formatDate,
  mapCategoryToDisplay,
  mapDisplayToCategory,
  mapStatusToDisplay,
  mapDisplayToStatus,
  mapSortToBackend,
  getDisplayCategories,
  getDisplayStatuses,
  getSortOptions,
  type DisplayCategory,
  type DisplayStatus,
} from "@/lib/utils/listings"
import Link from "next/link"

const categories = getDisplayCategories()
const statuses = getDisplayStatuses()
const sortOptions = getSortOptions()

export default function ProfilePage() {
  const router = useRouter()
  const { token, isAuthenticated, isHydrated, user: authUser } = useAuth()
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DisplayStatus>("All")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [sortBy, setSortBy] = useState("recent")
  const [searchQuery, setSearchQuery] = useState("")
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editUserName, setEditUserName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editContactEmail, setEditContactEmail] = useState("")
  const [updating, setUpdating] = useState(false)
  const { toast } = useToast()

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

  // Fetch user info and listings
  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !token || !refreshToken) {
      return
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch user info and listings in parallel
        const [userResponse, listingsResponse] = await Promise.all([
          orchestratorApi.getUser(token, refreshToken),
          orchestratorApi.getUserListings(token, refreshToken),
        ])

        setUser(userResponse.user)
        setListings(listingsResponse || [])
      } catch (err) {
        console.error("Error fetching profile data:", err)
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch profile data"
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isHydrated, isAuthenticated, token, refreshToken])

  // Filter and sort listings
  const filteredAndSortedListings = useMemo(() => {
    let filtered = [...listings]

    // Filter by status (tab)
    if (activeTab !== "All") {
      const backendStatus = mapDisplayToStatus(activeTab)
      if (backendStatus) {
        filtered = filtered.filter((listing) => listing.status === backendStatus)
      }
    }

    // Filter by category
    if (selectedCategory && selectedCategory !== "all") {
      const backendCategory = mapDisplayToCategory(selectedCategory)
      filtered = filtered.filter((listing) => listing.category === backendCategory)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (listing) =>
          listing.title.toLowerCase().includes(query) ||
          listing.description?.toLowerCase().includes(query),
      )
    }

    // Sort listings
    const backendSort = mapSortToBackend(sortBy)
    if (backendSort === "price_asc") {
      filtered.sort((a, b) => a.price - b.price)
    } else if (backendSort === "price_desc") {
      filtered.sort((a, b) => b.price - a.price)
    } else {
      // Default: most recent (created_at DESC)
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    return filtered
  }, [listings, activeTab, selectedCategory, sortBy, searchQuery])

  // Calculate stats
  const stats = useMemo(() => {
    const activeListings = listings.filter((listing) => listing.status === "AVAILABLE").length
    const soldListings = listings.filter((listing) => listing.status === "SOLD").length
    const totalListings = listings.length

    return {
      active: activeListings,
      sold: soldListings,
      total: totalListings,
    }
  }, [listings])

  // Get user display name and initials
  const userDisplayName = user?.user_name || authUser?.user_name || "User"
  const userInitials = userDisplayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  // Get user email
  const userEmail = user?.email || authUser?.email || ""

  // Format join date
  const joinDate = user?.created_at || authUser?.created_at
  const formattedJoinDate = joinDate ? formatDate(joinDate) : ""

  // Handle edit dialog open
  const handleOpenEditDialog = () => {
    if (user) {
      setEditUserName(user.user_name)
      setEditEmail(user.email)
      setEditContactEmail(user.contact?.Email || user.email)
      setEditDialogOpen(true)
    }
  }

  // Handle update user
  const handleUpdateUser = async () => {
    if (!user || !token || !refreshToken) return

    // Validate email format (must end with @sjsu.edu)
    if (!editEmail.endsWith("@sjsu.edu")) {
      toast({
        title: "Validation Error",
        description: "Email must be a valid @sjsu.edu address",
        variant: "destructive",
      })
      return
    }

    if (!editContactEmail.endsWith("@sjsu.edu")) {
      toast({
        title: "Validation Error",
        description: "Contact email must be a valid @sjsu.edu address",
        variant: "destructive",
      })
      return
    }

    if (editUserName.trim().length < 3 || editUserName.trim().length > 50) {
      toast({
        title: "Validation Error",
        description: "Username must be between 3 and 50 characters",
        variant: "destructive",
      })
      return
    }

    try {
      setUpdating(true)
      setError(null)

      const response = await orchestratorApi.updateUser(token, refreshToken, {
        user_id: user.user_id,
        user_name: editUserName.trim(),
        email: editEmail.trim(),
        contact: {
          Email: editContactEmail.trim(),
        },
      })

      // Update local user state
      setUser(response.user)

      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      })

      setEditDialogOpen(false)
    } catch (err) {
      console.error("Error updating user:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to update profile"
      setError(errorMessage)
      toast({
        title: "Update Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="p-6">
              <p className="text-destructive">{error}</p>
              <Button
                onClick={() => {
                  if (token && refreshToken) {
                    window.location.reload()
                  } else {
                    router.push("/")
                  }
                }}
                className="mt-4"
              >
                Retry
              </Button>
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
        <Card className="mb-8 overflow-hidden animate-scale-in-bounce">
          <div className="h-32 bg-gradient-to-r from-primary to-accent" />
          <CardContent className="relative pt-0 pb-8">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6 -mt-16">
              <Avatar className="h-32 w-32 border-4 border-card shadow-xl">
                <AvatarImage src="/placeholder-user.jpg" />
                <AvatarFallback className="text-3xl">{userInitials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-foreground mb-2">{userDisplayName}</h1>
                <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm text-muted-foreground">
                  {userEmail && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      {userEmail}
                    </span>
                  )}
                  {formattedJoinDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Joined {formattedJoinDate.split(",")[0]}
                    </span>
                  )}
                </div>
              </div>
              <Button size="lg" className="magnetic-button" onClick={() => handleOpenEditDialog()}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { label: "Active Listings", value: stats.active.toString(), icon: Package },
            { label: "Total Listings", value: stats.total.toString(), icon: Package },
            { label: "Items Sold", value: stats.sold.toString(), icon: Package },
          ].map((stat, index) => (
            <Card key={stat.label} className={`premium-card animate-float-in-up stagger-${index + 1}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <stat.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="animate-float-in-up stagger-4">
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <h2 className="text-2xl font-bold">My Listings</h2>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:flex-initial md:w-64">
                  <Input
                    placeholder="Search listings..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DisplayStatus)}>
              <TabsList className="mb-6">
                {statuses.map((status) => (
                  <TabsTrigger key={status} value={status}>
                    {status}
                  </TabsTrigger>
                ))}
              </TabsList>

              {statuses.map((status) => (
                <TabsContent key={status} value={status} className="space-y-6">
                  {filteredAndSortedListings.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No listings found</p>
                      {activeTab !== "All" && (
                        <p className="text-sm mt-2">
                          You don't have any {status.toLowerCase()} listings
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredAndSortedListings.map((listing, index) => {
                        const isSold = listing.status === "SOLD"
                        const isAvailable = listing.status === "AVAILABLE"

                        return (
                          <Link key={listing.id} href={`/listing/${listing.id}`} className="block group">
                            <Card
                              className={`premium-card cursor-pointer hover:shadow-lg transition transform hover:-translate-y-1 ${
                                isSold ? "opacity-75" : ""
                              } animate-float-in-up stagger-${(index % 3) + 1}`}
                            >
                              <CardHeader className="p-0">
                                <div className="relative aspect-square overflow-hidden bg-muted rounded-t-xl">
                                  <img
                                    src="/placeholder.svg"
                                    alt={listing.title}
                                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                  <Badge
                                    className={`absolute right-3 top-3 ${
                                      isSold ? "bg-green-500 text-white" : "bg-background/90 backdrop-blur-sm"
                                    }`}
                                  >
                                    {isSold ? "Sold" : mapCategoryToDisplay(listing.category)}
                                  </Badge>
                                </div>
                              </CardHeader>

                              <CardContent className="p-4">
                                <h3 className="font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                                  {listing.title}
                                </h3>

                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-2xl font-bold text-primary">
                                    {formatPrice(listing.price)}
                                  </span>
                                  <Badge variant="secondary">
                                    {mapStatusToDisplay(listing.status)}
                                  </Badge>
                                </div>

                                <p className="text-xs text-muted-foreground">
                                  {formatDate(listing.created_at)}
                                </p>
                              </CardContent>
                            </Card>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update your profile information below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
                placeholder="Enter your username"
                disabled={updating}
              />
              <p className="text-xs text-muted-foreground">Must be between 3 and 50 characters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="your.email@sjsu.edu"
                disabled={updating}
              />
              <p className="text-xs text-muted-foreground">Must be a valid @sjsu.edu address</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Contact Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={editContactEmail}
                onChange={(e) => setEditContactEmail(e.target.value)}
                placeholder="contact.email@sjsu.edu"
                disabled={updating}
              />
              <p className="text-xs text-muted-foreground">Must be a valid @sjsu.edu address</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={updating}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={updating}>
              {updating ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Updating...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}