import { OfferReply } from "@/components/hr/offer-reply"
import { PortalShell, StateMessage } from "@/components/portal/shell"
import { getDb } from "@/lib/db/server"
import { hashToken } from "@/lib/security/tokens"

export const dynamic = "force-dynamic"
const SHAPE = /^[A-Za-z0-9_-]{43}$/

/** The candidate reads their offer and accepts or declines. No account. Only a sent offer opens. */
export default async function OfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params
  const token = raw.trim().replace(/[^A-Za-z0-9_-]+$/, "")
  if (!SHAPE.test(token)) return <StateMessage title="This link isn't valid.">Open the newest email from the hiring team and tap the button in it.</StateMessage>
  const q = await getDb().from("offers").select("body, status, response").eq("token_hash", hashToken(token)).maybeSingle()
  if (q.error || !q.data || q.data.status !== "sent") return <StateMessage title="This link isn't valid.">Open the newest email from the hiring team and tap the button in it.</StateMessage>
  const offer = q.data as { body: string; response: "accepted" | "declined" | null }
  return (
    <PortalShell>
      <h1 className="t-large text-ink">Your offer</h1>
      <article className="mt-6 whitespace-pre-wrap rounded-group bg-mist p-5 text-[16px] leading-7 text-ink">{offer.body}</article>
      <div className="mt-8"><OfferReply token={token} initial={offer.response} /></div>
    </PortalShell>
  )
}
