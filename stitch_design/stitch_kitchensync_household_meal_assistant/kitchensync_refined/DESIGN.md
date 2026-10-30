---
name: KitchenSync Refined
colors:
  surface: '#faf9f6'
  surface-dim: '#dadad7'
  surface-bright: '#faf9f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f4f0'
  surface-container: '#eeeeea'
  surface-container-high: '#e8e8e5'
  surface-container-highest: '#e2e3df'
  on-surface: '#1a1c1a'
  on-surface-variant: '#424843'
  inverse-surface: '#2f312f'
  inverse-on-surface: '#f1f1ed'
  outline: '#727972'
  outline-variant: '#c2c8c1'
  surface-tint: '#466550'
  primary: '#032212'
  on-primary: '#ffffff'
  primary-container: '#1a3826'
  on-primary-container: '#81a28a'
  inverse-primary: '#adcfb5'
  secondary: '#3b684a'
  on-secondary: '#ffffff'
  secondary-container: '#b7e9c3'
  on-secondary-container: '#3d6a4c'
  tertiary: '#3b0d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#5f1a00'
  on-tertiary-container: '#ef774d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c8ebd1'
  primary-fixed-dim: '#adcfb5'
  on-primary-fixed: '#022111'
  on-primary-fixed-variant: '#2f4d3a'
  secondary-fixed: '#bceec8'
  secondary-fixed-dim: '#a1d2ad'
  on-secondary-fixed: '#00210f'
  on-secondary-fixed-variant: '#224f33'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59c'
  on-tertiary-fixed: '#390c00'
  on-tertiary-fixed-variant: '#822801'
  background: '#faf9f6'
  on-background: '#1a1c1a'
  surface-variant: '#e2e3df'
  canvas-base: '#FBFBF9'
  canvas-subtle: '#F5F4EF'
  surface-card: '#FFFFFF'
  border-subtle: '#E6E4DD'
  border-strong: '#D5D2C7'
  sage-muted: '#6E8879'
  sage-wash: '#EDF2EE'
  terracotta-soft: '#FBF1ED'
  accent-cider: '#B45309'
  dietary-veg: '#137333'
  dietary-nonveg: '#9E2A2B'
  dietary-egg: '#D97706'
typography:
  headline-lg:
    fontFamily: Noto Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Noto Sans
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Noto Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Noto Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  title-md:
    fontFamily: Noto Sans
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Noto Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Noto Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Noto Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Noto Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-bilingual:
    fontFamily: Noto Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes a high-craft, contemporary culinary interface that discards abrasive, neon saturation in favor of a thoughtful, calm, and tactile experience. Inspired by the editorial elegance of bespoke cooking journals and the crisp, precise utility of modern productivity applications like Linear and Notion, the visual direction embraces a tailored **Culinary Modernism**.

The target audience spans discerning domestic cooks, urban meal planners, and multi-generational households who value order, culinary heritage, and effortless interaction. The interface evokes quiet confidence, freshness, and warmth without resorting to garish hues. Bilingual Devanagari labels and standardized Indian dietary marks (FSSAI green/red) are integrated with precision into a serene canvas of warm culinary neutrals, deep forest emeralds, soft sage tones, and measured terracotta accents.

## Colors

The chromatic architecture replaces loud, artificial primaries with an earthy, tailored palette derived from botanical elements and kitchen stoneware.

- **Primary (`#1A3826` - Deep Forest):** An authoritative, grounding shade used for high-impact actions, key navigation states, active segmented controls, and dominant headlines.
- **Secondary (`#2D5A3D` - Muted Emerald / Sage Pine):** Provides refined tonal depth across supporting containers, active filter chips, interactive secondary surfaces, and progress indicators.
- **Tertiary (`#C85A32` - Muted Terracotta):** Used sparingly as an energetic accent for critical culinary alerts, low-stock warnings, meal plan highlights, and focus state indicators.
- **Neutral Canvas & Surfaces:**
  - `canvas-base` (`#FBFBF9`): Warm off-white canvas preventing clinical glare.
  - `canvas-subtle` (`#F5F4EF`): Tonal inset panels, input fills, and background groupings.
  - `surface-card` (`#FFFFFF`): Crisp pure white for cards, sheets, and elevated overlays.
  - `border-subtle` (`#E6E4DD`): 1px structural division lines across cards, headers, and list dividers.
- **Domain Indicators:**
  - `dietary-veg` (`#137333`): Standardized culinary green dot and bounding frame.
  - `dietary-nonveg` (`#9E2A2B`): Restrained crimson maroon dot and frame.
  - `dietary-egg` (`#D97706`): Warm amber variant indicator.

## Typography

Typography relies on **Noto Sans** for unified, native harmony between Latin and Devanagari scripts. This ensures unified x-heights, identical visual weights, and pristine cross-script vertical alignment.

### Typographic Craft & Hierarchy
- **Pacing & Restraint:** Headlines favor semi-bold weights (`600`) over heavy, aggressive black styles. Tight letter spacing (`-0.02em`) creates an editorial, contemporary feel.
- **Bilingual Typographic Engine:**
  - Primary text (English or Hindi based on device locale) takes dominant body or title hierarchy.
  - Secondary Devanagari/Latin companion text renders via `label-bilingual` using muted neutral values (`#6E8879` or `#71746E`) to maintain effortless scanning.
  - A minimum line-height buffer of `1.35x` is strictly maintained to prevent clipping on Devanagari vowel signs (*matras*) and upper headline strokes (*shirorekha*).

## Layout & Spacing

Layout geometry follows an 8px modular baseline system with 4px micro-increments for compact item grids, shelf listings, and inline pills.

- **Grid Architecture:** 4 columns on mobile viewports (<640px), 8 columns across tablet displays (640px to 1024px), and a max-width 1200px 12-column layout on desktop environments.
- **Density & Breathing Room:** Generous vertical rhythm separates high-level kitchen workflows (pantry audits, recipe steps, grocery generation), while internal card data uses tight, structured pairings (`space-sm` and `space-md`).
- **Touch Targets:** Interactive kitchen targets (checkboxes, steppers, voice search triggers) maintain an uncompromising 44x44px minimum hit region, ensuring reliable use during active cooking.

## Elevation & Depth

Depth is established primarily through **1px crisp boundary lines combined with diffused, low-opacity ambient shadows** rather than high-contrast drops. This evokes the clean layer architecture of modern tools like Linear.

- **Level 0 (App Canvas):** `#FBFBF9`, flat with zero elevation.
- **Level 1 (Cards & Inset Tiles):** Crisp white (`#FFFFFF`) framed by a 1px border (`#E6E4DD`) and a delicate ambient shadow: `0 1px 2px rgba(26, 56, 38, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)`.
- **Level 2 (Hovered Cards & Dropdowns):** `#FFFFFF`, 1px border (`#D5D2C7`), shadow: `0 4px 12px rgba(26, 56, 38, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)`.
- **Level 3 (Sticky Bottom Bars & Drawers):** Backdrop-filtered glass (`rgba(251, 251, 249, 0.85)` with `backdrop-filter: blur(12px)`), bordered on the edge with `#E6E4DD`, shadow: `0 -4px 16px rgba(26, 56, 38, 0.05)`.
- **Level 4 (Modals & Recipe Overlays):** `#FFFFFF`, subtle outline, shadow: `0 16px 36px rgba(26, 32, 28, 0.12), 0 4px 12px rgba(0, 0, 0, 0.04)`.

## Shapes

The shape system adopts a refined rounded hierarchy (Level 2). Geometric balance is maintained by avoiding bulbous corners in large containers while using fully rounded profiles for metadata tags:

- **Cards and Dialog Containers:** 12px to 16px (`1rem`) border radius, delivering soft yet architecturally precise edges.
- **Inputs & Field Enclosures:** 8px to 10px corner radius, balancing structure and friendliness.
- **Chips, Badges, and Status Tags:** 9999px (`pill-shaped`) curvature to distinctly communicate tag status, interactivity, and category segmentation.
- **Inner Nested Media (Thumbnails, Icons):** 6px to 8px radius, matching the geometric curve of outer containers proportionately.

## Components

### 1. Buttons
- **Primary:** Background `#1A3826`, text `#FFFFFF`, 10px border radius, 42px height (48px touch bounding box). Hover transitions to `#244B34`. Active press scales subtly to `0.98`.
- **Secondary:** Surface `#EDF2EE`, text `#1A3826`, border `1px solid #D1DFD6`. Hover shifts to `#E2EAE3`.
- **Terracotta Accent (Action/Warning):** Background `#C85A32`, text `#FFFFFF`, used strictly for critical steps (e.g., "Start Cooking", "Discard Expired").
- **Ghost/Tertiary:** Background transparent, text `#2D5A3D`, 1px border transparent, active hover reveals `#F5F4EF`.

### 2. Dietary Marks (FSSAI Standard)
- **Veg Mark:** Pure white or transparent square (14x14px), 1px solid stroke in `#137333`, containing a centered solid circular pip (6px diameter) in `#137333`.
- **Non-Veg Mark:** Exact identical geometry with 1px stroke in `#9E2A2B` and inner solid circle in `#9E2A2B`.
- **Alignment:** Aligned to the cap-height of recipe or ingredient titles with a 6px horizontal gap.

### 3. Cards (Pantry Item & Recipe)
- **Pantry Item Card:** Crisp `#FFFFFF` surface, 1px `#E6E4DD` border line, 12px radius, padded with 12px (`space-md`). Features dietary mark, English item title with Devanagari secondary label (`label-bilingual`), current stock progress bar, and subtle stepper actions (`- / +`).
- **Recipe Inspiration Card:** 16px radius, image header with subtle 1px inner overlay border, time-to-cook pill badge, dietary marker, and high-legibility title pairing.

### 4. Chips & Pill Badges
- **Status Pills:** 24px height, 9999px radius, 8px horizontal padding.
  - *In Stock:* Background `#EDF2EE`, text `#1A3826`, border `1px solid #D5E1D8`.
  - *Expiring Soon:* Background `#FBF1ED`, text `#B45309`, border `1px solid #F1D4C6`.
- **Filter Chips:** Inactive in `#F5F4EF` with `#1E201E` text. Active in `#1A3826` with pure white text and an explicit check mark.

### 5. Input Fields & Search
- Surface `#F5F4EF`, default border `1px solid #E6E4DD`, 10px radius, 44px height.
- Transitions to `#FFFFFF` background with a crisp `1px solid #1A3826` outline and a soft green glow (`0 0 0 3px rgba(45, 90, 61, 0.1)`) on focus.
- Trailing voice-search mic icon encased in an accessible 40x40px touch zone with gentle hover feedback.

### 6. Checkboxes & Steppers
- **Checkboxes:** 18x18px, 4px corner radius. Unchecked has a 1.5px `#D5D2C7` border on white. Checked fills with `#1A3826` and renders a 1.5px white checkmark.
- **Quantity Steppers:** Segmented container (`#F5F4EF`) bordered by 1px `#E6E4DD` housing two 32x32px flat buttons (`-` and `+`) flanking a centered quantity and metric unit (e.g., `250 g`).