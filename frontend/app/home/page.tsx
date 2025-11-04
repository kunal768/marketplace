"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Navigation } from "@/components/navigation"
import { BookOpen, Laptop, Shirt, Home, TrendingUp, Clock } from "lucide-react"

const featuredListings = [
  {
    id: 1,
    title: "Calculus Textbook - 8th Edition",
    price: 45,
    image: "/calculus-textbook.png",
    category: "Textbooks",
    condition: "Like New",
    seller: "Sarah M.",
    timeAgo: "2h ago",
  },
  {
    id: 2,
    title: "MacBook Pro 2020 - 13 inch",
    price: 850,
    image: "/macbook-pro-laptop.png",
    category: "Electronics",
    condition: "Good",
    seller: "Mike T.",
    timeAgo: "5h ago",
  },
  {
    id: 3,
    title: "Mini Fridge - Perfect for Dorm",
    price: 75,
    image: "/mini-fridge.jpg",
    category: "Furniture",
    condition: "Excellent",
    seller: "Emma L.",
    timeAgo: "1d ago",
  },
  {
    id: 4,
    title: "University Hoodie - Size M",
    price: 25,
    image: "/university-hoodie.jpg",
    category: "Clothing",
    condition: "Like New",
    seller: "Alex K.",
    timeAgo: "3h ago",
  },
  {
    id: 5,
    title: "Chemistry Lab Manual",
    price: 30,
    image: "/chemistry-lab-manual.jpg",
    category: "Textbooks",
    condition: "Good",
    seller: "Jordan P.",
    timeAgo: "6h ago",
  },
  {
    id: 6,
    title: "Desk Lamp with USB Port",
    price: 20,
    image: "/modern-desk-lamp.png",
    category: "Furniture",
    condition: "Excellent",
    seller: "Taylor R.",
    timeAgo: "4h ago",
  },
]

const categories = [
  { name: "Textbooks", icon: BookOpen, count: 234 },
  { name: "Electronics", icon: Laptop, count: 156 },
  { name: "Clothing", icon: Shirt, count: 89 },
  { name: "Furniture", icon: Home, count: 67 },
]

export default function HomePage() {
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
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
      observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [])

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
            {categories.map((category, index) => {
              const Icon = category.icon
              return (
                <Link key={category.name} href={`/listings?category=${category.name}`}>
                  <Card className={`premium-card cursor-pointer scroll-reveal stagger-${index + 1}`}>
                    <CardContent className="flex flex-col items-center gap-4 p-8">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
                        <Icon className="h-8 w-8 text-primary" />
                      </div>
                      <div className="text-center">
                        <h3 className="font-semibold text-lg text-foreground">{category.name}</h3>
                        <p className="text-sm text-muted-foreground">{category.count} items</p>
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

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {featuredListings.map((listing, index) => (
              <Link key={listing.id} href={`/listing/${listing.id}`}>
                <Card
                  className={`overflow-hidden premium-card cursor-pointer h-full scroll-reveal stagger-${(index % 3) + 1}`}
                >
                  <CardHeader className="p-0">
                    <div className="relative aspect-square overflow-hidden bg-muted">
                      <img
                        src={listing.image || "/placeholder.svg"}
                        alt={listing.title}
                        className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
                      />
                      <Badge className="absolute right-3 top-3 bg-background/90 text-foreground backdrop-blur-sm">
                        {listing.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <h3 className="mb-3 font-semibold text-lg text-foreground line-clamp-2">{listing.title}</h3>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-3xl font-bold text-primary">${listing.price}</span>
                      <Badge variant="secondary" className="text-sm">
                        {listing.condition}
                      </Badge>
                    </div>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between border-t border-border p-6 text-sm text-muted-foreground">
                    <span className="font-medium">{listing.seller}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {listing.timeAgo}
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
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
