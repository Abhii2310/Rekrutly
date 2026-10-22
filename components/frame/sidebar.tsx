"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Activity, BookOpen, Columns3, Briefcase, ChartColumn, Clapperboard, Command, LayoutGrid, LogOut, ScrollText, Search, Settings, Users } from "lucide-react"
import { cn } from "cn"
import { DemoTag } from "@/components/ui/tags"

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutGrid },
  { href: "/command", label: "Command", icon: Command },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/board", label: "Board", icon: Columns3 },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/war-room", label: "War Room", icon: Activity },
  { href: "/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/activity", label: "Activity", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/guide", label: "Guide", icon: BookOpen },
] as const

function isActive(pathname: string, href: string): boolean {
    if (href === "/war-room") return pathname === "/war-room" || /^\/runs\/[^/]+\/war-room/.test(pathname)
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** 240px mist sidebar; collapses to a 72px icon rail under 1024px. */
export function Sidebar({ demoMode, showSignOut = true }: { demoMode: boolean; showSignOut?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = React.useState(false)

  async function signOut() {
    setSigningOut(true)
    await fetch("/api/auth/logout", { method: "POST" })
    router.replace("/login")
    router.refresh()
  }

  return (
    <aside data-print-hide className="sticky top-0 flex h-screen w-[72px] shrink-0 flex-col bg-mist px-3 py-6 lg:w-[240px] lg:px-4">
      <Link href="/overview" className="focus-ring mb-8 flex h-9 items-center rounded-[8px] px-2.5 text-[17px] font-semibold leading-[22px] tracking-[-0.01em] text-ink">
        <span className="lg:hidden" aria-hidden>R</span>
        <span className="hidden lg:inline">Rekrutly</span>
        <span className="sr-only lg:hidden">Rekrutly</span>
      </Link>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("spotlight:open"))}
        className="focus-ring t-body mb-3 flex h-9 items-center gap-3 rounded-[8px] bg-canvas px-2.5 text-ink-2 transition-colors duration-[160ms] hover:text-ink"
      >
        <Search aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
        <span className="hidden lg:inline">Ask or search</span>
        <span className="sr-only lg:hidden">Ask or search</span>
        <span className="t-footnote ml-auto hidden text-ink-2 lg:inline">⌘K</span>
      </button>

      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {(demoMode ? [...NAV, { href: "/demo", label: "Demo Director", icon: Clapperboard }] : NAV).map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-ring t-body flex h-9 items-center gap-3 rounded-[8px] px-2.5 transition-colors duration-[160ms]",
                active ? "bg-canvas font-medium text-ink" : "text-ink-2 hover:text-ink"
              )}
            >
              <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
              <span className="hidden lg:inline">{label}</span>
              <span className="sr-only lg:hidden">{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col items-start gap-3">
        {demoMode ? <span className="hidden lg:inline-flex"><DemoTag /></span> : null}
        {showSignOut ? (
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="focus-ring t-body flex h-9 items-center gap-3 rounded-[8px] px-2.5 text-action transition-colors hover:text-action-hover disabled:opacity-50"
          >
            <LogOut aria-hidden className="size-[18px] lg:hidden" strokeWidth={1.75} />
            <span className="hidden lg:inline">Sign out</span>
            <span className="sr-only lg:hidden">Sign out</span>
          </button>
        ) : null}
      </div>
    </aside>
  )
}
