"use client"

import * as React from "react"
import { toast } from "@/components/ui/toaster"
import { copyText } from "@/lib/copy-text"
import { shareMessage } from "@/lib/invitations/template"
import { whatsappUrl } from "@/lib/tasks/whatsapp"
import type { LiveInvitation } from "@/lib/db/queries/live"

/**
 * The sure way to reach someone when an email lands in Spam: send their personal link by WhatsApp (opens with the message
 * filled in; you press send), or copy the message to paste anywhere. Nothing is sent from here.
 */
export function ShareLinkButton({ invitation, title, durationMinutes, sender }: { invitation: LiveInvitation; title: string; durationMinutes: number; sender?: string | null }) {
  const [busy, setBusy] = React.useState(false)
  const hasPhone = whatsappUrl(invitation.phone, "x") !== null

  async function share() {
    if (busy) return
    setBusy(true)
    let url: string | null = null
    try {
      const res = await fetch(`/api/invitations/${invitation.id}/link`, { cache: "no-store" })
      if (res.ok) url = ((await res.json()) as { data: { url: string } }).data.url
    } catch { /* handled below */ }
    setBusy(false)
    if (!url) return toast("Couldn't get their link. Try again.")
    const text = shareMessage({ firstName: invitation.name.split(/\s+/)[0] ?? invitation.name, title, durationMinutes, url, sender })
    const wa = whatsappUrl(invitation.phone, text)
    if (wa) { window.open(wa, "_blank", "noopener"); return }
    toast((await copyText(text)) ? "Message copied. Paste it in WhatsApp or any chat." : "Couldn't copy. Use Copy link instead.")
  }

  return (
    <button type="button" onClick={() => void share()} disabled={busy} className="focus-ring t-footnote rounded text-action hover:text-action-hover disabled:opacity-50">
      {busy ? "Preparing…" : hasPhone ? "Send on WhatsApp" : "Copy message for WhatsApp"}
    </button>
  )
}
