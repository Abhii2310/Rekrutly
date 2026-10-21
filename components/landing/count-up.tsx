"use client"

import * as React from "react"
import { animate, useInView, useReducedMotion } from "motion/react"

/** A number that counts up once when it scrolls into view. Shows the final number straight away with reduced motion. */
export function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  const reduce = useReducedMotion()
  const [value, setValue] = React.useState(reduce ? to : 0)
  React.useEffect(() => {
    if (!inView || reduce) return
    const controls = animate(0, to, { duration: 1.4, ease: [0.32, 0.72, 0, 1], onUpdate: (v) => setValue(Math.round(v)) })
    return () => controls.stop()
  }, [inView, reduce, to])
  return <span ref={ref} className="tabular">{reduce ? to : value}{suffix}</span>
}
