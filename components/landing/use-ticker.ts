"use client"

import * as React from "react"
import { useReducedMotion } from "motion/react"

/**
 * A repeating counter for the product demos. It only runs while `active` is true (the demo is on screen) and stops at
 * `restAt` for people who prefer reduced motion, so they see the finished state instead of movement.
 */
export function useTicker(length: number, restAt: number, active: boolean, ms = 100): number {
  const reduce = useReducedMotion()
  const [tick, setTick] = React.useState(0)
  React.useEffect(() => {
    if (reduce || !active) return
    const id = setInterval(() => setTick((t) => (t + 1) % length), ms)
    return () => clearInterval(id)
  }, [reduce, active, length, ms])
  return reduce ? restAt : tick
}
