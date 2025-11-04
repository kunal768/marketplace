"use client"

import { useState, useEffect } from "react"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Search, SlidersHorizontal, Clock, X } from "lucide-react"
import Link from "next/link"

// Mock listings data
const allListings = [
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
  {
    id: 7,
    title: "iPhone 13 - 128GB",
    price: 450,
    image: "/iphone-13.jpg",
    category: "Electronics",
    condition: "Good",
    seller: "Chris B.",
    timeAgo: "8h ago",
  },
  {
    id: 8,
    title: "Biology Textbook Bundle",
    price: 65,
    image: "/biology-textbook.jpg",
    category: "Textbooks",
    condition: "Like New",
    seller: "Morgan S.",
    timeAgo: "12h ago",
  },
]

const categories = ["All", "Textbooks", "Electronics", "Clothing", "Furniture", "Sports", "Other"]
const conditions = ["New", "Like New", "Good", "Fair"]

export default function ListingsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedConditions, setSelectedConditions] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState([0, 1000])
  const [sortBy, setSortBy] = useState("recent")

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

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    )
  }

  const toggleCondition = (condition: string) => {
    setSelectedConditions((prev) =>
      prev.includes(condition) ? prev.filter((c) => c !== condition) : [...prev, condition],
    )
  }

  const clearFilters = () => {
    setSelectedCategories([])
    setSelectedConditions([])
    setPriceRange([0, 1000])
    setSearchQuery("")
  }

  const FilterContent = () => (
    <div className="space-y-6">
      <div>
        <Label className="mb-3 block text-base font-semibold">Category</Label>
        <div className="space-y-2">
          {categories
            .filter((c) => c !== "All")
            .map((category) => (
              <div key={category} className="flex items-center space-x-2">
                <Checkbox
                  id={`category-${category}`}
                  checked={selectedCategories.includes(category)}
                  onCheckedChange={() => toggleCategory(category)}
                />
                <label
                  htmlFor={`category-${category}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {category}
                </label>
              </div>
            ))}
        </div>
      </div>

      <div>
        <Label className="mb-3 block text-base font-semibold">Condition</Label>
        <div className="space-y-2">
          {conditions.map((condition) => (
            <div key={condition} className="flex items-center space-x-2">
              <Checkbox
                id={`condition-${condition}`}
                checked={selectedConditions.includes(condition)}
                onCheckedChange={() => toggleCondition(condition)}
              />
              <label
                htmlFor={`condition-${condition}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {condition}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-3 block text-base font-semibold">
          Price Range: ${priceRange[0]} - ${priceRange[1]}
        </Label>
        <Slider value={priceRange} onValueChange={setPriceRange} max={1000} step={10} className="mt-2" />
      </div>

      <Button variant="outline" className="w-full bg-transparent magnetic-button" onClick={clearFilters}>
        Clear All Filters
      </Button>
    </div>
  )

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
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
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
            {(selectedCategories.length > 0 || selectedConditions.length > 0) && (
              <div className="mb-6 flex flex-wrap gap-2 animate-float-in-up">
                {selectedCategories.map((category) => (
                  <Badge key={category} variant="secondary" className="gap-1 px-3 py-1 text-sm">
                    {category}
                    <button onClick={() => toggleCategory(category)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {selectedConditions.map((condition) => (
                  <Badge key={condition} variant="secondary" className="gap-1 px-3 py-1 text-sm">
                    {condition}
                    <button onClick={() => toggleCondition(condition)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="mb-6 text-base text-muted-foreground scroll-reveal">
              <span className="font-semibold text-foreground">8</span> items found
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {allListings.map((listing, index) => (
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
                    <CardContent className="p-5">
                      <h3 className="mb-3 font-semibold text-lg text-foreground line-clamp-2">{listing.title}</h3>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-3xl font-bold text-primary">${listing.price}</span>
                        <Badge variant="secondary" className="text-sm">
                          {listing.condition}
                        </Badge>
                      </div>
                    </CardContent>
                    <CardFooter className="flex items-center justify-between border-t border-border p-5 text-sm text-muted-foreground">
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
        </div>
      </div>
    </div>
  )
}
