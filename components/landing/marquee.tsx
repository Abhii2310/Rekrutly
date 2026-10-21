const ROW_A = ["Hi Kabir", "नमस्ते Kabir", "ನಮಸ್ಕಾರ Kabir"]
const ROW_B = ["Your test is ready", "आपका टेस्ट तैयार है", "ನಿಮ್ಮ ಪರೀಕ್ಷೆ ಸಿದ್ಧವಾಗಿದೆ"]

function Row({ items, className, size, outline }: { items: string[]; className: string; size: string; outline?: boolean }) {
  // The list is doubled so the loop never shows a gap; the second copy is hidden from assistive tech.
  return (
    <div className="overflow-hidden whitespace-nowrap py-2 [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
      <div className={`flex w-max ${className}`}>
        {[0, 1].map((copy) => (
          <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center">
            {items.map((t) => (
              <span key={`${copy}-${t}`} className={`${size} ${outline ? "text-outline" : "text-white"} shrink-0 px-8 font-semibold tracking-[-0.04em]`}>
                {t}<span aria-hidden className="ml-16 text-white/15">/</span>
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
    <div className="flex flex-col gap-3 md:gap-5">
      <Row items={ROW_A} className="marquee-left" size="text-[64px] md:text-[128px] leading-[1.15]" />
      <Row items={ROW_B} className="marquee-right" size="text-[36px] md:text-[64px] leading-[1.35]" outline />
    </div>
  )
}
