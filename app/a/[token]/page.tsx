import { PortalApp } from "@/components/portal/portal-app"

export default async function CandidatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <PortalApp token={token} />
}
