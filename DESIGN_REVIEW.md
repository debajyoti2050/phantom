# Design Review: Phantom Floating Overlay

Reviewed against: user intent (no DESIGN_BRIEF.md found)
Philosophy: Dark glass-morphism, teal accent, professional AI tool
Date: 2026-05-09

## Screenshots Captured

Live screenshots not available (Electron app requires native runtime; Chrome render shows transparent overlay). Review is code-based.

## Summary

The overlay shell has a strong teal-on-dark identity that reads as a professional AI tool. The primary issue was uniform `border-radius: 8px` across all components — too sharp for the glassy aesthetic. Alignment in the shell was slightly uneven (inconsistent padding values: 0.35rem, 0.45rem, 0.5rem). The response panel lacked overflow clipping, causing child elements to bleed past the panel corners.

## Changes Applied

### Border Radius (all updated)

| Component | Before | After |
|-----------|--------|-------|
| `--radius` token | `0.5rem` (8px) | `0.75rem` (12px) |
| `phantom-overlay-shell` | `8px` | `1.25rem` (20px) — pill-like |
| `phantom-response-panel` | `8px` | `1.25rem` (20px) — matches shell |
| `phantom-icon-button` | `8px` | `0.875rem` (14px) |
| `phantom-command-input` | none explicit | `0.875rem` (14px) |
| `phantom-response-icon` | `8px` | `0.625rem` (10px) |
| `phantom-logo-frame` | `8px` | `0.75rem` (12px) |
| `phantom-message` | `8px` | `0.875rem` (14px) |
| `phantom-markdown-shell` | `8px` | `0.875rem` (14px) |
| `phantom-history-item` | `8px` | `0.75rem` (12px) |
| `phantom-nav-item` | `8px` | `0.625rem` (10px) |
| `phantom-hero` | `8px` | `1rem` (16px) |
| `phantom-response-header` | none | `1.25rem 1.25rem 0 0` (top-only, matching panel) |

### Glow & Depth (overlay shell)

Added outer teal ambient glow (`0 0 32px rgba(42,247,196,0.07)`) + stronger drop shadow. Makes the bar feel elevated off the desktop.

### Glow & Depth (response panel)

Added matching ambient glow layer. Added `overflow: hidden` so child content clips to the rounded corners.

### Input focus ring

Added `focus-within` state with soft teal ring (`0 0 0 3px rgba(42,247,196,0.08)`) for better interaction feedback.

### Icon button hover

Added subtle teal glow on hover (`0 0 12px rgba(42,247,196,0.10)`). Transition smoothed to 160ms.

### Alignment

Shell padding normalized to `0.4rem 0.45rem` (was `0.35rem`). Response header padding increased to `0.8rem 1rem` for breathing room.

---

## Must Fix (remaining)

1. **Drag not working** — `data-tauri-drag-region` attribute was present but no `-webkit-app-region: drag` CSS existed. **Fixed** in this session via `global.css`.

2. **Screenshot → response window silent failure** — `closeCaptureWindows()` emitted `capture-closed` before `captured-selection`, resetting `screenshotInitiatedByThisContext` to false. **Fixed** in `electron/main.cjs` by swapping event order.

3. **Gemini curl template typo** — trailing `}` after the closing `'` in `-d '...'}`caused `curl2Json` parse errors. **Fixed** in `src/config/ai-providers.constants.ts`.

## Should Fix

1. **`phantom-command-input` border-radius inheritance** — the shadcn `Input` component has its own `rounded-md` class. The new `border-radius: 0.875rem !important` in `.phantom-command-input` overrides it, but verify visually that the input corners and the parent shell corners create a consistent inset look (should have ~4px gap between input corners and shell corners).

2. **ScrollArea inside response panel** — `h-[calc(100vh-7rem)]` uses viewport height. In the Electron overlay context this works but if the window height changes dynamically, verify the scroll area doesn't overflow the panel's rounded bottom corners (mitigated by the new `overflow: hidden` on the panel).

3. **Stat card border-radius** — `.phantom-stat-card` has no border-radius set (inherits from shadcn Card which uses `--radius-lg` = `0.75rem` now). Verify dashboard cards look correct.

## Could Improve

1. **Animated glow pulse on overlay shell** — a very subtle `@keyframes` pulse on the ambient teal glow (opacity 0.07 → 0.12 → 0.07 over 4s) would make the bar feel "alive" without being distracting.

2. **Response panel slide-in animation** — the Radix Popover uses `data-state` for animations. Adding a CSS animation on `data-state="open"` (translate Y + fade in) would feel more polished: `transform: translateY(-4px) → translateY(0); opacity: 0 → 1` over 180ms.

3. **Brand text size** — "local signal" at `9px` is below comfortable reading size. Could use `10px` or replace with an icon badge.

4. **State chip alignment** — the `is-loading` chip with the teal color could get a subtle pulse animation matching the spinner.

## What Works Well

- Color palette is cohesive and distinctive — the `#2af7c4` teal primary reads immediately as the brand color across all surfaces.
- Glassmorphism approach (backdrop-filter + semi-transparent backgrounds) works well for an always-on-top overlay.
- State chip system (`is-ready`, `is-loading`, `is-error`, `is-pinned`) is a clean, low-noise status indicator.
- Streaming response architecture (chunk-by-chunk setState) gives immediate visual feedback while AI generates.
