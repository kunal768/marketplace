"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <p className="text-sm uppercase tracking-wide text-primary font-semibold mb-4">Privacy Notice</p>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">Phantom · SJSU CMPE 202</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            CampusMart runs as an academic prototype for the Fall 2025 Phantom team. We collect only the information
            required to validate SJSU participation and to facilitate student-to-student exchanges on campus.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button asChild size="lg" className="magnetic-button">
              <Link href="/home">Back to Home</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="magnetic-button">
              <Link href="/terms">Read Terms</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16 grid gap-8 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardContent className="p-8 space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Data We Collect</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li>SJSU email and name for authentication and team grading.</li>
              <li>Listing details, images, and chat excerpts relevant to marketplace activity.</li>
              <li>Basic device metadata to help Phantom debug features during demos.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-8 space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">How We Use It</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li>To keep transactions limited to verified SJSU students.</li>
              <li>To monitor safety, flag policy violations, and improve UX during CMPE 202 reviews.</li>
              <li>To generate anonymous project metrics for Phantom&apos;s final presentation.</li>
            </ul>
            <p className="text-muted-foreground">
              Data is stored in class-managed infrastructure and will be purged after the Fall 2025 semester unless you
              explicitly ask us to keep it for future research.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

