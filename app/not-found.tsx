import { ErrorState } from "@/components/ui/error-state"

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <ErrorState message="That page doesn't exist." hint="Check the link, or go back to your overview." action={{ label: "Go to Overview", href: "/" }} />
    </div>
  )
}
