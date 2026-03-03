# FadeOut Fullscreen Dimming — Implementation Plan

## Goal

Add a new Setting called Mode which has two Options: "Window" and "Fullscreen". The default is "Window", which is how FadeOut works by default. Setting this to "Fullscreen" causes the app to fade out the entire screen (desktop wallpaper, top panel, other windows) except the active, focused window.

## Current Behavior ("Window" Mode)

The extension applies a `BrightnessEffect` (GLSL shader) to each individual unfocused window actor. This leaves the desktop wallpaper, top panel, and other shell chrome at full brightness.

## What Needs to Change

For the "Fullscreen" mode, to dim "everything on screen" except the focused window, we need to also dim:

1. **Desktop wallpaper** — lives in `Main.layoutManager._backgroundGroup`
2. **Top panel** — lives in `Main.panel`
3. Other windows — already handled

## Recommended Approach: Hybrid (Overlay + Per-Window Effects)

The cleanest refactoring uses two complementary techniques:

| Screen Element | Technique |
|---|---|
| **Desktop background** | Insert a black `Clutter.Actor` overlay into `Main.layoutManager.uiGroup`, positioned below `global.window_group` but above the background group. Animate its `opacity` (0–255) based on the fade factor. Set `reactive: false` so mouse events pass through. |
| **Top panel** | Apply the existing `BrightnessEffect` directly to the `Main.panel` actor, same as windows. |
| **Unfocused windows** | Keep the existing per-window `BrightnessEffect` (no change). |
| **Focused window** | No effect — appears at full brightness (no change). |

## Why This Works Well

- **No actor reparenting** — doesn't move the focused window in the scene graph (which would be fragile)
- **No clones** — avoids `Clutter.Clone` interactivity issues
- **Reuses `BrightnessEffect`** — the panel dimming uses the same GLSL shader and animation logic
- **Overlay z-ordering is simple** — `uiGroup.set_child_below_sibling(overlay, global.window_group)` places it exactly where needed
- **Minimal code changes** — extends `_onFocusChanged`, `_dimWindow`/`_undimWindow` patterns to the new actors
- **Proper cleanup** — overlay and panel effects are removed on disable/overview/toggle

## Key Changes in `extension.js`

1. **`enable()`** — Create the overlay actor and add it to `uiGroup`
2. **`_onFocusChanged()`** — Also dim/undim the overlay and panel when focus changes or enabled state changes
3. **`_onFadeFactorChanged()`** — Update overlay opacity and panel effect alongside window effects
4. **`_onOverviewShowing()`** — Hide overlay and remove panel effect
5. **`_onOverviewHidden()`** — Restore overlay and panel effect
6. **`_removeAllEffects()`** — Also remove overlay and panel effect
7. **`disable()`** — Destroy the overlay actor
