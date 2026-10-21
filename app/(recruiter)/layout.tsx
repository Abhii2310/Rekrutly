import { Sidebar } from "@/components/frame/sidebar"
import { Spotlight } from "@/components/frame/spotlight"
import { env } from "@/lib/env"

export default function RecruiterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar demoMode={env.DEMO_MODE} />
      <main className="min-w-0 flex-1 bg-canvas">{children}</main>
      <Spotlight />
    </div>
  )
}
