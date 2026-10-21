import 'server-only';
import { notFound } from "next/navigation"
import { DemoDirector } from "@/components/demo/demo-director"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { env } from "@/lib/env"

export const dynamic = "force-dynamic"

/** Demo Director. Exists only in DEMO_MODE; anywhere else it is a 404. */
export default function DemoPage() {
  if (!env.DEMO_MODE) notFound()
  return (
    <>
      <PageHeader title="Demo Director" description="Get the demo ready and run it. Everything here is for demo data only." />
      <PageBody><DemoDirector /></PageBody>
    </>
  )
}
