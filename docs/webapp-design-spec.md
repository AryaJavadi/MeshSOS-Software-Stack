# MeshSOS Responder Dashboard — Design Specification

---

## Fonts

Import both from Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
```

| Role | Family | Weight | Notes |
|---|---|---|---|
| UI text, labels, headings | DM Sans | 400 / 600 / 700 | Primary font for all prose |
| Numeric data, node IDs, RSSI, timestamps | DM Mono | 400 / 500 | Anything technical/countable |

### Type Scale

```css
/* Headings */
--text-display-lg: 700 22px/1.2 'DM Sans';   /* page titles */
--text-display-md: 700 18px/1.3 'DM Sans';   /* section headers */

/* Body */
--text-body-lg:   400 14px/1.57 'DM Sans';
--text-body-md:   400 13px/1.53 'DM Sans';
--text-body-sm:   400 12px/1.5  'DM Sans';

/* Labels — always UPPERCASE */
--text-label-lg:  700 11px 'DM Sans'; letter-spacing: 1.2px;
--text-label-md:  700 10px 'DM Sans'; letter-spacing: 1.0px;
--text-label-sm:  700  9px 'DM Sans'; letter-spacing: 0.8px;

/* Monospace — IDs, signal values, counts */
--text-mono-lg:   700 22px 'DM Mono';
--text-mono-md:   400 13px 'DM Mono';
--text-mono-sm:   400 11px 'DM Mono';
--text-mono-xs:   400 10px 'DM Mono';
```

---

## Colour System

### Dark Theme (default)

```css
/* Backgrounds */
--bg:        #0d1117;   /* page background */
--surface:   #161b22;   /* cards, panels */
--surface-2: #1c2330;   /* nested surfaces, table rows */

/* Borders */
--border:    rgba(255, 255, 255, 0.07);

/* Text */
--text:      #e6edf3;
--text-muted:#7d8590;

/* Accent — purple */
--accent:    #a78bfa;
--accent-dim:rgba(167, 139, 250, 0.15);
--accent-2:  #7c3aed;

/* Status: Online */
--green:        #3fb950;
--green-dim:    rgba(63, 185, 80, 0.15);
--green-border: rgba(63, 185, 80, 0.20);

/* Status: Weak signal */
--yellow:        #d29922;
--yellow-dim:    rgba(210, 153, 34, 0.15);
--yellow-border: rgba(210, 153, 34, 0.25);

/* Status: Offline / error */
--red:        #f85149;
--red-dim:    rgba(248, 81, 73, 0.12);
--red-border: rgba(248, 81, 73, 0.25);

/* Info messages */
--blue:        #388bfd;
--blue-dim:    rgba(56, 139, 253, 0.15);
--blue-border: rgba(56, 139, 253, 0.30);

/* Gateway nodes */
--gateway:     #f0b429;
--gateway-dim: rgba(240, 180, 41, 0.15);
```

### Light Theme

```css
/* Backgrounds */
--bg:        #f5f5f0;   /* warm off-white */
--surface:   #ffffff;
--surface-2: #f0f0eb;

/* Borders */
--border:    rgba(0, 0, 0, 0.10);

/* Text */
--text:      #1a1a1a;
--text-muted:#4b5563;

/* Accent — GREEN in light theme (not purple) */
--accent:    #16a34a;
--accent-dim:rgba(22, 163, 74, 0.12);
--accent-2:  #15803d;

/* Status: Online */
--green:        #16a34a;
--green-dim:    rgba(22, 163, 74, 0.12);
--green-border: rgba(22, 163, 74, 0.25);

/* Status: Weak */
--yellow:        #d29922;
--yellow-dim:    rgba(210, 153, 34, 0.15);
--yellow-border: rgba(210, 153, 34, 0.25);

/* Status: Offline / error */
--red:        #f85149;
--red-dim:    rgba(248, 81, 73, 0.12);
--red-border: rgba(248, 81, 73, 0.25);

/* Info messages */
--blue:        #0969da;
--blue-dim:    rgba(9, 105, 218, 0.12);
--blue-border: rgba(9, 105, 218, 0.25);

/* Gateway nodes */
--gateway:     #d29922;
--gateway-dim: rgba(210, 153, 34, 0.15);
```

> **Note:** The accent colour changes between themes. Dark = purple (`#a78bfa`), Light = green (`#16a34a`). Primary action buttons should use `--accent-2` as the background with white text.

---

## Spacing & Radius

```css
--space-xs:  4px;
--space-sm:  8px;
--space-md:  12px;
--space-lg:  16px;
--space-xl:  20px;
--space-xxl: 24px;

--radius-sm:   10px;   /* cards, inputs, chips */
--radius-md:   16px;   /* modals, panels */
--radius-lg:   24px;   /* large cards */
--radius-full: 9999px; /* pills, badges */
```

---

## Status Semantics

These exact meanings are used throughout the mobile app and must be consistent in the dashboard:

| State | Colour token | Dark hex | Light hex | Usage |
|---|---|---|---|---|
| Online / active | `--green` | `#3fb950` | `#16a34a` | Node reachable, request received |
| Weak signal | `--yellow` | `#d29922` | `#d29922` | Node reachable but poor link |
| Offline | `--red` | `#f85149` | `#f85149` | Node unreachable, failed request |
| Gateway | `--gateway` | `#f0b429` | `#d29922` | Gateway node indicator |
| You / responder | `--accent` | `#a78bfa` | `#16a34a` | User location marker on map |
| Info message    | `--blue`   | `#388bfd` | `#0969da` | Info-type gateway message badge |

### Signal Bars

Signal bars use heights `6px / 9px / 12px / 15px`, `4px` wide, `2px` border-radius. Filled bars use the status colour; unfilled bars use `--border`.

RSSI thresholds:
- Strong: ≥ −50 dBm → 4 bars
- Good:   ≥ −70 dBm → 3 bars
- Fair:   ≥ −90 dBm → 2 bars
- Weak:   ≥ −105 dBm → 1 bar
- Dead:   < −105 dBm → 0 bars

---

## Component Patterns

### Cards

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);   /* 10px */
  padding: var(--space-md);          /* 12px */
}
```

### Status Pill / Badge

```css
.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: var(--radius-full);
  border: 1px solid <color-border>;
  background: <color-dim>;
  font: var(--text-label-sm);
  color: <color>;
  text-transform: uppercase;
}

/* Pulsing live dot */
.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse 1.5s ease-in-out infinite;
}
```

### Section Label

```css
.section-label {
  font: var(--text-label-lg);   /* 700 11px, uppercase, letter-spacing 1.2px */
  color: var(--text-muted);
  margin-bottom: var(--space-sm);
}
```

### Supply Type Chips

```css
.chip {
  background: var(--accent-dim);
  border: 1px solid var(--green-border);
  border-radius: var(--radius-full);
  padding: 2px 8px;
  font: 600 12px 'DM Sans';
  color: var(--accent);
}
```

---

## Supply Types & Emoji

```
water    → 💧  Water
food     → 🍎  Food
medical  → 🧰  Medical
other    → ✏️  Other
```

Medical condition types: `Injury` · `Chronic` · `Disability` · `Medication` · `Mental` · `Other`

---

## People Count Labels

Use these exact labels consistently across the dashboard:

| Field key | Label | Age range |
|---|---|---|
| `adults` | Infant | 0–2 |
| `children` | Child/Adult | 3–59 |
| `elderly` | Senior | 60+ |

Use `DM Mono` for all numeric counts, node IDs, coordinates, RSSI values, and timestamps.
Relative time for recent events ("just now", "3 min ago"), falling back to absolute time for older entries.
