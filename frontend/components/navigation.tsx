"use client"

import Link from "next/link"
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Plus, MessageSquare, User, LogOut, Menu, Shield } from 'lucide-react'
import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useUnreadCount } from "@/hooks/use-unread-count"
import { disconnectGlobalWebSocket } from "@/lib/websocket/manager"
import { orchestratorApi } from "@/lib/api/orchestrator"
import type { Listing } from "@/lib/api/types"
import { formatPrice, mapCategoryToDisplay } from "@/lib/utils/listings"

export function Navigation() {
  const router = useRouter()
  const { user, token } = useAuth()
  const [refreshToken, setRefreshToken] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRefreshToken(localStorage.getItem('frontend-refreshToken'))
    }
  }, [])

  const { unreadConversationCount } = useUnreadCount(
    user?.user_id || null,
    token,
    refreshToken,
    false // No polling in navigation
  )
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Listing[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const handleAISearchResults = (event: CustomEvent) => {
      console.log("[v0] Navigation received AI search results:", event.detail)
      const { results } = event.detail

      setSearchResults(results)
      setShowSearchResults(true)

      if (searchRef.current) {
        searchRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }

    window.addEventListener("ai-search-results", handleAISearchResults as EventListener)
    return () => {
      window.removeEventListener("ai-search-results", handleAISearchResults as EventListener)
    }
  }, [])

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const token = localStorage.getItem("frontend-loginToken")

    if (token) {
      router.push("/home")
    } else {
      router.push("/")
    }
  }

  const handleLogout = () => {
    disconnectGlobalWebSocket()

    localStorage.removeItem("frontend-loginToken");
    localStorage.removeItem("frontend-refreshToken");
    localStorage.removeItem("frontend-user");
    localStorage.removeItem("frontend-userId");

    window.location.href = "/";
  };

  useEffect(() => {
    const searchListings = async () => {
      if (!searchQuery.trim() || !token || !refreshToken) {
        setSearchResults([])
        setShowSearchResults(false)
        return
      }

      const timer = setTimeout(async () => {
        setIsSearching(true)
        try {
          const response = await orchestratorApi.getAllListings(token, refreshToken, {
            keywords: searchQuery.trim(),
            limit: 4,
            status: "AVAILABLE",
          })

          if (response && response.items) {
            setSearchResults(response.items)
            setShowSearchResults(true)
          } else {
            setSearchResults([])
          }
        } catch (error) {
          console.error("Search error:", error)
          setSearchResults([])
        } finally {
          setIsSearching(false)
        }
      }, 300)

      return () => clearTimeout(timer)
    }

    searchListings()
  }, [searchQuery, token, refreshToken])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      // Check if click is on a link or inside a link
      const isLink = target.closest('a')
      
      if (searchRef.current && !searchRef.current.contains(target)) {
        setShowSearchResults(false)
      } else if (isLink && searchRef.current?.contains(isLink)) {
        // If clicking on a link inside search results, let it handle navigation first
        // The link's onClick will close the dropdown
        return
      }
    }

    // Use 'click' instead of 'mousedown' to allow Link onClick to fire first
    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [])

  // Helper to close search when a result is clicked
  const handleResultClick = (e: React.MouseEvent, listingId: string) => {
    e.preventDefault()
    e.stopPropagation()
    console.log("[v0] Navigation result handler clicked, listingId:", listingId)
    setShowSearchResults(false)
    setSearchQuery("")
    router.push(`/listing/${listingId}`)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    console.log("[v0] Navigation search submit called")
    e.preventDefault()
    if (searchQuery.trim()) {
      setShowSearchResults(false)
      router.push(`/listings?search=${encodeURIComponent(searchQuery)}`)
    }
  }

  return (
    <nav
      className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${isScrolled
          ? "glass-morphism border-border/50 shadow-lg"
          : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-border"
        }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-20 items-center justify-between gap-4">
          <Link href="/" onClick={handleLogoClick} className="flex items-center gap-3 group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg transition-transform group-hover:scale-110">
              <span className="text-xl font-bold text-primary-foreground">CM</span>
            </div>
            <span className="hidden text-2xl font-bold text-foreground sm:inline-block">CampusMart</span>
          </Link>

          <div className="hidden flex-1 max-w-xl md:block">
            <div className="relative" ref={searchRef}>
              <form onSubmit={handleSearchSubmit}>
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  placeholder="Search for textbooks, electronics..."
                  className="w-full pl-12 h-12 text-base rounded-xl border-2 focus:border-primary transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) {
                      setShowSearchResults(true)
                    }
                  }}
                />
              </form>

              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-background border border-border rounded-xl shadow-lg overflow-hidden z-50">
                  {searchResults.map((listing) => (
                    <div
                      key={listing.id}
                      onClick={(e) => handleResultClick(e, String(listing.id))}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors text-left border-b border-border last:border-b-0 cursor-pointer"
                    >
                      <div className="flex-shrink-0 w-12 h-12 bg-muted rounded-lg overflow-hidden">
                        <img
                          src="/placeholder.svg"
                          alt={listing.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{listing.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-semibold text-primary">{formatPrice(listing.price)}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">{mapCategoryToDisplay(listing.category)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showSearchResults && searchQuery.trim() && !isSearching && searchResults.length === 0 && (
                <div className="absolute top-full mt-2 w-full bg-background border border-border rounded-xl shadow-lg p-4 z-50">
                  <p className="text-sm text-muted-foreground text-center">No listings found</p>
                </div>
              )}

              {isSearching && searchQuery.trim() && (
                <div className="absolute top-full mt-2 w-full bg-background border border-border rounded-xl shadow-lg p-4 z-50">
                  <p className="text-sm text-muted-foreground text-center">Searching...</p>
                </div>
              )}
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Button asChild variant="outline" size="lg" className="magnetic-button">
              <Link href="/listings">
                <Search className="mr-2 h-5 w-5" />
                Browse
              </Link>
            </Button>
            <Button asChild variant="default" size="lg" className="magnetic-button">
              <Link href="/create">
                <Plus className="mr-2 h-5 w-5" />
                Sell Item
              </Link>
            </Button>
            <Button asChild variant="outline" size="icon" className="h-11 w-11 magnetic-button relative">
              <Link href="/messages">
                <MessageSquare className="h-5 w-5" />
                {unreadConversationCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary text-primary-foreground">
                    {unreadConversationCount > 9 ? "9+" : unreadConversationCount}
                  </Badge>
                )}
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-11 w-11 magnetic-button">
                  <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                    <AvatarImage src="/placeholder.svg?height=36&width=36" />
                    <AvatarFallback>NS</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                {user?.role === "0" && (
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/admin/dashboard">
                      <Shield className="mr-2 h-4 w-4" />
                      Admin Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <Menu className="h-6 w-6" />
          </Button>
        </div>

        {/* Mobile Search Section */}
        <div className="pb-4 md:hidden">
          <div className="relative" ref={searchRef}>
            <form onSubmit={handleSearchSubmit}>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Search for textbooks, electronics..."
                className="w-full pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) {
                    setShowSearchResults(true)
                  }
                }}
              />
            </form>

            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-background border border-border rounded-xl shadow-lg overflow-hidden z-50">
                {searchResults.map((listing) => (
                  <div
                    key={listing.id}
                    onClick={(e) => handleResultClick(e, String(listing.id))}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted transition-colors text-left border-b border-border last:border-b-0 cursor-pointer"
                  >
                    <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-lg overflow-hidden">
                      <img
                        src="/placeholder.svg"
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{listing.title}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-primary">{formatPrice(listing.price)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ... rest of mobile errors ... */}
            {showSearchResults && searchQuery.trim() && !isSearching && searchResults.length === 0 && (
              <div className="absolute top-full mt-2 w-full bg-background border border-border rounded-xl shadow-lg p-3 z-50">
                <p className="text-xs text-muted-foreground text-center">No listings found</p>
              </div>
            )}

            {isSearching && searchQuery.trim() && (
              <div className="absolute top-full mt-2 w-full bg-background border border-border rounded-xl shadow-lg p-3 z-50">
                <p className="text-xs text-muted-foreground text-center">Searching...</p>
              </div>
            )}
          </div>
        </div>

        {isMenuOpen && (
          <div className="border-t border-border py-4 md:hidden animate-float-in-up">
            <div className="flex flex-col gap-2">
              {/* ... mobile menu items ... */}
              <Button asChild variant="ghost" className="justify-start">
                <Link href="/listings">
                  <Search className="mr-2 h-4 w-4" />
                  Browse
                </Link>
              </Button>
              <Button asChild variant="default" className="justify-start">
                <Link href="/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Sell Item
                </Link>
              </Button>
              <Button asChild variant="ghost" className="justify-start relative">
                <Link href="/messages" className="flex items-center">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Messages
                  {unreadConversationCount > 0 && (
                    <Badge className="ml-2 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary text-primary-foreground">
                      {unreadConversationCount > 9 ? "9+" : unreadConversationCount}
                    </Badge>
                  )}
                </Link>
              </Button>
              <Button asChild variant="ghost" className="justify-start">
                <Link href="/profile">
                  <User className="mr-2 h-4 w-4" />
                  My Profile
                </Link>
              </Button>
              {user?.role === "0" && (
                <Button asChild variant="ghost" className="justify-start">
                  <Link href="/admin/dashboard">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin Dashboard
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}