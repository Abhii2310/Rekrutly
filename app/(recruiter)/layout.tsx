import 'server-only';
import { Sidebar } from "@/components/frame/sidebar"
import { Spotlight } from "@/components/frame/spotlight"
import { env } from "@/lib/env"
import { passcodeRequired } from "@/lib/security/access"

export default function RecruiterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar demoMode={env.DEMO_MODE} showSignOut={passcodeRequired()} />
      <main className="min-w-0 flex-1 bg-canvas">{children}</main>
      <Spotlight />
    </div>
  )
}
