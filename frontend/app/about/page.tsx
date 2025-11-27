"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const teamMembers = ["Kunal Sahni", "Nikhil", "Dan Lam"]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <p className="text-sm uppercase tracking-wide text-primary font-semibold mb-4">About Phantom</p>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">Built for CMPE 202 · Fall 2025</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            CampusMart started as Phantom&apos;s capstone project for San Jose State University&apos;s CMPE 202 cohort.
            We designed it to help Spartans trade textbooks, dorm essentials, and tech gear quickly and safely without
            leaving campus.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button asChild size="lg" className="magnetic-button">
              <Link href="/home">Back to Home</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="magnetic-button">
              <Link href="/help">Need Help?</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="grid gap-8 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardContent className="p-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">Project Mission</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our goal is to streamline the campus resale experience with a curated marketplace tailored specifically
                for SJSU students. Phantom focused on trustworthy listings, smooth chat workflows, and lightweight
                moderation tools so students can focus on exchanging items, not logistics.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">Team Phantom</h2>
              <ul className="space-y-2 text-muted-foreground">
                {teamMembers.map((member) => (
                  <li key={member} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    {member}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

