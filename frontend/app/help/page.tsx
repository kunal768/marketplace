"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-gradient-to-br from-accent/10 via-background to-primary/10">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <p className="text-sm uppercase tracking-wide text-primary font-semibold mb-4">Help Center</p>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">Phantom Support · CMPE 202</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Whether you are listing your first textbook or coordinating a pickup on the SJSU campus, the Phantom team is
            here to help. Use the quick guides below or reach out to us directly during the Fall 2025 term.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button asChild size="lg" className="magnetic-button">
              <Link href="/home">Return to Home</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="magnetic-button">
              <Link href="/about">Meet the Team</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16 grid gap-8 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardContent className="p-8 space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Getting Started</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>Use your SJSU email to log in and verify your identity.</li>
              <li>Browse categories like Textbooks, Electronics, or Dorm Essentials.</li>
              <li>Create listings with clear photos, pricing, and pickup details.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-8 space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Need More Help?</h2>
            <p className="text-muted-foreground">
              The Phantom crew (Kunal Sahni, Nikhil, and Dan Lam) monitors the CMPE 202 Slack channel during the semester.
              You can also open an issue on our project board or email us at phantom-team@sjsu.edu for any urgent
              marketplace questions.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

