"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import {
  Shield,
  Flag,
  Users,
  BarChart3,
  Settings,
  AlertCircle,
  ArrowRight,
  LayoutDashboard,
} from "lucide-react"
import Link from "next/link"

export default function AdminDashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated, isHydrated } = useAuth()

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

  const adminFeatures = [
    {
      title: "Flagged Listings",
      description: "Review and manage listings that have been reported by users",
      icon: Flag,
      href: "/flagged",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/20",
    },
    {
      title: "User Management",
      description: "View and manage user accounts and permissions",
      icon: Users,
      href: "#",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
      disabled: true,
    },
    {
      title: "Analytics",
      description: "View platform statistics and performance metrics",
      icon: BarChart3,
      href: "#",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/20",
      disabled: true,
    },
    {
      title: "System Settings",
      description: "Configure platform settings and preferences",
      icon: Settings,
      href: "#",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/20",
      disabled: true,
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 animate-float-in-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-xl bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-lg text-muted-foreground">Manage and monitor your platform</p>
            </div>
          </div>
        </div>

        {/* Welcome Card */}
        <Card className="mb-8 animate-float-in-up premium-card border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5" />
              Welcome, Admin
            </CardTitle>
            <CardDescription>
              Use the dashboard to access administrative tools and manage platform content.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>You have administrative privileges. Use these tools responsibly.</span>
            </div>
          </CardContent>
        </Card>

        {/* Admin Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {adminFeatures.map((feature, index) => {
            const Icon = feature.icon
            const isDisabled = feature.disabled

            if (isDisabled) {
              return (
                <Card
                  key={feature.title}
                  className="animate-float-in-up opacity-60 cursor-not-allowed"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className={`p-3 rounded-xl ${feature.bgColor}`}>
                        <Icon className={`h-6 w-6 ${feature.color}`} />
                      </div>
                    </div>
                    <CardTitle className="mt-4">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" disabled className="w-full">
                      Coming Soon
                    </Button>
                  </CardContent>
                </Card>
              )
            }

            return (
              <Card
                key={feature.title}
                className={`animate-float-in-up premium-card hover:shadow-lg transition-all duration-300 border ${feature.borderColor} hover:border-primary/40`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-xl ${feature.bgColor}`}>
                      <Icon className={`h-6 w-6 ${feature.color}`} />
                    </div>
                  </div>
                  <CardTitle className="mt-4">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full magnetic-button" variant="default">
                    <Link href={feature.href} className="flex items-center justify-center gap-2">
                      Open
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Quick Stats (Future Enhancement) */}
        <Card className="mt-8 animate-float-in-up">
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>Platform statistics at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Total Listings</p>
                <p className="text-2xl font-bold">-</p>
                <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
              </div>
              <div className="p-4 rounded-lg border bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Active Users</p>
                <p className="text-2xl font-bold">-</p>
                <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
              </div>
              <div className="p-4 rounded-lg border bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Flagged Items</p>
                <p className="text-2xl font-bold">-</p>
                <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

