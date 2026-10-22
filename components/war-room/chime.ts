/** A soft two-note chime. Needs the page to have been clicked once, which opening the War Room almost always means. */
export function chime(ctx: AudioContext) {
  void ctx.resume().catch(() => {})
  const now = ctx.currentTime
  ;[660, 880].forEach((freq, n) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, now + n * 0.16)
    gain.gain.exponentialRampToValueAtTime(0.18, now + n * 0.16 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + n * 0.16 + 0.35)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now + n * 0.16)
    osc.stop(now + n * 0.16 + 0.4)
  })
}

