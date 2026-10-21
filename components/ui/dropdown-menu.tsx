"use client"

import * as React from "react"
import { cn } from "cn"
import { DropdownMenu as MenuPrimitive } from "radix-ui"
import { CheckIcon } from "lucide-react"

const DropdownMenu = MenuPrimitive.Root
const DropdownMenuTrigger = MenuPrimitive.Trigger
const DropdownMenuGroup = MenuPrimitive.Group
const DropdownMenuPortal = MenuPrimitive.Portal
const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup

function DropdownMenuContent({ className, sideOffset = 6, align = "start", ...props }: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 min-w-[200px] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-group bg-canvas p-1.5 text-ink shadow-[0_8px_30px_rgb(0_0_0/0.12)] ring-1 ring-hairline/60 outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
          className
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  )
}

const itemClass =
  "t-body relative flex cursor-default select-none items-center gap-2 rounded-[8px] px-3 py-2 outline-none data-highlighted:bg-mist data-disabled:pointer-events-none data-disabled:opacity-50"

function DropdownMenuItem({ className, variant = "default", ...props }: React.ComponentProps<typeof MenuPrimitive.Item> & { variant?: "default" | "destructive" }) {
  return <MenuPrimitive.Item data-slot="dropdown-menu-item" className={cn(itemClass, variant === "destructive" && "text-danger", className)} {...props} />
}

function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem data-slot="dropdown-menu-radio-item" className={cn(itemClass, "pr-8", className)} {...props}>
      {children}
      <span className="absolute right-3 flex size-4 items-center justify-center">
        <MenuPrimitive.ItemIndicator><CheckIcon aria-hidden className="size-4 text-action" strokeWidth={2} /></MenuPrimitive.ItemIndicator>
      </span>
    </MenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label data-slot="dropdown-menu-label" className={cn("t-callout px-3 py-1.5 text-ink-2", className)} {...props} />
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator data-slot="dropdown-menu-separator" className={cn("-mx-1.5 my-1.5 h-px bg-hairline/60", className)} {...props} />
}

export {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
}
