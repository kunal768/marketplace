"use client"

import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Search, SlidersHorizontal, X, AlertCircle } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { orchestratorApi } from "@/lib/api/orchestrator"
import type { Listing } from "@/lib/api/types"
import { ListingCard } from "@/components/listing-card"
import {
  formatPrice,
  formatTimeAgo,
  mapCategoryToDisplay,
  mapDisplayToCategory,
  getDisplayCategories,
  dollarsToCents,
  mapSortToBackend,
  getSortOptions,
  mapDisplayToStatus,
  mapStatusToDisplay,
  getDisplayStatuses,
  type DisplayStatus,
  type DisplayCategory,
} from "@/lib/utils/listings"

const categories = getDisplayCategories()

export default function ListingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token, isAuthenticated, isHydrated } = useAuth()
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [minPrice, setMinPrice] = useState<string>("")
  const [maxPrice, setMaxPrice] = useState<string>("")
  const [debouncedMinPrice, setDebouncedMinPrice] = useState<string>("")
  const [debouncedMaxPrice, setDebouncedMaxPrice] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<DisplayStatus>("Available")
  const [sortBy, setSortBy] = useState("recent")
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const LISTINGS_PER_PAGE = 20
  const sentinelRef = useRef<HTMLDivElement>(null)
  const hasMoreRef = useRef(true)
  const loadingMoreRef = useRef(false)
  const loadingRef = useRef(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Keep refs in sync with state
  useEffect(() => {
    hasMoreRef.current = hasMore
  }, [hasMore])

  useEffect(() => {
    loadingMoreRef.current = loadingMore
  }, [loadingMore])

  useEffect(() => {
    loadingRef.current = loading
  }, [loading])

  // Get refresh token from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      setRefreshToken(localStorage.getItem("frontend-refreshToken"))
    }
  }, [])

  // Read category from URL parameter and set initial category filter
  useEffect(() => {
    const categoryParam = searchParams.get("category")
    if (categoryParam) {
      // Validate that the category is a valid DisplayCategory
      const validCategories = getDisplayCategories()
      if (validCategories.includes(categoryParam as DisplayCategory)) {
        setSelectedCategory(categoryParam)
      }
    }
  }, [searchParams])

  // Redirect if not authenticated
  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/")
    }
  }, [isHydrated, isAuthenticated, router])

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Debounce price changes to avoid too many API calls while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMinPrice(minPrice)
    }, 500)

    return () => clearTimeout(timer)
  }, [minPrice])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMaxPrice(maxPrice)
    }, 500)

    return () => clearTimeout(timer)
  }, [maxPrice])

  // Intersection observer for animations
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
  }, [listings])

  // Build filter object
  const buildFilters = useCallback(
    (currentOffset: number) => {
      const filters: {
        keywords?: string
        category?: string
        status?: string
        min_price?: number
        max_price?: number
        limit?: number
        offset?: number
        sort?: string
      } = {
        limit: LISTINGS_PER_PAGE,
        offset: currentOffset,
      }

      // Add search keywords
      if (debouncedSearchQuery.trim()) {
        filters.keywords = debouncedSearchQuery.trim()
      }

      // Add status filter (only if not "All")
      if (statusFilter !== "All") {
        const backendStatus = mapDisplayToStatus(statusFilter)
        if (backendStatus) {
          filters.status = backendStatus
        }
      }

      // Add category filter
      if (selectedCategory) {
        const backendCategory = mapDisplayToCategory(selectedCategory)
        if (backendCategory) {
          filters.category = backendCategory
        }
      }

      // Add price range filter (convert dollars to cents)
      if (debouncedMinPrice.trim()) {
        const minValue = parseFloat(debouncedMinPrice.trim())
        if (!isNaN(minValue) && minValue > 0) {
          filters.min_price = dollarsToCents(minValue)
        }
      }
      if (debouncedMaxPrice.trim()) {
        const maxValue = parseFloat(debouncedMaxPrice.trim())
        if (!isNaN(maxValue) && maxValue > 0) {
          filters.max_price = dollarsToCents(maxValue)
        }
      }

      // Add sort
      const backendSort = mapSortToBackend(sortBy)
      if (backendSort) {
        filters.sort = backendSort
      }

      return filters
    },
    [debouncedSearchQuery, selectedCategory, debouncedMinPrice, debouncedMaxPrice, statusFilter, sortBy],
  )

  // Fetch initial listings from API (resets the list)
  const fetchListings = useCallback(async () => {
    if (!isHydrated || !isAuthenticated || !token || !refreshToken) {
      return
    }

    try {
      setLoading(true)
      setError(null)
      setOffset(0)
      setHasMore(true)

      const filters = buildFilters(0)
      const response = await orchestratorApi.getAllListings(token, refreshToken, filters)

      if (response && response.items) {
        const items = Array.isArray(response.items) ? response.items : []
        setListings(items)
        setTotalCount(response.count || items.length)
        
        // Determine if there are more items:
        // - If we got exactly LISTINGS_PER_PAGE items, assume there might be more
        // - If we got fewer, we've reached the end
        const mightHaveMore = items.length === LISTINGS_PER_PAGE
        setHasMore(mightHaveMore)
        
        // Log for debugging
        if (process.env.NODE_ENV === "development") {
          console.log("Initial load:", {
            itemsLoaded: items.length,
            requested: LISTINGS_PER_PAGE,
            hasMore: mightHaveMore,
            totalCount: response.count || items.length,
          })
        }
      } else {
        setListings([])
        setTotalCount(0)
        setHasMore(false)
      }
    } catch (err) {
      console.error("Error fetching listings:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch listings"
      setError(errorMessage)
      setListings([])
      setTotalCount(0)
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [isHydrated, isAuthenticated, token, refreshToken, buildFilters])

  // Load more listings (appends to existing list)
  const loadMoreListings = useCallback(async () => {
    // Prevent multiple simultaneous calls - use refs for latest values
    if (!isHydrated || !isAuthenticated || !token || !refreshToken) {
      return
    }

    if (loadingMoreRef.current) {
      return
    }

    // Don't load if we know there are no more items - use ref for latest value
    if (!hasMoreRef.current) {
      return
    }

    try {
      setLoadingMore(true)
      setError(null)

      // Get current listings count for offset
      const currentOffset = listings.length

      const filters = buildFilters(currentOffset)
      const response = await orchestratorApi.getAllListings(token, refreshToken, filters)

      if (response && response.items) {
        const items = Array.isArray(response.items) ? response.items : []

        if (items.length > 0) {
          // Append new items to existing listings
          setListings((prev) => {
            const newListings = [...prev, ...items]
            
            // Determine if there are more items
            // If we got exactly LISTINGS_PER_PAGE items, assume there might be more
            const mightHaveMore = items.length === LISTINGS_PER_PAGE
            setHasMore(mightHaveMore)
            
            // Log for debugging
            if (process.env.NODE_ENV === "development") {
              console.log("Loaded more:", {
                itemsLoaded: items.length,
                requested: LISTINGS_PER_PAGE,
                totalNow: newListings.length,
                hasMore: mightHaveMore,
                offset: currentOffset,
              })
            }
            
            return newListings
          })
          setOffset(currentOffset + items.length)

          // Total count should remain the same (it's the total matching items in DB)
          // Only update if response provides a count (should be same as initial)
          if (response.count !== undefined) {
            setTotalCount(response.count)
          }
        } else {
          // Got empty response, no more items
          setHasMore(false)
          if (process.env.NODE_ENV === "development") {
            console.log("No more items - empty response at offset", currentOffset)
          }
        }
      } else {
        // No response or no items, assume we've reached the end
        setHasMore(false)
      }
    } catch (err) {
      console.error("Error loading more listings:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to load more listings"
      setError(errorMessage)
      // Don't set hasMore to false on error - allow retry
    } finally {
      setLoadingMore(false)
    }
  }, [isHydrated, isAuthenticated, token, refreshToken, listings.length, buildFilters])

  // Fetch listings when filters change (reset to page 1)
  useEffect(() => {
    fetchListings()
  }, [fetchListings])

  // Store loadMoreListings in a ref to avoid recreating observer
  const loadMoreListingsRef = useRef(loadMoreListings)
  useEffect(() => {
    loadMoreListingsRef.current = loadMoreListings
  }, [loadMoreListings])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    // Don't set up observer during initial load or if no listings
    if (loading || listings.length === 0) {
      return
    }

    const sentinel = sentinelRef.current
    if (!sentinel) {
      // Wait a bit for sentinel to be rendered
      const timeout = setTimeout(() => {
        if (sentinelRef.current && listings.length > 0 && !loading) {
          // Retry setup
        }
      }, 100)
      return () => clearTimeout(timeout)
    }

    // Handler function that uses refs for latest values
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          // Use refs to get latest values (avoid stale closure)
          if (hasMoreRef.current && !loadingMoreRef.current && !loadingRef.current) {
            // Use ref to call latest version of loadMoreListings
            loadMoreListingsRef.current()
          }
          break
        }
      }
    }

    // Create observer
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0,
      rootMargin: "800px", // Start loading 800px before reaching the bottom
    })

    observer.observe(sentinel)

    // Also check immediately if sentinel is already in viewport
    // This handles the case where there are few listings and sentinel is already visible
    const checkNow = () => {
      if (!sentinelRef.current) return
      
      const rect = sentinelRef.current.getBoundingClientRect()
      const windowHeight = window.innerHeight || document.documentElement.clientHeight
      const distanceFromBottom = rect.top - windowHeight
      
      // If sentinel is within 1000px of viewport, trigger load
      if (distanceFromBottom < 1000 && rect.bottom > -500) {
        if (hasMoreRef.current && !loadingMoreRef.current && !loadingRef.current) {
          loadMoreListingsRef.current()
        }
      }
    }

    // Check after a short delay to ensure DOM is ready
    const initialCheck = setTimeout(checkNow, 300)

    // Also set up a scroll listener as backup
    const handleScroll = () => {
      checkNow()
    }

    // Throttled scroll handler
    let lastScrollTime = 0
    const throttledScroll = () => {
      const now = Date.now()
      if (now - lastScrollTime < 100) {
        return
      }
      lastScrollTime = now
      handleScroll()
    }

    window.addEventListener("scroll", throttledScroll, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", throttledScroll)
      clearTimeout(initialCheck)
    }
  }, [listings.length, loading]) // Only depend on listings.length and loading, not loadMoreListings

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category === "All" ? "" : category)
  }, [])


  const clearFilters = useCallback(() => {
    setSelectedCategory("")
    setMinPrice("")
    setMaxPrice("")
    setDebouncedMinPrice("")
    setDebouncedMaxPrice("")
    setStatusFilter("Available")
    setSearchQuery("")
    setSortBy("recent")
  }, [])

  // Memoize FilterContent to prevent unnecessary re-renders that cause focus loss
  const FilterContent = memo(function FilterContent() {
    // Local state for input values - only syncs to parent on blur or after debounce
    const [localMinPrice, setLocalMinPrice] = useState(minPrice)
    const [localMaxPrice, setLocalMaxPrice] = useState(maxPrice)

    // Validation function to check if input is a reasonable number
    const isValidPrice = useCallback((value: string): boolean => {
      // Allow empty string (no filter)
      if (value.trim() === "") {
        return true
      }
      
      // Check if it's a valid number
      const num = parseFloat(value.trim())
      if (isNaN(num)) {
        return false
      }
      
      // Must be non-negative and finite
      if (num < 0 || !isFinite(num)) {
        return false
      }
      
      // Reasonable maximum (e.g., $1 million)
      if (num > 1000000) {
        return false
      }
      
      return true
    }, [])

    // Sync local state when parent state changes (e.g., from clearFilters)
    useEffect(() => {
      setLocalMinPrice(minPrice)
    }, [minPrice])

    useEffect(() => {
      setLocalMaxPrice(maxPrice)
    }, [maxPrice])

    // Debounce local changes to parent state
    useEffect(() => {
      const timer = setTimeout(() => {
        if (localMinPrice !== minPrice) {
          // Only sync if valid, otherwise clear
          if (isValidPrice(localMinPrice)) {
            setMinPrice(localMinPrice)
          } else {
            setLocalMinPrice("")
            setMinPrice("")
          }
        }
      }, 500)

      return () => clearTimeout(timer)
    }, [localMinPrice, minPrice, isValidPrice]) // Only depend on localMinPrice

    useEffect(() => {
      const timer = setTimeout(() => {
        if (localMaxPrice !== maxPrice) {
          // Only sync if valid, otherwise clear
          if (isValidPrice(localMaxPrice)) {
            setMaxPrice(localMaxPrice)
          } else {
            setLocalMaxPrice("")
            setMaxPrice("")
          }
        }
      }, 500)

      return () => clearTimeout(timer)
    }, [localMaxPrice, maxPrice, isValidPrice]) // Only depend on localMaxPrice

    return (
      <div className="space-y-6">
        <div>
          <Label className="mb-3 block text-base font-semibold">Status</Label>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as DisplayStatus)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {getDisplayStatuses().map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-3 block text-base font-semibold">Category</Label>
          <Select value={selectedCategory || "All"} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-3 block text-base font-semibold">Price Range</Label>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="min-price" className="mb-2 block text-sm text-muted-foreground">
                Min Price ($)
              </Label>
              <Input
                id="min-price"
                type="text"
                inputMode="decimal"
                placeholder="No minimum"
                value={localMinPrice}
                onChange={(e) => setLocalMinPrice(e.target.value)}
                onBlur={() => {
                  // Validate and sync on blur
                  if (isValidPrice(localMinPrice)) {
                    if (localMinPrice !== minPrice) {
                      setMinPrice(localMinPrice)
                    }
                  } else {
                    // Clear invalid input
                    setLocalMinPrice("")
                    setMinPrice("")
                  }
                }}
                className="w-full"
              />
            </div>
            <div>
              <Label htmlFor="max-price" className="mb-2 block text-sm text-muted-foreground">
                Max Price ($)
              </Label>
              <Input
                id="max-price"
                type="text"
                inputMode="decimal"
                placeholder="No maximum"
                value={localMaxPrice}
                onChange={(e) => setLocalMaxPrice(e.target.value)}
                onBlur={() => {
                  // Validate and sync on blur
                  if (isValidPrice(localMaxPrice)) {
                    if (localMaxPrice !== maxPrice) {
                      setMaxPrice(localMaxPrice)
                    }
                  } else {
                    // Clear invalid input
                    setLocalMaxPrice("")
                    setMaxPrice("")
                  }
                }}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <Button variant="outline" className="w-full bg-transparent magnetic-button" onClick={clearFilters}>
          Clear All Filters
        </Button>
      </div>
    )
  })

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-float-in-up">
          <h1 className="mb-2 text-4xl font-bold text-foreground">Browse Listings</h1>
          <p className="text-lg text-muted-foreground">Find what you need from students on your campus</p>
        </div>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row animate-float-in-up stagger-1">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search for items..."
              className="pl-12 h-14 text-base rounded-xl border-2 focus:border-primary transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[200px] h-14 rounded-xl">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {getSortOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="lg:hidden h-14 magnetic-button bg-transparent">
                  <SlidersHorizontal className="mr-2 h-5 w-5" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <FilterContent />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="flex gap-8">
          <aside className="hidden w-72 shrink-0 lg:block">
            <Card className="sticky top-24 premium-card animate-slide-in-left">
              <CardHeader>
                <h2 className="text-xl font-bold">Filters</h2>
              </CardHeader>
              <CardContent>
                <FilterContent />
              </CardContent>
            </Card>
          </aside>

          <div className="flex-1">
            {(selectedCategory ||
              debouncedMinPrice ||
              debouncedMaxPrice ||
              debouncedSearchQuery ||
              statusFilter !== "Available") && (
              <div className="mb-6 flex flex-wrap gap-2 animate-float-in-up">
                {statusFilter !== "Available" && (
                  <Badge variant="secondary" className="gap-1 px-3 py-1 text-sm">
                    Status: {statusFilter}
                    <button
                      onClick={() => setStatusFilter("Available")}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {selectedCategory && (
                  <Badge variant="secondary" className="gap-1 px-3 py-1 text-sm">
                    Category: {selectedCategory}
                    <button
                      onClick={() => setSelectedCategory("")}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {debouncedSearchQuery && (
                  <Badge variant="secondary" className="gap-1 px-3 py-1 text-sm">
                    Search: {debouncedSearchQuery}
                    <button
                      onClick={() => {
                        setSearchQuery("")
                        setDebouncedSearchQuery("")
                      }}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {debouncedMinPrice && (
                  <Badge variant="secondary" className="gap-1 px-3 py-1 text-sm">
                    Min: ${debouncedMinPrice}
                    <button
                      onClick={() => {
                        setMinPrice("")
                        setDebouncedMinPrice("")
                      }}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {debouncedMaxPrice && (
                  <Badge variant="secondary" className="gap-1 px-3 py-1 text-sm">
                    Max: ${debouncedMaxPrice}
                    <button
                      onClick={() => {
                        setMaxPrice("")
                        setDebouncedMaxPrice("")
                      }}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={fetchListings} className="ml-auto">
                  Retry
                </Button>
              </div>
            )}

            {loading && listings.length === 0 ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading listings...</p>
                </div>
              </div>
            ) : listings.length === 0 ? (
              <Card className="animate-float-in-up">
                <CardContent className="py-12 text-center">
                  <p className="text-lg text-muted-foreground">No listings found</p>
                  {(selectedCategory ||
                    debouncedMinPrice ||
                    debouncedMaxPrice ||
                    debouncedSearchQuery ||
                    statusFilter !== "Available") && (
                    <Button variant="outline" onClick={clearFilters} className="mt-4">
                      Clear Filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="mb-6 text-base text-muted-foreground scroll-reveal">
                  {totalCount > 0 ? (
                    <>
                      Showing <span className="font-semibold text-foreground">{listings.length}</span> of{" "}
                      <span className="font-semibold text-foreground">{totalCount}</span> item
                      {totalCount !== 1 ? "s" : ""}
                      {hasMore && <span className="text-muted-foreground"> (scroll for more)</span>}
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-foreground">{listings.length}</span> item
                      {listings.length !== 1 ? "s" : ""} loaded
                      {hasMore && <span className="text-muted-foreground"> (scroll for more)</span>}
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {listings.map((listing, index) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      token={token!}
                      refreshToken={refreshToken}
                      index={index}
                    />
                  ))}
                </div>

                {/* Scroll sentinel for infinite scroll - always render when there are listings */}
                <div ref={sentinelRef} className="h-10 w-full" />

                {/* Loading more indicator */}
                {loadingMore && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Loading more listings...</p>
                    </div>
                  </div>
                )}

                {/* End of results message */}
                {!hasMore && listings.length > 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>You've reached the end of the listings.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
