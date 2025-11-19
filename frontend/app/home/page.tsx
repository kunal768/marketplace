"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Navigation } from "@/components/navigation"
import { BookOpen, Laptop, Shirt, Home, TrendingUp } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { orchestratorApi } from "@/lib/api/orchestrator"
import { ListingCard } from "@/components/listing-card"
import { getDisplayCategories, mapDisplayToCategory, mapDisplayToStatus, type DisplayCategory } from "@/lib/utils/listings"
import type { Listing } from "@/lib/api/types"

// Category icons mapping
const categoryIcons: Record<DisplayCategory, typeof BookOpen> = {
  Textbooks: BookOpen,
  Electronics: Laptop,
  Essentials: Home,
  "Non-Essential": Shirt,
  Other: Home,
}

export default function HomePage() {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const { token, isAuthenticated, isHydrated } = useAuth()
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  
  // State for featured listings
  const [featuredListings, setFeaturedListings] = useState<Listing[]>([])
  const [loadingFeatured, setLoadingFeatured] = useState(false)
  const [errorFeatured, setErrorFeatured] = useState<string | null>(null)
  
  // State for category counts
  const [categoryCounts, setCategoryCounts] = useState<Record<DisplayCategory, number>>({
    Textbooks: 0,
    Electronics: 0,
    Essentials: 0,
    "Non-Essential": 0,
    Other: 0,
  })
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [errorCategories, setErrorCategories] = useState<string | null>(null)
  
  // Get refresh token from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      setRefreshToken(localStorage.getItem("frontend-refreshToken"))
    }
  }, [])

  useEffect(() => {
    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed")
            // Stop observing once revealed
            observerRef.current?.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1 },
    )

    // Use setTimeout to ensure DOM is updated
    setTimeout(() => {
      // Observe all scroll-reveal elements
      document.querySelectorAll(".scroll-reveal").forEach((el) => {
        // If element is already in viewport, reveal it immediately
        const rect = el.getBoundingClientRect()
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0
        if (isVisible) {
          el.classList.add("revealed")
        } else {
          observerRef.current?.observe(el)
        }
      })
    }, 0)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [featuredListings]) // Re-run when featured listings are loaded

  // Fetch featured listings when authenticated
  const fetchFeaturedListings = useCallback(async () => {
    if (!isHydrated || !isAuthenticated || !token || !refreshToken) {
      return
    }

    try {
      setLoadingFeatured(true)
      setErrorFeatured(null)
      
      // Fetch first 6 AVAILABLE listings (recent first, default sort)
      // Match the listings page behavior which filters by "Available" status
      const backendStatus = mapDisplayToStatus("Available")
      const filters: {
        limit?: number
        offset?: number
        status?: string
      } = {
        limit: 6,
        offset: 0,
      }
      
      if (backendStatus) {
        filters.status = backendStatus
      }
      
      const response = await orchestratorApi.getAllListings(token, refreshToken, filters)
      
      // Log for debugging
      if (process.env.NODE_ENV === "development") {
        console.log("Home page - Featured listings response:", {
          hasResponse: !!response,
          hasItems: !!(response && response.items),
          itemsLength: response?.items?.length || 0,
          response: response,
        })
      }
      
      if (response && response.items) {
        const items = Array.isArray(response.items) ? response.items : []
        setFeaturedListings(items.slice(0, 6))
        
        if (process.env.NODE_ENV === "development") {
          console.log("Home page - Featured listings set:", items.slice(0, 6).length)
        }
      } else {
        setFeaturedListings([])
      }
    } catch (error) {
      console.error("Error fetching featured listings:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to load featured listings"
      setErrorFeatured(errorMessage)
      setFeaturedListings([])
    } finally {
      setLoadingFeatured(false)
    }
  }, [isHydrated, isAuthenticated, token, refreshToken])

  useEffect(() => {
    fetchFeaturedListings()
  }, [fetchFeaturedListings])

  // Fetch category counts when authenticated
  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !token || !refreshToken) {
      return
    }

    const fetchCategoryCounts = async () => {
      try {
        setLoadingCategories(true)
        setErrorCategories(null)
        
        const displayCategories = getDisplayCategories()
        const counts: Record<DisplayCategory, number> = {
          Textbooks: 0,
          Electronics: 0,
          Essentials: 0,
          "Non-Essential": 0,
          Other: 0,
        }
        
        // Fetch count for each category
        await Promise.all(
          displayCategories.map(async (displayCategory) => {
            try {
              const backendCategory = mapDisplayToCategory(displayCategory)
              const response = await orchestratorApi.getAllListings(token, refreshToken, {
                category: backendCategory,
                status: "AVAILABLE",
                limit: 1, // We only need the count, not the items
              })
              
              if (response) {
                counts[displayCategory] = response.count || 0
              }
            } catch (error) {
              console.error(`Error fetching count for category ${displayCategory}:`, error)
              // Continue with other categories even if one fails
            }
          })
        )
        
        setCategoryCounts(counts)
      } catch (error) {
        console.error("Error fetching category counts:", error)
        setErrorCategories(error instanceof Error ? error.message : "Failed to load category counts")
      } finally {
        setLoadingCategories(false)
      }
    }

    fetchCategoryCounts()
  }, [isHydrated, isAuthenticated, token, refreshToken])

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <section className="relative border-b border-border bg-gradient-to-br from-primary/10 via-background to-accent/10 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float-in-up" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-float-in-up stagger-2" />
        </div>

        <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-6 text-5xl font-bold tracking-tight text-foreground md:text-7xl text-balance animate-float-in-up">
              Your Campus Marketplace
            </h1>
            <p className="mb-10 text-xl text-muted-foreground md:text-2xl text-pretty animate-float-in-up stagger-1">
              Buy and sell textbooks, electronics, and more with students on your campus. Safe, easy, and built for
              student life.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center animate-float-in-up stagger-2">
              <Button asChild size="lg" className="text-lg h-14 px-8 magnetic-button">
                <Link href="/listings">Browse Listings</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg h-14 px-8 magnetic-button bg-transparent">
                <Link href="/create">Sell an Item</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-10 text-3xl font-bold text-foreground scroll-reveal">Browse by Category</h2>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {getDisplayCategories().map((categoryName, index) => {
              const Icon = categoryIcons[categoryName]
              const count = categoryCounts[categoryName] ?? 0
              return (
                <Link key={categoryName} href={`/listings?category=${categoryName}`}>
                  <Card className={`premium-card cursor-pointer scroll-reveal stagger-${index + 1}`}>
                    <CardContent className="flex flex-col items-center gap-4 p-8">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
                        <Icon className="h-8 w-8 text-primary" />
                      </div>
                      <div className="text-center">
                        <h3 className="font-semibold text-lg text-foreground">{categoryName}</h3>
                        {loadingCategories ? (
                          <p className="text-sm text-muted-foreground">Loading...</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">{count} items</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-10 flex items-center justify-between scroll-reveal">
            <div>
              <h2 className="text-3xl font-bold text-foreground">Featured Listings</h2>
              <p className="text-lg text-muted-foreground">Recently posted items from your campus</p>
            </div>
            <Button asChild variant="ghost" className="magnetic-button">
              <Link href="/listings">
                View All
                <TrendingUp className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>

          {!isAuthenticated || !isHydrated ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Please log in to view featured listings</p>
            </div>
          ) : loadingFeatured ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading featured listings...</p>
              </div>
            </div>
          ) : errorFeatured ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">Failed to load featured listings</p>
              <p className="text-sm text-muted-foreground">{errorFeatured}</p>
            </div>
          ) : featuredListings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No featured listings available at the moment</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {featuredListings.map((listing, index) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  token={token!}
                  refreshToken={refreshToken}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-border bg-gradient-to-br from-primary/5 to-accent/5 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center scroll-reveal">
            <h2 className="mb-6 text-4xl font-bold text-foreground">Ready to Start Selling?</h2>
            <p className="mb-10 text-xl text-muted-foreground">
              List your items in minutes and connect with buyers on your campus
            </p>
            <Button asChild size="lg" className="text-lg h-14 px-8 magnetic-button">
              <Link href="/create">Create Your First Listing</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <p className="text-sm text-muted-foreground">© 2025 CampusMart. Built for students, by students.</p>
            <div className="flex gap-8">
              <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                About
              </Link>
              <Link href="/help" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Help
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
