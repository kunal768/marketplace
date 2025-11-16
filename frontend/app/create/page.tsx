"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, X, DollarSign, Tag, Package, Loader2, AlertCircle } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { orchestratorApi } from "@/lib/api/orchestrator"
import { getDisplayCategories, mapDisplayToCategory, dollarsToCents } from "@/lib/utils/listings"
import { useToast } from "@/hooks/use-toast"

const categories = getDisplayCategories()

export default function CreateListingPage() {
  const router = useRouter()
  const { token, isAuthenticated, isHydrated } = useAuth()
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState("")
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Store files with preview URLs
  interface ImageFile {
    file: File
    preview: string
  }

  const [images, setImages] = useState<ImageFile[]>([])
  const imagesRef = useRef<ImageFile[]>([])
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    condition: "",
    location: "",
  })

  const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB in bytes

  // Keep ref in sync with state
  useEffect(() => {
    imagesRef.current = images
  }, [images])

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newFiles: ImageFile[] = []
    const errors: string[] = []

    Array.from(files).forEach((file) => {
      // Check file size (20MB limit)
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} is too large. Maximum size is 20MB.`)
        return
      }

      // Check if it's an image
      if (!file.type.startsWith("image/")) {
        errors.push(`${file.name} is not an image file.`)
        return
      }

      // Check if we've reached the limit
      if (images.length + newFiles.length >= 5) {
        errors.push("Maximum 5 photos allowed.")
        return
      }

      newFiles.push({
        file,
        preview: URL.createObjectURL(file),
      })
    })

    if (errors.length > 0) {
      toast({
        title: "Upload Error",
        description: errors.join(" "),
        variant: "destructive",
      })
    }

    if (newFiles.length > 0) {
      setImages([...images, ...newFiles].slice(0, 5))
      setError(null)
    }

    // Reset input so same file can be selected again
    e.target.value = ""
  }

  const removeImage = (index: number) => {
    const imageToRemove = images[index]
    // Revoke object URL to free memory
    URL.revokeObjectURL(imageToRemove.preview)
    setImages(images.filter((_, i) => i !== index))
  }

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((img) => URL.revokeObjectURL(img.preview))
    }
  }, [])

  // Helper function to upload file to Azure Blob Storage using SAS URL
  const uploadFileToAzure = async (file: File, sasUrl: string, contentType: string): Promise<void> => {
    const response = await fetch(sasUrl, {
      method: "PUT",
      headers: {
        "x-ms-blob-type": "BlockBlob",
        "Content-Type": contentType,
      },
      body: file,
    })

    if (!response.ok && response.status !== 201 && response.status !== 202) {
      throw new Error(`Failed to upload file to Azure: ${response.status} ${response.statusText}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token || !refreshToken) {
      toast({
        title: "Error",
        description: "Authentication required",
        variant: "destructive",
      })
      return
    }

    // Validate form
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Title is required",
        variant: "destructive",
      })
      return
    }

    if (!formData.category) {
      toast({
        title: "Validation Error",
        description: "Category is required",
        variant: "destructive",
      })
      return
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast({
        title: "Validation Error",
        description: "Price must be greater than 0",
        variant: "destructive",
      })
      return
    }

    // Validate photos are mandatory
    if (images.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one photo is required",
        variant: "destructive",
      })
      return
    }

    try {
      setSubmitting(true)
      setUploading(true)
      setError(null)

      // Convert price from dollars to cents
      const priceInCents = dollarsToCents(parseFloat(formData.price))

      // Convert frontend category to backend category
      const backendCategory = mapDisplayToCategory(formData.category)

      // Step 1: Create the listing first to get listing ID
      setUploadProgress("Creating listing...")
      const createdListing = await orchestratorApi.createListing(token, refreshToken, {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        price: priceInCents,
        category: backendCategory,
      })

      // Step 2: Upload photos one by one
      const permanentUrls: string[] = []

      for (let i = 0; i < images.length; i++) {
        const imageFile = images[i]
        setUploadProgress(`Uploading photo ${i + 1} of ${images.length}...`)

        try {
          // Get SAS URL for this file
          const uploadResponse = await orchestratorApi.uploadMedia(token, refreshToken, [imageFile.file])

          if (uploadResponse.uploads.length === 0) {
            throw new Error(`No upload URLs returned for photo ${i + 1}`)
          }

          const uploadInfo = uploadResponse.uploads[0]

          // Upload file to Azure Blob Storage using SAS URL
          const contentType = imageFile.file.type || "image/jpeg"
          await uploadFileToAzure(imageFile.file, uploadInfo.sas_url, contentType)

          // Collect permanent public URL
          if (uploadInfo.permanent_public_url) {
            permanentUrls.push(uploadInfo.permanent_public_url)
          }
        } catch (err) {
          console.error(`Error uploading photo ${i + 1}:`, err)
          throw new Error(`Failed to upload photo ${i + 1}: ${err instanceof Error ? err.message : "Unknown error"}`)
        }
      }

      // Step 3: Save all permanent URLs to the listing
      if (permanentUrls.length > 0) {
        setUploadProgress("Saving photos to listing...")
        await orchestratorApi.addMediaURL(token, refreshToken, createdListing.id, permanentUrls)
      }

      toast({
        title: "Success",
        description: "Listing created successfully with photos!",
      })

      // Navigate to the new listing detail page
      router.push(`/listing/${createdListing.id}`)
    } catch (err) {
      console.error("Error creating listing:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to create listing"
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
      setUploading(false)
      setUploadProgress("")
    }
  }

  // Show loading state while checking authentication
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Upload overlay */}
      {uploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-semibold text-lg">{uploadProgress || "Processing..."}</p>
                  <p className="text-sm text-muted-foreground mt-2">Please wait while we upload your photos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
                  <CardTitle className="text-xl">Photos *</CardTitle>
                  <CardDescription className="text-base">
                    Add at least 1 photo (up to 5). Maximum file size: 20MB per photo.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {images.length === 0 && (
                      <div className="rounded-lg border-2 border-dashed border-destructive/50 bg-destructive/5 p-4 text-center">
                        <p className="text-sm text-destructive font-medium">At least one photo is required</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      {images.map((image, index) => (
                        <div
                          key={index}
                          className="relative aspect-square overflow-hidden rounded-xl border-2 border-border transition-all hover:border-primary"
                        >
                          <img
                            src={image.preview || "/placeholder.svg"}
                            alt={`Upload ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute right-2 top-2 h-8 w-8 magnetic-button"
                            onClick={() => removeImage(index)}
                            disabled={uploading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                            {(image.file.size / (1024 * 1024)).toFixed(2)} MB
                          </div>
                        </div>
                      ))}
                      {images.length < 5 && (
                        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50 transition-all hover:bg-muted hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed">
                          <Upload className="mb-2 h-10 w-10 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">Upload Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleImageUpload}
                            disabled={uploading}
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
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Describe your item, its condition, and any important details..."
                      rows={6}
                      className="text-base resize-none"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-base">
                      Category *
                    </Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                      required
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
                </CardContent>
              </Card>

              <Card className="premium-card animate-scale-in-bounce stagger-2">
                <CardHeader>
                  <CardTitle className="text-xl">Pricing</CardTitle>
                  <CardDescription className="text-base">Set your price</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="price" className="text-base">
                      Price (in dollars) *
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-12 h-12 text-base"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                      />
                    </div>
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

              {error && (
                <Card className="border-destructive bg-destructive/10">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-5 w-5" />
                      <p className="font-medium">{error}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-4 animate-float-in-up stagger-4">
                <Button
                  type="submit"
                  size="lg"
                  className="flex-1 h-14 text-base font-semibold magnetic-button"
                  disabled={submitting || uploading || images.length === 0}
                >
                  {submitting || uploading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {uploadProgress || "Creating..."}
                    </>
                  ) : (
                    <>
                      <Package className="mr-2 h-5 w-5" />
                      Publish Listing
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-14 px-8 magnetic-button bg-transparent"
                  onClick={() => router.back()}
                  disabled={submitting || uploading}
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