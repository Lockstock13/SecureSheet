```markdown
# Design System Specification: Industrial Precision

## 1. Overview & Creative North Star
The Creative North Star for this system is **"The Kinetic Engine."** 

Unlike the "bubbly" or "airy" consumer web, this system is inspired by high-performance industrial machinery and command-center interfaces. It rejects the trend of excessive whitespace and soft "glassy" aesthetics in favor of high-density data, tectonic layering, and surgical precision. 

The design breaks the "template" look by utilizing **intentional asymmetry** and **tonal depth**. We move away from flat UI by treating the screen as a physical chassis where components are "machined" into the interface rather than floating on top of it. This is a secure, authoritative environment built for professionals who value information density over decorative fluff.

---

### 2. Colors & Tonal Architecture
The palette is rooted in Deep Charcoal and Slate, punctuated by a high-frequency Electric Blue. 

*   **The "No-Line" Rule:** Standard 1px solid borders for sectioning are strictly prohibited. Boundaries must be defined through **background color shifts**. For example, a `surface-container-low` component should sit on a `surface` background to create a "recessed" or "nested" look without a single stroke.
*   **Surface Hierarchy:** Use the `surface-container` tiers (Lowest to Highest) to create structural depth. 
    *   `surface-container-lowest` (#0e0e0e): Used for the deep-background or "well" of the application.
    *   `surface-container-high` (#2a2a2a): Used for interactive panels and primary data modules.
*   **Electric Accents:** The `primary` (#adc6ff) and `primary_container` (#4d8eff) are your "active state" indicators. Use them sparingly but with high impact to draw the eye to critical paths.

---

### 3. Typography: The Technical Editorial
We pair the geometric confidence of **Manrope** with the monospaced utility of **JetBrains Mono** (referenced here as `spaceGrotesk` in the tokens) to bridge the gap between human-readable headers and machine-readable data.

*   **Display & Headlines (Manrope):** These should be set with tight letter-spacing (-0.02em) to feel "heavy" and authoritative.
*   **Data & Labels (JetBrains Mono/Space Grotesk):** All technical readouts, timestamps, and status labels must use the `label` tokens. This monospaced feel ensures that changing numbers don't "jump" and reinforces the industrial vibe.
*   **Contrast as Hierarchy:** Use `on-surface-variant` (#c2c6d6) for secondary metadata to ensure the `on-surface` (#e5e2e1) primary text commands the user's focus.

---

### 4. Elevation & Depth: Tonal Layering
We do not use shadows to create depth. Instead, we use **Tonal Layering** and **Ghost Borders**.

*   **The Layering Principle:** Depth is achieved by "stacking." A card is not a floating object; it is a milled-out section. Place a `surface_container_highest` (#353534) element inside a `surface_dim` (#131313) layout to create a "raised" effect.
*   **The "Ghost Border" Fallback:** If accessibility requires a container boundary, use a **Ghost Border**. This is a 1px stroke using the `outline_variant` (#424754) token at **15% opacity**. It should be felt, not seen.
*   **Zero Shadows:** Avoid traditional CSS drop shadows. If a "floating" element (like a context menu) is required, use a high-contrast `outline` (#8c909f) to define the edge, making it feel like a physical component resting on the surface.

---

### 5. Components: Machined Primitives

*   **Buttons:**
    *   **Primary:** Solid `primary_container` (#4d8eff) with `on_primary_container` text. Radius: `sm` (2px) or `DEFAULT` (4px). No gradients.
    *   **Secondary/Ghost:** `outline_variant` Ghost Border with a hover state that shifts the background to `surface_container_high`.
*   **Input Fields:**
    *   Use `surface_container_lowest` for the input well. This creates an "etched" look. 
    *   Active state: A 2px left-side border in `primary` (#adc6ff).
*   **Cards & Lists:**
    *   **Forbid Dividers.** To separate list items, use a 2px vertical gap (Spacing `0.5`) or alternating tonal shifts between `surface_container_low` and `surface_container_medium`.
*   **The "Data Block":**
    *   A custom component for this system. A compact container featuring a `label-sm` header in `on-surface-variant` and a `title-lg` value in `on-surface`. Used for quick-glance metrics.
*   **Chips:** 
    *   Sharp-edged (Radius `sm`). Use `secondary_container` for background with `on_secondary_container` text for a low-profile, "military" tag look.

---

### 6. Do’s and Don’ts

**Do:**
*   **Embrace Density:** Use Spacing Scale `2` (0.4rem) and `3` (0.6rem) frequently. Information should feel packed but organized.
*   **Align to the Grid:** Every element must feel "snapped" into place. Use `none` or `sm` rounding for a professional, non-bubbly feel.
*   **Use Tonal Shifts:** If you think you need a border, try changing the background color by one hex-step first.

**Don't:**
*   **No Glassmorphism:** Never use backdrop-blur or high-transparency "frosted glass." It undermines the "secure and precise" vibe.
*   **No Large Radii:** Never exceed `lg` (8px) rounding. If a component looks like a pill, it is wrong.
*   **No Center Alignment:** Industrial systems are built for scanning. Maintain left-aligned structures and rigid columns.

---

### 7. Spacing & Logic
The spacing scale is intentionally tight. 
*   **Standard Padding:** Use `2.5` (0.5rem) for internal component padding.
*   **Section Gaps:** Use `6` (1.3rem) for major layout sections.
*   **Compact Mode:** For data-dense tables, drop to `1` (0.2rem) padding to maximize screen real estate.

This system is not meant to be "friendly." It is meant to be **efficient**. Every pixel must serve a purpose. If an element doesn't convey data or provide a clear action, remove it.```