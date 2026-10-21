# R2 — Design polish pass

Use any time a screen looks generic, crowded or "AI-made". Replace the blank.

**Screen:** ______ (route, e.g. `/runs/<id>` or "the portal question screen")

## Instructions for Claude Code

1. Re-read `docs/DESIGN.md` completely.
2. Screenshot the screen with a browser check (see CLAUDE.md → Browser checks) at 1280px (and 375px if candidate-facing).
3. Critique it like an Apple design reviewer. List at least five specific issues across: hierarchy, spacing rhythm, alignment, number of containers/borders/icons, colour use, copy, states (loading, empty, error), and motion. Name the exact element for each.
4. Apply "remove one accessory": find at least one border, box, icon, label or colour that can go without losing meaning, and remove it.
5. Fix every issue using tokens and existing primitives only. If a primitive is wrong, fix the primitive (it fixes every screen).
6. Screenshot again and show before/after notes in your report. Run the DESIGN.md checklist.
7. `npm run verify`, commit `style(<screen>): polish pass`.
