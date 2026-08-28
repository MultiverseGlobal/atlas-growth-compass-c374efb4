# Atlas Brand Theme — Portable Design System

> **Drop this file into any new project.**
> Everything below is copy-paste-ready. An AI or developer reading this file
> should be able to recreate the full visual identity from scratch with zero
> additional context.

---

## QUICK-START CHECKLIST

When starting a new project with this theme:

- [x] Copy `tailwind.config.ts` block → your Tailwind config / CSS
- [x] Copy `index.css` block → your global stylesheet
- [x] Install fonts (Fraunces + Inter + IBM Plex Mono)
- [x] Copy `Logo.tsx` (swap name string)
- [x] Copy `AppShell.tsx` pattern (swap nav links)
- [x] Done — the theme is live

---

## §1 — BRAND IDENTITY

```
Name:        Atlas / Metaphor
Tagline:     "Map the unknown. Move with conviction."
Metaphor:    The explorer's cartographic map — precise, warm, purposeful
Personality: Precise · Warm · Intelligent · Grounded
Voice:       Direct. Outcome-focused. Never generic SaaS-speak.
             Use: map, trace, source, move, close, commit
             Avoid: "unlock", "empower", "synergy", "seamless"
```

**Logo mark** — hollow ink circle + primary fill dot + dotted line dropping below.
This is the waypoint pin. It must always use `--foreground` for the ring and
`--primary` for the fill and trail line.

---

## §2 — FONTS

| Family | Role | CSS |
|---|---|---|
| **Fraunces** (serif) | Display, headings, map titles | `font-family: 'Fraunces', Georgia, serif` |
| **Inter** (sans) | Body, UI labels, everything else | `font-family: 'Inter', system-ui, sans-serif` |
| **IBM Plex Mono** | Code, eyebrow labels, data values | `font-family: 'IBM Plex Mono', monospace` |

---

## §3 — COLOR PALETTE (Timbal.ai Variant)

- **Primary Background**: Deep timbal navy (`#080F1C` / `222 47% 7%`)
- **Primary Text**: Near white (`#E8EFF9` / `214 40% 93%`)
- **Card Surface**: Frosted navy glass (`#0F1A2D` / `222 42% 11%`)
- **Primary Accent**: Timbal Royal Blue (`#3B82F6` / `217 91% 60%`)
- **Secondary Accent**: Timbal Cyan (`#1998E8` / `199 89% 52%`)
