import { cn } from "cn"

/** White page, 640px centred column, wordmark top-left and nothing else. */
export function PortalShell({ right, progress, children }: { right?: React.ReactNode; progress?: number; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[640px] items-center justify-between px-4 sm:px-0">
          <span className="text-[17px] font-semibold leading-[22px] tracking-[-0.01em] text-ink">Rekrutly</span>
          {right}
        </div>
        <div className="h-0.5 w-full bg-fog" aria-hidden>
          <div className="h-full bg-ink transition-[width] duration-300 ease-[var(--ease-spring)]" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
        </div>
      </header>
      <main className={cn("mx-auto w-full max-w-[640px] flex-1 px-4 pb-16 pt-8 sm:px-0 sm:pt-12")}>{children}</main>
    </div>
  )
}

/** Invalid, expired, revoked and similar states: one calm sentence and nothing to click. */
export function StateMessage({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <PortalShell>
      <div className="pt-10 sm:pt-16">
        <h1 className="t-title text-ink">{title}</h1>
        {children ? <p className="t-body mt-2 text-ink-2">{children}</p> : null}
      </div>
    </PortalShell>
  )
}
