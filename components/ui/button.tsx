import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "focus-ring relative inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full font-medium transition-colors duration-[160ms] select-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-action px-4 text-white hover:bg-action-hover",
        secondary: "bg-fog px-4 text-ink hover:bg-hairline",
        plain: "px-1 text-action hover:text-action-hover",
        destructive: "px-1 text-danger hover:opacity-80",
      },
      size: {
        md: "h-9 text-[15px] leading-[22px]",
        sm: "h-7 text-[13px] leading-[18px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Shows a spinner and disables the button without changing its width. */
    loading?: boolean
  }

function Button({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {children}
      </Slot.Root>
    )
  }
  return (
    <button
      data-slot="button"
      type="button"
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      <span className={cn("inline-flex items-center justify-center", loading && "invisible")}>{children}</span>
      {loading && (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 20 20" className="rail-spin size-4">
            <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
            <path d="M10 3a7 7 0 0 1 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      )}
    </button>
  )
}

export { Button, buttonVariants }
