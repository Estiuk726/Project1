# FlightMates design system v0.1

Reference: the FlightMates Core Flow canvas (7 screens). PRD Section 7.1 and 24.

Inspiration: founder-provided references combining (1) a navy flight-booking app with ticket-style result cards, (2) a dusk-sky travel app with frosted-glass panels and a floating control bar, and (3) a light travel app with rounded photo cards, pill filters and a greeting header. We borrow patterns, not their assets.

## Tokens

### Color

| Token                       | Value                    | Use                                                              |
| --------------------------- | ------------------------ | ---------------------------------------------------------------- |
| `navy-900`                  | `#161B4B`                | Headers, primary text, secondary buttons                         |
| `navy-700`                  | `#2A3170`                | Chips on navy, avatar fallback                                   |
| `navy-500`                  | `#3A428A`                | Borders on navy                                                  |
| `indigo-600`                | `#3441B5`                | Primary buttons, active tab, selected chips, own message bubbles |
| `indigo-800`                | `#232E8C`                | Link hover, text on indigo tint                                  |
| `indigo-300`                | `#A9AFEA`                | Dotted route lines, dashed photo slot                            |
| `indigo-100`                | `#E3E4FA`                | Info banners                                                     |
| `indigo-50`                 | `#E8E9FB`                | Small tags                                                       |
| `lavender-bg`               | `#EEEDFA`                | App background                                                   |
| `field-bg`                  | `#F4F4FA`                | Input fields                                                     |
| `chip-bg`                   | `#F0F0F8`                | Secondary pill buttons                                           |
| `white`                     | `#FFFFFF`                | Cards                                                            |
| `text-muted`                | `#5B6080`                | Captions, labels (≥ 4.5:1 on white and lavender)                 |
| `on-navy-muted`             | `#C3C7F0`                | Captions on navy                                                 |
| `divider`                   | `#E3E4F2`                | Dashed ticket dividers                                           |
| `success-bg` / `success-fg` | `#E3F5E8` / `#1E6B37`    | Match tags ("On QR 79")                                          |
| `accent-orange`             | `#F26A3D`                | Unread dots and notification badges only                         |
| `peach-glow`                | `rgba(246,176,148,0.55)` | Radial glow in sky gradients                                     |

### Gradients

- **Sky (dark):** `radial-gradient(circle at 62% 30%, rgba(246,176,148,.6), transparent 40%), linear-gradient(180deg, #5A6E9C, #4A5C8C 40%, #34426F 70%, #232E52)`. White text allowed.
- **Sky (light):** `radial-gradient(circle at 70% 38%, rgba(246,184,160,.55), transparent 42%), linear-gradient(180deg, #D3D5F7, #A9AFEA 38%, #6A74C9 70%, #2E3A8E)`. Navy text in the top half only.
- **Avatar fallbacks:** peach `#F6B8A0 → #B8664F`, indigo `#A9AFEA → #3441B5`, green `#9ED3B8 → #2F7A57`, white initial.

### Glass

- On sky: `background: rgba(255,255,255,.14–.18); backdrop-filter: blur(14–22px); border: 1px solid rgba(255,255,255,.25)`.
- On light: `background: rgba(255,255,255,.72–.9); backdrop-filter: blur(20–24px)`.

### Type

- Family: **Plus Jakarta Sans** (400, 500, 600, 700, 800).
- Display 40/1.08 800, −0.8 px tracking (welcome). H1 30/1.12 800. Airport code 26–34 800. Title 16–17 800. Body 15/1.5 400–600. Caption 12–13 500–700.

### Shape and spacing

- Radii: fields 16–18, cards 24–30, sheets 32, pills = height / 2, circles for icon buttons.
- Spacing scale: 4, 8, 10, 12, 14, 16, 18, 20, 24.
- Screen gutter 16–20 px. Phone frame 390 × 844.
- Shadows: cards on lavender `0 10px 28px rgba(22,27,75,.08)`; floating bars `0 12px 32px rgba(22,27,75,.18)`.

## Components

| Component        | Spec                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| Primary button   | 56 px pill, `indigo-600`, white 16/700                                                                         |
| Secondary button | 44–52 px pill, `navy-900`, white 14–15/700                                                                     |
| Tertiary button  | 44–48 px pill, `chip-bg`, navy 14/700                                                                          |
| Icon button      | 44 px circle, white on light, glass on sky, `aria-label` required                                              |
| Field            | `field-bg`, radius 16–18, caption label on top, value 16–18/700–800                                            |
| Filter pill      | 40 px, selected `indigo-600`/white, unselected white/navy (or `navy-700` on navy)                              |
| Ticket card      | White, radius 24, dashed `divider` line with 20 px notches in the background color at both ends                |
| Flight route     | `DAC ····✈···· BER`, codes 26–34/800, city captions, hub as small tag                                          |
| Traveller card   | Ticket card: avatar 48, name 16/800, "Country · Purpose", success tag right; lower half reason line + "Say hi" |
| Tab bar          | Floating pill 68 px high, 24 px from edges and bottom, 3 items: Trips, Chats, Me                               |
| Composer         | Floating pill with field and 52 px send circle                                                                 |
| Glass action bar | On sky screens: circle, white pill primary, circle                                                             |
| Info banner      | `indigo-100` with icon, 13/1.45 `indigo-800` text                                                              |

## Rules

- One primary action per screen.
- Orange is never used for text or buttons.
- Text contrast: WCAG AA (4.5:1 body, 3:1 at 24 px+). Do not use lighter greys than `text-muted`.
- Touch targets ≥ 44 px. Use real `<button>`, `<a>`, `<input>` and `<label>`.
- Icons: inline stroke SVG (24 grid, 2 px stroke) until an icon library is chosen. No emoji in UI.
- Never show hidden profile fields (PRD 9.2) in any design, including placeholders.
- Destination photos are P1; until then use the sky gradients and initials.
