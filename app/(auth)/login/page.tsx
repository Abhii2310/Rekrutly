import { LoginForm } from "./login-form"

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/"
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-[360px]">
        <h1 className="t-large text-ink">Rekrutly</h1>
        <p className="t-callout mt-1 text-ink-2">Enter the team passcode.</p>
        <LoginForm next={safeNext} />
      </div>
    </main>
  )
}
