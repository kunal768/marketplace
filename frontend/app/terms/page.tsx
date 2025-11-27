"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <p className="text-sm uppercase tracking-wide text-primary font-semibold mb-4">Terms of Use</p>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">Phantom · CMPE 202 Fall 2025</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            These guidelines keep the CampusMart prototype safe for everyone testing it within the San Jose State
            University community. By accessing the platform you agree to follow the rules below during the CMPE 202
            course.
          </p>
          <div className="mt-10">
            <Button asChild size="lg" className="magnetic-button">
              <Link href="/home">Return to Home</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16 grid gap-8 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardContent className="p-8 space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Marketplace Expectations</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li>Only list items you personally own and can exchange on or near the SJSU campus.</li>
              <li>Respect fair pricing guidelines set by the Phantom team during the pilot.</li>
              <li>Use in-app messaging to coordinate meetups in well-lit, public university locations.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-8 space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Code of Conduct</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li>Harassment, discrimination, or spam will result in immediate removal from the pilot.</li>
              <li>Report suspicious activity to Phantom (Kunal Sahni, Nikhil, and Dan Lam) through Slack or email.</li>
              <li>These terms may evolve as the CMPE 202 class gathers feedback—stay tuned in class updates.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

