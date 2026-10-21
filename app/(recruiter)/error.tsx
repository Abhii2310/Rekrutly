"use client"

import { ErrorState } from "@/components/ui/error-state"

export default function RecruiterError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      message="This page couldn't load."
      hint="Try again. If it keeps happening, check the terminal running the app for the error."
      onRetry={reset}
    />
  )
}
