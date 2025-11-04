"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Edit, Trash2, MapPin, Mail, Calendar, Package } from "lucide-react"

const myListings = [
  {
    id: 1,
    title: "Calculus Textbook - 8th Edition",
    price: 45,
    image: "/calculus-textbook.png",
    category: "Textbooks",
    condition: "Like New",
    views: 124,
    status: "active",
  },
  {
    id: 2,
    title: "MacBook Pro 2020 - 13 inch",
    price: 850,
    image: "/macbook-pro-laptop.png",
    category: "Electronics",
    condition: "Good",
    views: 89,
    status: "active",
  },
  {
    id: 3,
    title: "Mini Fridge - Perfect for Dorm",
    price: 75,
    image: "/mini-fridge.jpg",
    category: "Furniture",
    condition: "Excellent",
    views: 56,
    status: "sold",
  },
]

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("active")

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <Card className="mb-8 overflow-hidden animate-scale-in-bounce">
          <div className="h-32 bg-gradient-to-r from-primary to-accent" />
          <CardContent className="relative pt-0 pb-8">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6 -mt-16">
              <Avatar className="h-32 w-32 border-4 border-card shadow-xl">
                <AvatarImage src="/placeholder.svg?height=128&width=128" />
                <AvatarFallback className="text-3xl">JD</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-foreground mb-2">John Doe</h1>
                <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    john.doe@university.edu
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    Campus Area
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Joined Jan 2025
                  </span>
                </div>
              </div>
              <Button size="lg" className="magnetic-button">
                Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { label: "Active Listings", value: "2", icon: Package },
            { label: "Total Views", value: "269", icon: Package },
            { label: "Items Sold", value: "1", icon: Package },
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
            <h2 className="text-2xl font-bold">My Listings</h2>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="sold">Sold</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myListings
                    .filter((listing) => listing.status === "active")
                    .map((listing, index) => (
                      <Card key={listing.id} className={`premium-card animate-float-in-up stagger-${index + 1}`}>
                        <CardHeader className="p-0">
                          <div className="relative aspect-square overflow-hidden bg-muted rounded-t-xl">
                            <img
                              src={listing.image || "/placeholder.svg"}
                              alt={listing.title}
                              className="h-full w-full object-cover"
                            />
                            <Badge className="absolute right-3 top-3 bg-background/90 backdrop-blur-sm">
                              {listing.category}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-foreground mb-2 line-clamp-2">{listing.title}</h3>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl font-bold text-primary">${listing.price}</span>
                            <Badge variant="secondary">{listing.condition}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{listing.views} views</p>
                        </CardContent>
                        <CardFooter className="p-4 pt-0 flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1 magnetic-button bg-transparent">
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 magnetic-button text-destructive hover:bg-destructive hover:text-destructive-foreground bg-transparent"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                </div>
              </TabsContent>

              <TabsContent value="sold">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myListings
                    .filter((listing) => listing.status === "sold")
                    .map((listing) => (
                      <Card key={listing.id} className="premium-card opacity-75">
                        <CardHeader className="p-0">
                          <div className="relative aspect-square overflow-hidden bg-muted rounded-t-xl">
                            <img
                              src={listing.image || "/placeholder.svg"}
                              alt={listing.title}
                              className="h-full w-full object-cover"
                            />
                            <Badge className="absolute right-3 top-3 bg-green-500 text-white">Sold</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-foreground mb-2 line-clamp-2">{listing.title}</h3>
                          <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold text-primary">${listing.price}</span>
                            <Badge variant="secondary">{listing.condition}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </TabsContent>

              <TabsContent value="all">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myListings.map((listing, index) => (
                    <Card key={listing.id} className={`premium-card animate-float-in-up stagger-${index + 1}`}>
                      <CardHeader className="p-0">
                        <div className="relative aspect-square overflow-hidden bg-muted rounded-t-xl">
                          <img
                            src={listing.image || "/placeholder.svg"}
                            alt={listing.title}
                            className="h-full w-full object-cover"
                          />
                          <Badge
                            className={`absolute right-3 top-3 ${listing.status === "sold" ? "bg-green-500 text-white" : "bg-background/90 backdrop-blur-sm"}`}
                          >
                            {listing.status === "sold" ? "Sold" : listing.category}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-foreground mb-2 line-clamp-2">{listing.title}</h3>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-2xl font-bold text-primary">${listing.price}</span>
                          <Badge variant="secondary">{listing.condition}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{listing.views} views</p>
                      </CardContent>
                      {listing.status === "active" && (
                        <CardFooter className="p-4 pt-0 flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1 magnetic-button bg-transparent">
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 magnetic-button text-destructive hover:bg-destructive hover:text-destructive-foreground bg-transparent"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </CardFooter>
                      )}
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
