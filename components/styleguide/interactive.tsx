"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toaster"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { ErrorState } from "@/components/ui/error-state"

export function Interactive() {
  const [segment, setSegment] = React.useState("all")
  const [job, setJob] = React.useState("fullstack")
  const [on, setOn] = React.useState(true)
  const [loading, setLoading] = React.useState(false)
  const [text, setText] = React.useState("")
  const [spot, setSpot] = React.useState(false)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSpot((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div className="flex flex-col gap-12">
      <Block title="Buttons">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Approve and create links</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="plain">Copy link</Button>
          <Button variant="destructive">Delete</Button>
          <Button size="sm" variant="secondary">Small</Button>
          <Button disabled>Disabled</Button>
          <Button
            loading={loading}
            onClick={() => {
              setLoading(true)
              setTimeout(() => setLoading(false), 1500)
            }}
          >
            Save changes
          </Button>
        </div>
      </Block>

      <Block title="Fields">
        <div className="flex max-w-[480px] flex-col gap-3">
          <Input aria-label="Example input" placeholder="Search candidates" />
          <Textarea aria-label="Example textarea" placeholder="Type to see this grow" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex items-center gap-3">
            <Switch checked={on} onCheckedChange={setOn} aria-label="Example switch" />
            <span className="t-callout text-ink-2">{on ? "On" : "Off"}</span>
          </div>
        </div>
      </Block>

      <Block title="Segmented control">
        <SegmentedControl
          ariaLabel="Stage group"
          value={segment}
          onChange={setSegment}
          options={[
            { value: "all", label: "All" },
            { value: "new", label: "New" },
            { value: "assessment", label: "In assessment" },
            { value: "review", label: "Review" },
          ]}
        />
      </Block>

      <Block title="Overlays">
        <div className="flex flex-wrap items-center gap-4">
          <Dialog>
            <DialogTrigger asChild><Button variant="secondary">Open dialog</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset demo data?</DialogTitle>
                <DialogDescription>This deletes every demo run, assessment, invitation and submission.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="plain">Cancel</Button>
                <Button>Reset</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild><Button variant="secondary">Open sheet</Button></SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Aarav Mehta</SheetTitle>
                <SheetDescription>Frontend Engineer at Lumen Pay</SheetDescription>
              </SheetHeader>
              <p className="t-body px-8 text-ink-2">The sheet holds the candidate profile and the evidence view.</p>
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="secondary">Open menu</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuRadioGroup value={job} onValueChange={setJob}>
                <DropdownMenuRadioItem value="fullstack">Full-Stack Developer</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="designer">Product Designer</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="go">Backend Engineer (Go)</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuItem variant="destructive">Remove</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild><Button variant="plain">Hover for tooltip</Button></TooltipTrigger>
            <TooltipContent>One short sentence.</TooltipContent>
          </Tooltip>

          <Button variant="secondary" onClick={() => toast("Link copied")}>Show toast</Button>
          <Button variant="secondary" onClick={() => setSpot(true)}>Open spotlight</Button>
          <span className="t-callout inline-flex items-center gap-1 text-ink-2"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
        </div>
        <CommandDialog open={spot} onOpenChange={setSpot}>
          <CommandInput placeholder="Tell Rekrutly what to do" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Go to">
              <CommandItem onSelect={() => setSpot(false)}>Jobs<CommandShortcut>Jobs</CommandShortcut></CommandItem>
              <CommandItem onSelect={() => setSpot(false)}>Candidates<CommandShortcut>Candidates</CommandShortcut></CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </Block>

      <Block title="Error state with retry">
        <div className="rounded-group bg-mist">
          <ErrorState
            message="Couldn't generate questions because the AI took too long."
            hint="Retry, or use the saved demo set."
            onRetry={() => toast("Retrying")}
          />
        </div>
      </Block>
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="t-title mb-4 text-ink">{title}</h2>
      {children}
    </section>
  )
}
