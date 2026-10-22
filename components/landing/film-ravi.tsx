export type Mood = "worry" | "talk" | "smile" | "focus" | "wow"

/**
 * Ravi, the HR guy. Plain SVG, so he stays sharp at any size and costs no download. `t` is the film clock in seconds and
 * drives everything that moves: blink, nod, mouth while talking, typing hands, steam, sweat, sparkles and the wave.
 * He sits at a desk with a laptop and a mug.
 */
export function Ravi({ mood, t, wave = false, sparkle = false }: { mood: Mood; t: number; wave?: boolean; sparkle?: boolean }) {
  const blink = t % 3.2 > 3.05
  const talking = mood === "talk" && Math.floor(t * 9) % 2 === 0
  const bob = Math.sin(t * 2) * 1.2
  const tilt = mood === "worry" ? Math.sin(t * 7) * 2.6 : mood === "wow" ? -4 : Math.sin(t * 1.5) * (mood === "talk" ? 2.2 : 1.2)
  const type = mood === "talk" || mood === "focus"
  const armA = wave ? Math.sin(t * 9) * 16 - 70 : 0
  const brow = mood === "worry" ? -6 : 0
  const lift = mood === "wow" ? 8 : 0
  const happy = mood === "smile" || mood === "talk"
  return (
    <svg viewBox="0 0 250 290" role="img" aria-label="Ravi, an HR manager at his desk" className="h-full w-auto overflow-visible">
      <defs>
        <linearGradient id="rv-shirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4A7BF0" /><stop offset="1" stopColor="#2349AE" /></linearGradient>
        <linearGradient id="rv-skin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F0BE95" /><stop offset="1" stopColor="#D69A71" /></linearGradient>
        <linearGradient id="rv-desk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3A3A46" /><stop offset="1" stopColor="#1B1B22" /></linearGradient>
        <radialGradient id="rv-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#7DB5FF" stopOpacity="0.55" /><stop offset="1" stopColor="#7DB5FF" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="112" cy="232" rx="120" ry="40" fill="url(#rv-glow)" />
      <g transform={`translate(0 ${bob})`}>
        <path d="M24 290 C24 214 62 188 112 188 C162 188 200 214 200 290 Z" fill="url(#rv-shirt)" />
        <path d="M94 188 L112 226 L130 188 Z" fill="#F4F6FB" />
        <path d="M106 204 L112 214 L118 204 L115 236 L109 236 Z" fill="#14141A" />
        <path d="M24 290 C24 230 50 200 80 192 L72 290 Z" fill="#000" opacity="0.12" />
        {/* waving arm, raised on the last chapter */}
        {wave ? (
          <g transform={`rotate(${armA} 186 214)`}>
            <rect x="176" y="150" width="20" height="70" rx="10" fill="url(#rv-shirt)" />
            <circle cx="186" cy="146" r="12" fill="url(#rv-skin)" />
          </g>
        ) : null}
        {/* head */}
        <g transform={`rotate(${tilt} 112 175)`}>
          <rect x="100" y="166" width="24" height="28" rx="8" fill="#CF936B" />
          <ellipse cx="112" cy="128" rx="47" ry="53" fill="url(#rv-skin)" />
          <ellipse cx="65" cy="132" rx="6" ry="10" fill="#D69A71" /><ellipse cx="159" cy="132" rx="6" ry="10" fill="#D69A71" />
          <path d="M63 118 C58 74 86 60 114 60 C146 60 166 78 161 118 C152 98 136 90 114 90 C92 90 74 98 63 118 Z" fill="#1A1A20" />
          <path d="M82 76 C96 66 118 64 136 70" stroke="#4A4A58" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />
          <path d={`M84 ${110 - brow / 2 - lift} L102 ${108 + brow / 2 - lift}`} stroke="#1A1A20" strokeWidth="4.5" strokeLinecap="round" />
          <path d={`M122 ${108 + brow / 2 - lift} L140 ${110 - brow / 2 - lift}`} stroke="#1A1A20" strokeWidth="4.5" strokeLinecap="round" />
          {happy || mood === "wow" ? <><circle cx="82" cy="146" r="7" fill="#F27D7D" opacity="0.28" /><circle cx="142" cy="146" r="7" fill="#F27D7D" opacity="0.28" /></> : null}
          {blink ? (<><path d="M88 124 H102" stroke="#1A1A20" strokeWidth="3" strokeLinecap="round" /><path d="M122 124 H136" stroke="#1A1A20" strokeWidth="3" strokeLinecap="round" /></>) : (
            <>
              <circle cx="95" cy="124" r={mood === "wow" ? 6.5 : 5} fill="#1A1A20" /><circle cx="129" cy="124" r={mood === "wow" ? 6.5 : 5} fill="#1A1A20" />
              <circle cx="96.7" cy="122.3" r="1.6" fill="#fff" /><circle cx="130.7" cy="122.3" r="1.6" fill="#fff" />
            </>
          )}
          <rect x="78" y="111" width="34" height="26" rx="10" fill="#7DB5FF" fillOpacity="0.1" stroke="#14141A" strokeWidth="3" />
          <rect x="112" y="111" width="34" height="26" rx="10" fill="#7DB5FF" fillOpacity="0.1" stroke="#14141A" strokeWidth="3" />
          <path d="M112 121 H112" stroke="#14141A" strokeWidth="3" />
          {mood === "worry" ? <path d="M98 160 Q112 150 126 160" stroke="#7A3B2E" strokeWidth="4" fill="none" strokeLinecap="round" />
            : mood === "wow" ? <ellipse cx="112" cy="158" rx="7" ry="9" fill="#7A3B2E" />
            : talking ? <ellipse cx="112" cy="157" rx="10" ry="7" fill="#7A3B2E" />
            : mood === "focus" ? <path d="M100 158 H124" stroke="#7A3B2E" strokeWidth="4" strokeLinecap="round" />
            : <path d="M96 154 Q112 172 128 154" stroke="#7A3B2E" strokeWidth="4" fill="none" strokeLinecap="round" />}
          {mood === "worry" ? <path d="M164 96 C157 107 157 114 164 114 C171 114 171 107 164 96 Z" fill="#7CC4FF" opacity={0.6 + Math.sin(t * 6) * 0.3} /> : null}
        </g>
        {sparkle ? [0, 1, 2].map((k) => <path key={k} d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z" fill="#FFD60A" transform={`translate(${40 + k * 85} ${60 + (k % 2) * 24}) scale(${0.8 + 0.5 * Math.abs(Math.sin(t * 3 + k * 2))})`} opacity={0.8} />) : null}
      </g>
      {/* desk, laptop, mug */}
      <rect x="0" y="252" width="250" height="38" rx="6" fill="url(#rv-desk)" />
      <rect x="62" y="206" width="100" height="62" rx="7" fill="#26262E" stroke="#4A4A58" strokeWidth="1.5" />
      <circle cx="112" cy="237" r="7" fill="#7DB5FF" opacity={0.7 + Math.sin(t * 2.4) * 0.25} />
      <rect x="196" y="226" width="22" height="26" rx="4" fill="#F4F6FB" /><path d="M218 232 Q229 238 218 246" stroke="#F4F6FB" strokeWidth="3" fill="none" />
      {[0, 1, 2].map((k) => <path key={k} d={`M${203 + k * 5} ${220 - ((t * 10 + k * 7) % 22)} q3 -4 0 -8`} stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity={0.35 - ((t * 10 + k * 7) % 22) / 80} />)}
      {/* hands */}
      <ellipse cx={88 + (type ? Math.sin(t * 14) * 3 : 0)} cy={type ? 250 : 254} rx="13" ry="8" fill="url(#rv-skin)" />
      <ellipse cx={136 + (type ? Math.sin(t * 14 + 2) * 3 : 0)} cy={type ? 250 : 254} rx="13" ry="8" fill="url(#rv-skin)" />
    </svg>
  )
}
