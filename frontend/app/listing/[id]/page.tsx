"use client"

import { useState, useEffect } from "react"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  MessageSquare,
  MapPin,
  Clock,
  Star,
  ChevronLeft,
  ChevronRight,
  Heart,
  Share2,
  Flag,
  Package,
  Shield,
} from "lucide-react"
import Link from "next/link"

// Mock listing data
const listing = {
  id: 1,
  title: "Calculus Textbook - 8th Edition",
  price: 45,
  images: ["/calculus-textbook.png", "/textbook-spine.jpg", "/textbook-pages.jpg", "/textbook-back-cover.jpg"],
  category: "Textbooks",
  condition: "Like New",
  description:
    "Calculus: Early Transcendentals, 8th Edition by James Stewart. Used for one semester, in excellent condition with minimal highlighting. All pages intact, no water damage or torn pages. Perfect for MATH 141/142 courses.",
  location: "Main Library",
  seller: {
    name: "Sarah Martinez",
    avatar: "/placeholder.svg?height=100&width=100",
    rating: 4.8,
    totalSales: 23,
    joinedDate: "Jan 2024",
    responseTime: "Usually responds within 2 hours",
  },
  postedDate: "2 hours ago",
  views: 47,
}

const relatedListings = [
  {
    id: 2,
    title: "Physics Textbook - University Edition",
    price: 38,
    image: "/physics-textbook.jpg",
    condition: "Good",
  },
  {
    id: 3,
    title: "Chemistry Lab Manual",
    price: 30,
    image: "/chemistry-lab-manual.jpg",
    condition: "Like New",
  },
  {
    id: 4,
    title: "Statistics Workbook",
    price: 25,
    image: "/statistics-workbook.jpg",
    condition: "Good",
  },
]

export default function ListingDetailPage() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isSaved, setIsSaved] = useState(false)

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
  }, [])

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % listing.images.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + listing.images.length) % listing.images.length)
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
                <img
                  src={listing.images[currentImageIndex] || "/placeholder.svg"}
                  alt={listing.title}
                  className="h-full w-full object-cover transition-transform duration-700"
                />
                {listing.images.length > 1 && (
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
                      {listing.images.map((_, index) => (
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
              {listing.images.length > 1 && (
                <div className="grid grid-cols-4 gap-2 p-4">
                  {listing.images.map((image, index) => (
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
                <p className="text-foreground leading-relaxed text-lg">{listing.description}</p>
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
                      <span className="text-4xl font-bold text-primary">${listing.price}</span>
                      <Badge variant="secondary" className="text-base px-3 py-1">
                        {listing.condition}
                      </Badge>
                    </div>
                    <h1 className="mb-3 text-2xl font-bold text-foreground text-balance">{listing.title}</h1>
                    <Badge className="text-sm">{listing.category}</Badge>
                  </div>

                  <Separator className="my-6" />

                  <div className="mb-6 space-y-3 text-base">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <MapPin className="h-5 w-5 text-primary" />
                      <span>{listing.location}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Clock className="h-5 w-5 text-primary" />
                      <span>Posted {listing.postedDate}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Package className="h-5 w-5 text-primary" />
                      <span>{listing.views} views</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button className="w-full h-14 text-base font-semibold magnetic-button" size="lg">
                      <MessageSquare className="mr-2 h-5 w-5" />
                      Contact Seller
                    </Button>
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
                      <AvatarImage src={listing.seller.avatar || "/placeholder.svg"} />
                      <AvatarFallback className="text-lg">SM</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground text-lg">{listing.seller.name}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{listing.seller.rating}</span>
                        <span>•</span>
                        <span>{listing.seller.totalSales} sales</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    <p>Joined {listing.seller.joinedDate}</p>
                    <p className="text-primary font-medium">{listing.seller.responseTime}</p>
                  </div>

                  <Button asChild variant="outline" className="w-full h-12 magnetic-button bg-transparent">
                    <Link href={`/profile/${listing.seller.name}`}>View Profile</Link>
                  </Button>
                </CardContent>
              </Card>

              <Button
                variant="outline"
                className="w-full h-12 text-muted-foreground hover:text-destructive hover:border-destructive magnetic-button bg-transparent"
              >
                <Flag className="mr-2 h-5 w-5" />
                Report this listing
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-16">
          <h2 className="mb-8 text-3xl font-bold text-foreground scroll-reveal">Similar Listings</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relatedListings.map((item, index) => (
              <Link key={item.id} href={`/listing/${item.id}`}>
                <Card className={`overflow-hidden premium-card cursor-pointer scroll-reveal stagger-${index + 1}`}>
                  <div className="aspect-square overflow-hidden bg-muted">
                    <img
                      src={item.image || "/placeholder.svg"}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
                    />
                  </div>
                  <CardContent className="p-5">
                    <h3 className="mb-3 font-semibold text-foreground line-clamp-2 text-lg">{item.title}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-primary">${item.price}</span>
                      <Badge variant="secondary">{item.condition}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
