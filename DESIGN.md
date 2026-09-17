---
name: Callface CRM 2.0
description: Dense, trustworthy operating UI for Callface's sales and post-sale machine.
colors:
  seaweed-50: "#edf7f3"
  seaweed-100: "#dbf0e7"
  seaweed-200: "#b8e0cf"
  seaweed-300: "#94d1b7"
  seaweed-400: "#70c29e"
  seaweed-500: "#4db386"
  seaweed-700: "#2e6b51"
  seaweed-800: "#1f4736"
  seaweed-950: "#0b1913"
  page-bg: "#fafafa"
  canvas-bg: "#f8fafc"
  surface: "#ffffff"
  surface-muted: "#f3f4f6"
  text-primary: "#111827"
  text-secondary: "#4b5563"
  text-tertiary: "#666e7d"
  border-default: "#e5e7eb"
  border-control: "#767e8c"
  chrome-bg: "#1c1f26"
  chrome-bg-alt: "#16171c"
  chrome-active: "#1a1d24"
  chrome-text: "#ffffff"
  chrome-text-muted: "#9ca3af"
  success: "#4db386"
  success-bg: "#edf7f3"
  success-fg: "#1f4736"
  danger: "#d92d33"
  danger-bg: "#fceded"
  danger-fg: "#a11d21"
  warning: "#f59e0b"
  warning-bg: "#fdf1dd"
  warning-fg: "#8a5a06"
  info: "#4667e6"
  info-bg: "#eaeffe"
  info-fg: "#2542a8"
  chart-1: "#4db386"
  chart-2: "#5b8def"
  chart-3: "#f5a623"
  chart-4: "#9b7ef0"
  chart-5: "#f2708a"
typography:
  display:
    fontFamily: "var(--cf2-font-heading), system-ui, sans-serif"
    fontSize: "calc(40px * var(--cf2-escala))"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-1.4px"
  headline:
    fontFamily: "var(--cf2-font-heading), system-ui, sans-serif"
    fontSize: "calc(30px * var(--cf2-escala))"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-1.2px"
  title:
    fontFamily: "var(--cf2-font-heading), system-ui, sans-serif"
    fontSize: "calc(17px * var(--cf2-escala))"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.4px"
  body:
    fontFamily: "var(--cf2-font-ui), system-ui, sans-serif"
    fontSize: "calc(13px * var(--cf2-escala))"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "var(--cf2-font-ui), system-ui, sans-serif"
    fontSize: "calc(11px * var(--cf2-escala))"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.4px"
rounded:
  hero: "32px"
  card: "28px"
  inner: "20px"
  control: "14px"
  chip: "10px"
  full: "9999px"
spacing:
  colado: "4px"
  item: "8px"
  grupo: "12px"
  bloco: "16px"
  secao: "24px"
  pagina: "32px"
components:
  button-primary:
    backgroundColor: "{colors.seaweed-700}"
    textColor: "{colors.chrome-text}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 14px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 14px"
  card-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    padding: "20px"
  input-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
---

# Design System: Callface CRM 2.0

## Overview

**Creative North Star: "The Revenue Control Room"**

Callface CRM 2.0 is an operational cockpit, not a marketing surface. It should feel like a precise control room for sales, implementation, CS, billing, and automations: calm enough for eight hours of use, dense enough to expose the real state of the business, and sharp enough that exceptions are visible without making every screen shout.

The visual system is light workspace plus dark chrome. The content area uses white and cool-gray surfaces for scanning, while the sidebar, hero bands, and Carol bar use fixed dark chrome. Brand lives in a seaweed green used sparingly for action, active state, success, and the primary chart series.

**Key Characteristics:**
- Dense operational rhythm, not landing-page spacing.
- Semantic color only: brand, positive, warning, danger, info.
- Role tokens over raw values: `rounded-card`, `text-corpo`, `bg-positivo-suave`.
- One dominant element per screen.
- Real component states for loading, empty, error, focus, hover, and mobile.

## Colors

The palette is neutral-first with seaweed as the single brand accent, supported by clear status colors and a dark chrome shell.

### Primary
- **Seaweed Command Green** (`#4db386`): brand action, active navigation, positive indicators, and chart series 1. Use it rarely enough that it remains a signal.
- **Seaweed Ink** (`#0b1913`): text on Seaweed Command Green when the accent is used as a filled control.
- **Seaweed Deep** (`#2e6b51`): focus outline, strong borders, and darker brand emphasis when contrast matters.

### Secondary
- **Operational Blue** (`#4667e6`): informational state and chart series 2.
- **Attention Amber** (`#f59e0b`): warning state, risk, pending billing, and time-sensitive items.
- **Exception Red** (`#d92d33`): errors, losses, delays, churn evidence, and destructive context.

### Neutral
- **Workspace Paper** (`#fafafa`): page background for CRM2 surfaces.
- **Canvas Mist** (`#f8fafc`): secondary workspace background.
- **Surface White** (`#ffffff`): cards, controls, tables, dialogs, and popovers.
- **Muted Surface** (`#f3f4f6`): table headers, tabs background, filter rails, hover rows, and soft panels.
- **Primary Ink** (`#111827`): main text.
- **Secondary Ink** (`#4b5563`): supporting copy, labels, and metadata.
- **Tertiary Ink** (`#666e7d`): low-priority labels that still pass contrast on muted surfaces.
- **Default Line** (`#e5e7eb`): card/table borders.
- **Control Line** (`#767e8c`): input/select/checkbox border where the border is the only affordance.
- **Dark Chrome** (`#1c1f26`): sidebar, top dark blocks, and fixed application chrome.

### Named Rules

**The Color Means Work Rule.** Do not use color as decoration. Green means brand/action/positive; amber means risk; red means loss or destructive state; blue means informational context.

**The Accent Scarcity Rule.** Use one filled primary action per screen or panel. Multiple filled actions compete with operational urgency.

## Typography

**Display Font:** `var(--cf2-font-heading)` with system fallback  
**Body Font:** `var(--cf2-font-ui)` with system fallback  
**Navigation Font:** `var(--cf2-font-nav)` with system fallback  
**Mono Font:** `ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace`

**Character:** compact, modern, and work-focused. The type scale exists to keep a CRM legible without making every card become a hero section.

### Hierarchy
- **Display** (700, `text-hero`, 40px scaled, 1 line-height): one hero number or dominant control-room readout per screen.
- **Headline** (700, `text-destaque`, 30px scaled, 1 line-height): major KPI values and primary dashboard totals.
- **KPI** (700, `text-kpi`, 22px scaled, 1.05 line-height): KPI card values and compact metric emphasis.
- **Title** (600, `text-titulo`, 17px scaled, 1.3 line-height): card and section titles.
- **Item** (500-600, `text-item`, 14px scaled, 1.45 line-height): lead names, table primary labels, row titles, clickable list items.
- **Body** (400, `text-corpo`, 13px scaled, 1.45 line-height): default UI copy and table cells.
- **Support** (400, `text-apoio`, 12px scaled, 1.35 line-height): helper text, descriptions, captions, and metadata.
- **Micro** (700, `text-micro`, 11px scaled, 1.3 line-height, 0.4px tracking): badges, KPI labels, compact uppercase labels.

### Named Rules

**The Role Before Size Rule.** Choose the class by job, not by visual taste. If the job is a table cell, use `text-corpo`; if it is a row title, use `text-item`.

## Layout

The layout is a dense app shell: dark collapsible sidebar, contextual topbar, module tabs or area tabs, then full-width workspaces. Page padding is `cf2-p-pagina`: 16px on mobile and 24px from small screens up. Card padding is `cf2-p-card`: 16px 20px on mobile and 20px 24px from small screens up.

Spacing follows a 4px grid with semantic names: `colado` 4px, `item` 8px, `grupo` 12px, `bloco` 16px, `secao` 24px, and `pagina` 32px. Lists and tables stay compact; dashboard sections get more air only when it improves scanning.

Responsive behavior should preserve usefulness rather than squeeze everything. Kanban, journey bands, and wide tables may scroll horizontally; secondary columns can disappear; controls should wrap before they overlap. Mobile targets use a 44px minimum tap area where rows or controls are clickable.

## Elevation & Depth

Depth is structural and restrained. The system is mostly flat at rest, using tonal layering, border lines, and only three shadow roles. Shadows identify hierarchy, not decoration.

### Shadow Vocabulary
- **Resting Surface** (`0px 4px 8px 0px rgba(0, 0, 0, 0.04)`): default cards and ordinary raised panels.
- **Floating Surface** (`0px 8px 24px -4px rgba(0, 0, 0, 0.10)`): dropdowns, popovers, select menus, and hover cards.
- **Modal Surface** (`0px 24px 48px -12px rgba(0, 0, 0, 0.18)`): dialogs, sheets, drawers, and blocking overlays.
- **Shell Shadow** (`-4px 0px 16px 0px rgba(0, 0, 0, 0.08)`): application shell edge when a side panel needs separation.

### Named Rules

**The Hierarchy, Not Decoration Rule.** Do not add custom glows or new shadow recipes. If a surface is not resting, floating, modal, or shell, it probably does not need a shadow.

## Shapes

The form language is soft but deliberate. Large surfaces are generously rounded, nested objects are smaller, controls are compact, and tags are crisp. Use named radius roles: `rounded-hero` 32px, `rounded-card` 28px, `rounded-inner` 20px, `rounded-control` 14px, `rounded-chip` 10px, and `rounded-full` for avatars, pills, and toggles.

Drawers and sheets that touch the viewport edge should not round all four corners; they round only the exposed side. Nested cards inside cards should be avoided unless the nested element is a real interactive or semantic surface.

## Components

### Buttons
- **Shape:** `rounded-control` with fixed heights: 32px small, 36px medium, 40px large, 36px square for icon buttons.
- **Primary:** Seaweed Command Green background with Seaweed Ink text. One primary action per screen or focused panel.
- **Secondary:** Surface White background, Primary Ink text, Default Line border.
- **Ghost:** transparent background, Primary Ink text, hover by tonal shift.
- **Danger:** transparent background, red text, red border.
- **Hover / Active:** brightness shifts only (`95%` hover, `90%` active), not new colors.
- **Focus:** one visible `2px` Seaweed Deep outline with `2px` offset.

### Chips
- **Style:** `rounded-chip`, compact type, soft semantic backgrounds with matching foreground text.
- **State:** use a dot plus label for operational status when possible. Avoid turning every table cell into a filled badge.

### Cards / Containers
- **Corner Style:** `rounded-card` for top-level cards, `rounded-inner` for internal panels.
- **Background:** Surface White on Workspace Paper, or Dark Chrome for shell/hero bands.
- **Shadow Strategy:** Resting Surface shadow only; use border and spacing for most hierarchy.
- **Border:** Default Line for ordinary surfaces; semantic border only when the state matters.
- **Internal Padding:** `cf2-p-card` by default.

### Inputs / Fields
- **Style:** Surface White background, Primary Ink text, `rounded-sm`/`--cf2-radius-sm`, 12px horizontal padding.
- **Border:** Control Line when the border is the main affordance.
- **Focus:** Seaweed Deep outline and accent border, without stacked rings.
- **Disabled:** reduce opacity and remove pointer behavior.

### Tables
- **Style:** dense, full-width, horizontally scrollable when needed.
- **Header:** 40px height, 12px semibold labels, Secondary Ink.
- **Rows:** subtle bottom border, 10px vertical cell padding, hover on Muted Surface.
- **Numbers:** align right and use tabular treatment where numeric comparison matters.

### Navigation
- **Shell:** dark chrome sidebar with compact rows, icons from `lucide-react`, collapsible desktop rail, mobile Sheet, and keyboard toggle.
- **Active State:** active macro or subitem uses accent/active chrome treatment; only the current route gets the dot marker.
- **Macro Structure:** Início, Atendimento, Vendas, Calendário, Clientes, Automações, Insights, Ajustes. Do not reintroduce legacy micro-routes as primary sidebar items.
- **Tabs:** Muted Surface rail, Surface White active tab, compact 13px labels.

### Charts
- **Palette:** series 1 is always brand; series 2-5 use blue, amber, violet, and rose.
- **Behavior:** tooltips are expected. Static charts that do not respond to hover feel unfinished in this product.
- **Composition:** use bars, lines, gauges, or segmented bars before pie charts when categories exceed five.

### Drawers / Dialogs / Portals
- **Style:** Surface White, `rounded-card`, Default Line border, Modal Surface shadow.
- **Portal Rule:** dropdown, modal, tooltip, sheet, and popover styles must inherit CRM2 tokens from `[data-cf2-theme]`, because portals live outside the page subtree.
- **Usage:** long entity editing belongs in a drawer; avoid modal-on-modal stacks.

## Do's and Don'ts

### Do:
- **Do** use semantic tokens and `Cf2*` primitives for new CRM2 UI.
- **Do** make data dense but grouped: table rows, KPI strips, drawers, and contextual tabs are preferred over giant isolated cards.
- **Do** keep color tied to operational meaning.
- **Do** include empty, loading, error, focus, hover, disabled, and mobile states with the component.
- **Do** preserve the light workspace plus dark chrome split.
- **Do** run the design system checks for touched surfaces when UI changes are made.

### Don't:
- **Don't** write ad hoc hex colors, arbitrary radius values, or one-off font sizes in screen code.
- **Don't** install Once UI, HeroUI, Flowbite, or any kit that brings a parallel theme system.
- **Don't** use multiple filled primary actions in the same decision area.
- **Don't** treat billing, lifecycle, revenue type, or status color as interchangeable.
- **Don't** bring legacy CRM pages into the primary sidebar as top-level items.
- **Don't** fabricate visual proof, metrics, health scores, or category states when the data model does not support them.
