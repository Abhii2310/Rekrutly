const ROW_A = ["Hi Kabir", "नमस्ते Kabir", "ನಮಸ್ಕಾರ Kabir"]
const ROW_B = ["Your test is ready", "आपका टेस्ट तैयार है", "ನಿಮ್ಮ ಪರೀಕ್ಷೆ ಸಿದ್ಧವಾಗಿದೆ"]

function Row({ items, className, size }: { items: string[]; className: string; size: string }) {
  // The list is doubled so the loop never shows a gap; the second copy is hidden from assistive tech.
  return (
    <div className="overflow-hidden whitespace-nowrap py-2 [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
      <div className={`flex w-max ${className}`}>
        {[0, 1].map((copy) => (
          <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center">
            {items.map((t) => (
              <span key={`${copy}-${t}`} className={`${size} shrink-0 px-8 font-semibold tracking-[-0.04em]`}>
                {t}<span aria-hidden className="ml-16 text-fog">/</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Greetings in three scripts, scrolling past. No text to read, just the feeling of it. */
export function Marquee() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Row items={ROW_A} className="marquee-left text-ink" size="text-[64px] md:text-[128px] leading-[1.15]" />
      <Row items={ROW_B} className="marquee-right text-ink-3" size="text-[36px] md:text-[64px] leading-[1.35]" />
    </div>
  )
}
