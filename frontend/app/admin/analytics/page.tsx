"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { orchestratorApi } from "@/lib/api/orchestrator"
import type { AnalyticsResponse } from "@/lib/api/types"
import {
  Shield,
  Flag,
  Users,
  BarChart3,
  AlertCircle,
  ArrowLeft,
  Package,
  AlertTriangle,
} from "lucide-react"
import Link from "next/link"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, Pie, PieChart, Cell, XAxis, YAxis } from "recharts"

export default function AdminAnalyticsPage() {
  const router = useRouter()
  const { user, token, isAuthenticated, isHydrated } = useAuth()
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRefreshToken(localStorage.getItem("frontend-refreshToken"))
    }
  }, [])

  // Check if user is admin and redirect if not
  useEffect(() => {
    if (isHydrated) {
      if (!isAuthenticated) {
        router.push("/")
        return
      }
      if (user?.role !== "0") {
        // Not an admin, redirect to home
        router.push("/home")
        return
      }
    }
  }, [isHydrated, isAuthenticated, user, router])

  // Fetch analytics data
  useEffect(() => {
    if (!isHydrated || !isAuthenticated || user?.role !== "0" || !token || !refreshToken) {
      return
    }

    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await orchestratorApi.getAnalytics(token, refreshToken)
        // Ensure all array fields are initialized (defensive programming)
        setAnalytics({
          ...data,
          listings_by_status: data.listings_by_status || [],
          listings_by_category: data.listings_by_category || [],
          flags_by_status: data.flags_by_status || [],
          flags_by_reason: data.flags_by_reason || [],
        })
      } catch (err) {
        console.error("Error fetching analytics:", err)
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch analytics"
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [isHydrated, isAuthenticated, user, token, refreshToken])

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || user?.role !== "0") {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 animate-float-in-up">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-500/10">
                <BarChart3 className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-foreground">Analytics Dashboard</h1>
                <p className="text-lg text-muted-foreground">Platform statistics and performance metrics</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Card className="mb-8 animate-float-in-up border-destructive/20 bg-destructive/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overview Stats Cards */}
        <Card className="mb-8 animate-float-in-up">
          <CardHeader>
            <CardTitle>Platform Overview</CardTitle>
            <CardDescription>Key metrics at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : analytics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg border bg-blue-500/10 border-blue-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    <p className="text-sm text-muted-foreground">Total Users</p>
                  </div>
                  <p className="text-3xl font-bold">{analytics.overview.total_users.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-green-500" />
                    <p className="text-sm text-muted-foreground">Total Listings</p>
                  </div>
                  <p className="text-3xl font-bold">{analytics.overview.total_listings.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg border bg-orange-500/10 border-orange-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Flag className="h-5 w-5 text-orange-500" />
                    <p className="text-sm text-muted-foreground">Open Flags</p>
                  </div>
                  <p className="text-3xl font-bold">{analytics.overview.open_flags.toLocaleString()}</p>
                  {analytics.overview.open_flags > 0 && (
                    <p className="text-xs text-orange-600 mt-1">Requires attention</p>
                  )}
                </div>
                <div className="p-4 rounded-lg border bg-yellow-500/10 border-yellow-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <p className="text-sm text-muted-foreground">Total Flags</p>
                  </div>
                  <p className="text-3xl font-bold">{analytics.overview.total_flags.toLocaleString()}</p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Charts Section */}
        {analytics && !loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Listings by Status Chart */}
            <Card className="animate-float-in-up">
              <CardHeader>
                <CardTitle>Listings by Status</CardTitle>
                <CardDescription>Distribution of listings across different statuses</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    available: { label: "Available", color: "var(--chart-1)" },
                    pending: { label: "Pending", color: "var(--chart-2)" },
                    sold: { label: "Sold", color: "var(--chart-3)" },
                    archived: { label: "Archived", color: "var(--chart-4)" },
                    reported: { label: "Reported", color: "var(--chart-5)" },
                  }}
                  className="h-[300px]"
                >
                  <BarChart data={analytics.listings_by_status || []}>
                    <XAxis
                      dataKey="status"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={4}>
                      {(analytics.listings_by_status || []).map((entry, index) => {
                        const colors = [
                          "var(--chart-1)",
                          "var(--chart-2)",
                          "var(--chart-3)",
                          "var(--chart-4)",
                          "var(--chart-5)",
                        ]
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={colors[index % colors.length]}
                          />
                        )
                      })}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Listings by Category Chart */}
            <Card className="animate-float-in-up">
              <CardHeader>
                <CardTitle>Listings by Category</CardTitle>
                <CardDescription>Distribution of listings across categories</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    textbook: { label: "Textbook", color: "var(--chart-1)" },
                    gadget: { label: "Gadget", color: "var(--chart-2)" },
                    essential: { label: "Essential", color: "var(--chart-3)" },
                    "non-essential": { label: "Non-Essential", color: "var(--chart-4)" },
                    other: { label: "Other", color: "var(--chart-5)" },
                    test: { label: "Test", color: "var(--chart-1)" },
                  }}
                  className="h-[300px]"
                >
                  <PieChart>
                    <Pie
                      data={analytics.listings_by_category || []}
                      dataKey="count"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ category, count }) => `${category}: ${count}`}
                    >
                      {(analytics.listings_by_category || []).map((entry, index) => {
                        const colors = [
                          "var(--chart-1)",
                          "var(--chart-2)",
                          "var(--chart-3)",
                          "var(--chart-4)",
                          "var(--chart-5)",
                        ]
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={colors[index % colors.length]}
                          />
                        )
                      })}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Flags by Status Chart */}
            <Card className="animate-float-in-up">
              <CardHeader>
                <CardTitle>Flags by Status</CardTitle>
                <CardDescription>Distribution of flags across different statuses</CardDescription>
              </CardHeader>
              <CardContent>
                {(!analytics.flags_by_status || analytics.flags_by_status.length === 0) ? (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    <div className="text-center">
                      <Flag className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No flags data available</p>
                    </div>
                  </div>
                ) : (
                  <ChartContainer
                    config={{
                      OPEN: { label: "Open", color: "var(--chart-1)" },
                      UNDER_REVIEW: { label: "Under Review", color: "var(--chart-2)" },
                      RESOLVED: { label: "Resolved", color: "var(--chart-3)" },
                      DISMISSED: { label: "Dismissed", color: "var(--chart-4)" },
                    }}
                    className="h-[300px]"
                  >
                    <BarChart data={analytics.flags_by_status}>
                      <XAxis
                        dataKey="status"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" radius={4}>
                        {analytics.flags_by_status.map((entry, index) => {
                          const colors = [
                            "var(--chart-1)",
                            "var(--chart-2)",
                            "var(--chart-3)",
                            "var(--chart-4)",
                            "var(--chart-5)",
                          ]
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={colors[index % colors.length]}
                            />
                          )
                        })}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Flags by Reason Chart */}
            <Card className="animate-float-in-up">
              <CardHeader>
                <CardTitle>Flags by Reason</CardTitle>
                <CardDescription>Distribution of flags by reporting reason</CardDescription>
              </CardHeader>
              <CardContent>
                {(!analytics.flags_by_reason || analytics.flags_by_reason.length === 0) ? (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    <div className="text-center">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No flags data available</p>
                    </div>
                  </div>
                ) : (
                  <ChartContainer
                    config={{
                      SPAM: { label: "Spam", color: "var(--chart-1)" },
                      SCAM: { label: "Scam", color: "var(--chart-2)" },
                      INAPPROPRIATE: { label: "Inappropriate", color: "var(--chart-3)" },
                      MISLEADING: { label: "Misleading", color: "var(--chart-4)" },
                      OTHER: { label: "Other", color: "var(--chart-5)" },
                    }}
                    className="h-[300px]"
                  >
                    <PieChart>
                      <Pie
                        data={analytics.flags_by_reason}
                        dataKey="count"
                        nameKey="reason"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ reason, count }) => `${reason}: ${count}`}
                      >
                        {analytics.flags_by_reason.map((entry, index) => {
                          const colors = [
                            "var(--chart-1)",
                            "var(--chart-2)",
                            "var(--chart-3)",
                            "var(--chart-4)",
                            "var(--chart-5)",
                          ]
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={colors[index % colors.length]}
                            />
                          )
                        })}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

