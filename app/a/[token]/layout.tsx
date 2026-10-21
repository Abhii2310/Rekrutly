import type { Metadata } from "next"

// Candidate pages are personal links: keep them out of search results.
export const metadata: Metadata = { title: "Rekrutly assessment", robots: { index: false, follow: false } }

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-canvas">{children}</div>
}
