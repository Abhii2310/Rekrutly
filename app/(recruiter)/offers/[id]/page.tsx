import { notFound } from "next/navigation"
import { PrintButton } from "@/components/results/submission-tools"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { getDb } from "@/lib/db/server"

export const dynamic = "force-dynamic"

/** A clean page of the letter, for printing or saving as a PDF from the browser. */
export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const o = await getDb().from("offers").select("body, status, candidates(full_name)").eq("id", id).maybeSingle()
  if (o.error || !o.data) notFound()
  const offer = o.data as unknown as { body: string; status: string; candidates: { full_name: string } | null }
  return (
    <>
      <PageHeader title="Offer letter" description={`${offer.candidates?.full_name ?? "Candidate"}. ${offer.status === "sent" ? "Sent." : "Draft, not sent."}`} actions={<PrintButton />} />
      <PageBody className="max-w-[720px]">
        <article className="whitespace-pre-wrap rounded-group bg-canvas p-2 text-[16px] leading-7 text-ink print:p-0">{offer.body}</article>
      </PageBody>
    </>
  )
}
