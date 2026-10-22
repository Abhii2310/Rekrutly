/**
 * Listens to the microphone level on the device. Only a loudness number is read, several times a second; nothing is
 * transcribed and nothing is sent anywhere for analysis. Returns a stop function, or null if there is no audio track.
 */
export function startVoiceMeter(stream: MediaStream, onLevel: (level: number, nowMs: number) => void): (() => void) | null {
  if (stream.getAudioTracks().length === 0) return null
  try {
    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)
    const buf = new Float32Array(analyser.fftSize)
    void ctx.resume().catch(() => {})
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf)
      let sum = 0
      for (const v of buf) sum += v * v
      onLevel(Math.sqrt(sum / buf.length), Date.now())
    }, 200)
    return () => { clearInterval(timer); void ctx.close().catch(() => {}) }
  } catch {
    return null
  }
}
