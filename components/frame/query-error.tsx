"use client"

import { useRouter } from "next/navigation"
import { ErrorState } from "@/components/ui/error-state"

/** For server pages whose query failed: Retry refreshes the route. */
export function QueryError({ message, hint }: { message: string; hint?: string }) {
  const router = useRouter()
  return <ErrorState message={message} hint={hint ?? "Check your connection, then retry."} onRetry={() => router.refresh()} />
}
