import { statusLabel, type Stage } from "@/lib/status"
import { BarList } from "./bar-list"

/** The pipeline stages in order, as a BarList. Stages nobody is in are left out. */
export function Funnel({ stages }: { stages: { stage: Stage; count: number }[] }) {
  const items = stages.filter((s) => s.count > 0).map((s) => ({ label: statusLabel("candidate", s.stage), value: s.count }))
  return <BarList ariaLabel="Candidates by stage" items={items} />
}
