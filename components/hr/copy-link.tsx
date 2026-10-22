"use client"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"

export function CopyLinkButton({ url }: { url: string }) {
  return (
    <Button variant="secondary" size="sm" onClick={() => { void navigator.clipboard.writeText(url).then(() => toast("Link copied"), () => toast("Couldn't copy. Select it by hand.")) }}>Copy join link</Button>
  )
}
