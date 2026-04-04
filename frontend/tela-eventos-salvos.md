# Design System Document: The Porto Alegre Nocturne

## 1. Overview & Creative North Star
**The Creative North Star: "The Urban Pulse"**

This design system is not a static interface; it is a living, breathing map of Porto Alegre’s energy. It rejects the "boxy" constraints of traditional SaaS templates in favor of an editorial, high-end experience that feels like a midnight drive through the Moinhos de Vento district. We move beyond "Modern" into "Atmospheric Sophistication."

To break the template look, we utilize **Intentional Asymmetry**. Large-scale typography is often offset, and UI elements overlap using glassmorphism to create a sense of physical depth. By favoring "Breathing Room" (generous white space) over density, we ensure that every vibrant orange action feels like a neon light cutting through a dark, foggy street.

## 2. Colors & Surface Philosophy
The palette is rooted in deep obsidian tones, punctuated by a high-energy "Clementine" orange.

### The "No-Line" Rule
**Borders are forbidden for structural sectioning.** We do not use 1px solid lines to separate content. Instead, boundaries are defined strictly through background color shifts. A `surface-container-low` section sitting on a `surface` background provides all the definition needed. If you feel the urge to add a line, add 1.4rem (`spacing-4`) of vertical space instead.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, semi-transparent sheets. 
- **Base Layer:** `surface` (#131313) or `surface-container-lowest` (#0E0E0E).
- **Secondary Containers:** `surface-container` (#201F1F).
- **Active/Floating Elements:** `surface-container-high` (#2A2A2A) with a 12px Backdrop Blur.

### The Glass & Gradient Rule
Main CTAs must not be flat. Use a linear gradient from `primary` (#FFB690) to `primary_container` (#F97316) at a 135-degree angle. This adds a "glow" that mimics light refraction. For modals, use `surface_variant` at 60% opacity with a `backdrop-filter: blur(20px)` to maintain the premium, glassmorphic aesthetic.

## 3. Typography: Plus Jakarta Sans
We use **Plus Jakarta Sans** for its geometric clarity and contemporary rhythm.

*   **Display (Editorial Impact):** Use `display-lg` (3.5rem) for hero headers. Set with `-0.04em` letter spacing to create a tight, authoritative "magazine" look.
*   **Headlines (Navigation):** `headline-md` (1.75rem) should be used for section titles, always in Semi-Bold to contrast against the dark background.
*   **Body (Readability):** `body-lg` (1rem) is our workhorse. Ensure a line-height of 1.6 to prevent "text-clumping" in dark mode.
*   **Labels (Utility):** `label-md` (0.75rem) in All-Caps with `+0.1em` letter spacing for small metadata or category tags.

The hierarchy conveys the brand: High-contrast size differences between Display and Body create a "Premium Editorial" feel that guides the eye instantly to the "Pulse" of the page.

## 4. Elevation & Depth
In this system, light comes from the content, not a global sun.

*   **The Layering Principle:** Depth is achieved by "stacking." A `surface-container-low` card placed on a `surface-container-lowest` background creates a natural, soft lift.
*   **Ambient Shadows:** For floating elements (like a navigation dock or a floating action button), use an extra-diffused shadow: `0px 24px 48px rgba(0, 0, 0, 0.4)`. To add "soul," add a secondary shadow: `0px 4px 12px rgba(249, 115, 22, 0.1)` (a hint of the primary orange).
*   **The Ghost Border Fallback:** If accessibility requires a stroke (e.g., input fields), use the `outline_variant` (#584237) at **15% opacity**. It should be felt, not seen.
*   **Glassmorphism:** Apply to any element that sits "above" the main flow (Modals, Hover states, Top Navigation). Use a subtle `1px` inner-top-border in `secondary_fixed` (#E5E2E1) at 10% opacity to simulate a "light catch" on the edge of the glass.

## 5. Components

### Buttons
*   **Primary:** Gradient (`primary` to `primary_container`), `xl` (0.75rem) roundedness. No border. Text is `on_primary_fixed` (#341100).
*   **Secondary:** `surface_container_high` background, `xl` roundedness. No border.
*   **Tertiary:** Ghost style. No background. Underline only on hover.

### Input Fields
*   **State:** Background should be `surface_container_low`. 
*   **Focus:** The "Pulse" effect. Transition the background to `surface_container` and add a 1px `primary` "Ghost Border" at 40% opacity.

### Cards & Lists
*   **Rule:** **Forbid dividers.**
*   **Execution:** Use `spacing-6` (2rem) to separate list items. For cards, use `surface_container_low` against a `surface` background. On hover, transition the card to `surface_container_high` and apply a subtle `0.5rem` lift.

### Chips
*   **Aesthetic:** Small, pill-shaped (`full` roundedness). Use `surface_container_highest` for inactive states and `primary_container` with 20% opacity for active states.

### Custom Component: The "Pulse Marker"
*   For the Porto Alegre map or dashboard markers, use a `primary` circle with a CSS animation: a secondary ring that expands and fades (pulse) to draw attention without being intrusive.

## 6. Do's and Don'ts

### Do:
*   **Do** use asymmetrical layouts. Push a heading to the far left and the content to the center-right.
*   **Do** use high-quality photography of Porto Alegre (Guaíba sunset, nighttime skyline) with a subtle dark overlay to ensure text legibility.
*   **Do** use the Spacing Scale religiously. If in doubt, add more space.

### Don't:
*   **Don't** use pure white (#FFFFFF) for body text. Use `on_surface` (#E5E2E1) to reduce eye strain in dark mode.
*   **Don't** use hard-edged shadows. If the shadow looks like a line, it is wrong.
*   **Don't** use standard "Success" green unless absolutely necessary for safety. Try to use `tertiary` (#93CCFF) for positive feedback to keep the palette sophisticated.
*   **Don't** use 100% opaque borders. Ever.