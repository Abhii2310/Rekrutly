export type Mood = "worry" | "talk" | "smile" | "focus" | "wow"

/**
 * Ravi, the HR guy. Drawn in plain SVG so he stays sharp at any size and costs no download. `t` is the film clock in
 * seconds: it drives the blink, the mouth while he talks, the sweat drop and the wave, so pause and scrub work.
 */
export function Ravi({ mood, t, wave = false }: { mood: Mood; t: number; wave?: boolean }) {
  const blink = t % 3.2 > 3.05
  const talking = mood === "talk" && Math.floor(t * 9) % 2 === 0
  const bob = Math.sin(t * 2) * 1.5
  const armA = wave ? Math.sin(t * 9) * 18 - 40 : 8
  const brow = mood === "worry" ? -6 : 0
  const lift = mood === "wow" ? 8 : 0
  return (
    <svg viewBox="0 0 250 280" role="img" aria-label="Ravi, an HR manager" className="h-full w-auto">
      <g transform={`translate(0 ${bob})`}>
        {/* body */}
        <path d="M30 280 C30 214 66 190 110 190 C154 190 190 214 190 280 Z" fill="#2B5FD9" />
        <path d="M92 190 L110 226 L128 190 Z" fill="#F4F6FB" />
        <path d="M104 204 L110 214 L116 204 L113 232 L107 232 Z" fill="#1D1D1F" />
        {/* arm that waves */}
        <g transform={`rotate(${armA} 176 214)`}>
          <rect x="168" y="212" width="20" height="58" rx="10" fill="#2B5FD9" transform="rotate(-8 178 212)" />
          <circle cx="172" cy="268" r="11" fill="#E0A982" />
        </g>
        {/* neck and head */}
        <rect x="98" y="168" width="24" height="26" rx="8" fill="#D39A72" />
        <ellipse cx="110" cy="130" rx="46" ry="52" fill="#E0A982" />
        <ellipse cx="64" cy="134" rx="6" ry="10" fill="#D39A72" />
        <ellipse cx="156" cy="134" rx="6" ry="10" fill="#D39A72" />
        {/* hair */}
        <path d="M62 120 C58 78 84 64 112 64 C142 64 162 80 158 120 C150 100 134 92 112 92 C90 92 72 100 62 120 Z" fill="#1D1D1F" />
        {/* eyebrows */}
        <path d={`M82 ${110 - brow / 2 - lift} L100 ${108 + brow / 2 - lift}`} stroke="#1D1D1F" strokeWidth="4" strokeLinecap="round" />
        <path d={`M120 ${108 + brow / 2 - lift} L138 ${110 - brow / 2 - lift}`} stroke="#1D1D1F" strokeWidth="4" strokeLinecap="round" />
        {/* eyes */}
        {blink ? (<><path d="M86 124 H100" stroke="#1D1D1F" strokeWidth="3" strokeLinecap="round" /><path d="M120 124 H134" stroke="#1D1D1F" strokeWidth="3" strokeLinecap="round" /></>) : (
          <>
            <circle cx="93" cy="124" r={mood === "wow" ? 6 : 4.5} fill="#1D1D1F" />
            <circle cx="127" cy="124" r={mood === "wow" ? 6 : 4.5} fill="#1D1D1F" />
            <circle cx="94.5" cy="122.5" r="1.4" fill="#fff" /><circle cx="128.5" cy="122.5" r="1.4" fill="#fff" />
          </>
        )}
        {/* glasses */}
        <rect x="76" y="111" width="34" height="26" rx="10" fill="none" stroke="#1D1D1F" strokeWidth="3" />
        <rect x="110" y="111" width="34" height="26" rx="10" fill="none" stroke="#1D1D1F" strokeWidth="3" />
        <path d="M110 122 H110" stroke="#1D1D1F" strokeWidth="3" />
        {/* mouth */}
        {mood === "worry" ? <path d="M96 158 Q110 148 124 158" stroke="#7A3B2E" strokeWidth="4" fill="none" strokeLinecap="round" />
          : mood === "wow" ? <ellipse cx="110" cy="156" rx="7" ry="9" fill="#7A3B2E" />
          : talking ? <ellipse cx="110" cy="155" rx="10" ry="7" fill="#7A3B2E" />
          : mood === "focus" ? <path d="M98 156 H122" stroke="#7A3B2E" strokeWidth="4" strokeLinecap="round" />
          : <path d="M94 152 Q110 170 126 152" stroke="#7A3B2E" strokeWidth="4" fill="none" strokeLinecap="round" />}
        {/* sweat */}
        {mood === "worry" ? <path d="M160 98 C154 108 154 114 160 114 C166 114 166 108 160 98 Z" fill="#7CC4FF" opacity={0.6 + Math.sin(t * 6) * 0.3} /> : null}
      </g>
    </svg>
  )
}
