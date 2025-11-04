"use client"

import type React from "react"
import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, X, DollarSign, Tag, Package } from "lucide-react"
import { useRouter } from "next/navigation"

const categories = ["Textbooks", "Electronics", "Clothing", "Furniture", "Sports", "Other"]
const conditions = ["New", "Like New", "Good", "Fair", "Poor"]

export default function CreateListingPage() {
  const router = useRouter()
  const [images, setImages] = useState<string[]>([])
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    condition: "",
    location: "",
  })

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const newImages = Array.from(files).map((file) => URL.createObjectURL(file))
      setImages([...images, ...newImages].slice(0, 5))
    }
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Submitting listing:", { ...formData, images })
    router.push("/profile")
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 animate-float-in-up">
            <h1 className="mb-3 text-4xl font-bold text-foreground">Create a Listing</h1>
            <p className="text-lg text-muted-foreground">Fill out the details below to list your item for sale</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              <Card className="premium-card animate-scale-in-bounce">
                <CardHeader>
                  <CardTitle className="text-xl">Photos</CardTitle>
                  <CardDescription className="text-base">Add up to 5 photos of your item</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      {images.map((image, index) => (
                        <div
                          key={index}
                          className="relative aspect-square overflow-hidden rounded-xl border-2 border-border transition-all hover:border-primary"
                        >
                          <img
                            src={image || "/placeholder.svg"}
                            alt={`Upload ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute right-2 top-2 h-8 w-8 magnetic-button"
                            onClick={() => removeImage(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {images.length < 5 && (
                        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50 transition-all hover:bg-muted hover:border-primary">
                          <Upload className="mb-2 h-10 w-10 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">Upload Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="premium-card animate-scale-in-bounce stagger-1">
                <CardHeader>
                  <CardTitle className="text-xl">Basic Information</CardTitle>
                  <CardDescription className="text-base">Provide details about your item</CardDescription>
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
                      Description *
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Describe your item, its condition, and any important details..."
                      rows={6}
                      className="text-base resize-none"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
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
                      <Label htmlFor="condition" className="text-base">
                        Condition *
                      </Label>
                      <Select
                        value={formData.condition}
                        onValueChange={(value) => setFormData({ ...formData, condition: value })}
                      >
                        <SelectTrigger id="condition" className="h-12">
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                          {conditions.map((condition) => (
                            <SelectItem key={condition} value={condition}>
                              {condition}
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
                  <CardTitle className="text-xl">Pricing & Location</CardTitle>
                  <CardDescription className="text-base">Set your price and pickup location</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="price" className="text-base">
                      Price *
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="price"
                        type="number"
                        placeholder="0.00"
                        className="pl-12 h-12 text-base"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-base">
                      Pickup Location *
                    </Label>
                    <Input
                      id="location"
                      placeholder="e.g., Student Union, Main Library"
                      className="h-12 text-base"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      required
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 animate-scale-in-bounce stagger-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Tag className="h-6 w-6 text-primary" />
                    Tips for a Great Listing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-base text-muted-foreground">
                    <li className="flex gap-3 items-start">
                      <span className="text-primary text-xl">•</span>
                      <span>Use clear, well-lit photos from multiple angles</span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="text-primary text-xl">•</span>
                      <span>Be honest about the condition and any flaws</span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="text-primary text-xl">•</span>
                      <span>Price competitively by checking similar listings</span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="text-primary text-xl">•</span>
                      <span>Respond quickly to interested buyers</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <div className="flex gap-4 animate-float-in-up stagger-4">
                <Button type="submit" size="lg" className="flex-1 h-14 text-base font-semibold magnetic-button">
                  <Package className="mr-2 h-5 w-5" />
                  Publish Listing
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-14 px-8 magnetic-button bg-transparent"
                  onClick={() => router.back()}
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
