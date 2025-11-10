"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Plus, MessageSquare, User, Settings, LogOut, Menu } from "lucide-react"
import { useState, useEffect } from "react"

export function Navigation() {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
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

  return (
    <nav
      className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${
        isScrolled
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
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search for textbooks, electronics..."
                className="w-full pl-12 h-12 text-base rounded-xl border-2 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Button asChild variant="ghost" size="lg" className="magnetic-button">
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
            <Button asChild variant="ghost" size="icon" className="h-11 w-11 magnetic-button">
              <Link href="/messages">
                <MessageSquare className="h-5 w-5" />
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-11 w-11 magnetic-button">
                  <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                    <AvatarImage src="/placeholder.svg?height=36&width=36" />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <Settings className="mr-2 h-4 w-4" />
                    My Listings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Menu Button */}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <Menu className="h-6 w-6" />
          </Button>
        </div>

        {/* Mobile Search */}
        <div className="pb-4 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" placeholder="Search for textbooks, electronics..." className="w-full pl-10" />
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="border-t border-border py-4 md:hidden animate-float-in-up">
            <div className="flex flex-col gap-2">
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
              <Button asChild variant="ghost" className="justify-start">
                <Link href="/messages">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Messages
                </Link>
              </Button>
              <Button asChild variant="ghost" className="justify-start">
                <Link href="/profile">
                  <User className="mr-2 h-4 w-4" />
                  My Profile
                </Link>
              </Button>
              <Button asChild variant="ghost" className="justify-start">
                <Link href="/profile">
                  <Settings className="mr-2 h-4 w-4" />
                  My Listings
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
