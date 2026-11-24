# Burnigator design system

A compact, Material-inspired visual system for the visitor map, WWW timetable, and admin tools. Tokens and shared component rules live in [assets/design-system.css](assets/design-system.css); use these named controls and surface rules as the default when adding UI.

## Foundations

- **Typeface:** `Roboto`, then `Noto Sans`, `Segoe UI`, `system-ui`, sans-serif. This uses Android's familiar Roboto where available and avoids a remote font dependency.
- **Color:** Deep blue `#305EAA` for primary actions and headings; hot pink `#E94F85` for emphasis; orange-red `#E63D1A` for destructive actions and alerts; warm paper `#E6D0BB` and light paper `#F5EADD` for surfaces; ink `#26364D` for text.
- **Type scale:** `--type-display` 36px; `--type-headline` 28px; `--type-title` 20px; `--type-title-small` 18px; `--type-body` 16px; `--type-body-small` and `--type-label` 14px; `--type-small` and `--type-caption` 12px. Use medium/semibold weights for headings and labels, regular for body copy. Keep ordinary interface copy at or above 12px; allow smaller text only for compact visual indicators such as the favorite marker on a timeline item.
- **Shape and spacing:** Use the shared `--button-radius` for pill controls, `--shape-card` (16px) for cards, `--shape-control` (12px) for fields and larger controls, `--shape-compact` (8px) for nested controls, and `--shape-tab` (10px) for tabs joined to a panel. `--shape-dialog` (20px) is available for larger overlay surfaces. Use the spacing rhythm `--space-1` to `--space-6` (4, 8, 12, 16, 24, 32px) for gaps and component padding rather than introducing nearby one-off values.
- **Minimum sizes:** `--control-height` is 42px for standard controls and `--control-height-touch` is 44px on mobile. Compact icon controls may use their fixed 40px circular geometry. Inputs, buttons, and touch targets should not be made smaller without a clear layout reason.
- **Surfaces and elevation:** Use warm paper surfaces for the page, near-white for cards, and a cool blue tint for selected or expanded content. Reserve three subtle elevation levels for raised cards, menus, and popovers. Use the shared outline color for borders.
- **Focus:** Use the shared pink `--color-focus-ring`. Keep keyboard focus visible and honor reduced-motion preferences.

## Button styles

Use only these five named button styles, plus the requested Chip style. Destructive actions use the Primary shape with the alert color; they do not introduce another style.

| Style | Class | Use |
| --- | --- | --- |
| Primary button | `.button-primary` (legacy `.button`) | Main save, add, continue, and confirm action |
| Secondary button | `.button-secondary` (legacy `.subtle`) | Supporting action such as export, add event, collapse, or import |
| Light button | `.button-light` | Compact controls on a light surface, including player and icon-only actions |
| Outlined button | `.button-outlined` | Low-emphasis action that should remain clearly actionable |
| Text button | `.button-text` | Inline or tertiary action, including links inside cards |
| Chip button | `.chip-button` | Compact filter or view selection, with `.active` or `aria-pressed="true"` for its active state |

Controls can have compact layouts or icon-only shapes, but should keep the same color, border, type, focus, and interaction rules. Every actionable control gets consistent hover, pressed, disabled, and keyboard-focus feedback. Avoid adding another visual variant; use a named style and apply a semantic destructive color only when needed.

## Component state contract

Every interactive component must define its applicable states in `assets/design-system.css`, use the state that matches its actual HTML/ARIA state, and keep the state behavior consistent across visitor and admin views.

| State | Convention | Shared treatment |
| --- | --- | --- |
| Default | No state class/attribute | Component's named default style |
| Hover | `:hover` on pointer-capable devices | Subtle surface/border change; do not rely on hover for information or action availability |
| Keyboard focus | `:focus-visible` | Visible shared pink focus ring |
| Pressed | `:active` | Brief press feedback; no persistent layout shift |
| Selected / active | `.active`, `aria-pressed="true"`, or `aria-selected="true"` | Clear selected surface and foreground contrast |
| Expanded | Native `details[open]` or `aria-expanded="true"` | Summary/control surface indicates the open section |
| Disabled | `:disabled` or `aria-disabled="true"` | Shared disabled opacity and cursor; native disabled controls also stop interaction |
| Invalid | `aria-invalid="true"` | Alert outline and soft alert focus surface |
| Loading | `aria-busy="true"` | Progress cursor and no duplicate activation while busy |
| Error / success | `.error` / `.success` or semantic status roles | Alert/success semantic colors and readable text contrast |

Use native `disabled` for controls that cannot be activated. Use `aria-disabled` only when an element needs to remain focusable; its action must also be blocked in code. State should be exposed semantically, not only by color. Reduced-motion preferences disable interaction transitions.

The setup wizard randomly selects one of five coordinated palettes; owners can adjust the app palette from Configuration → General. The `theme` object in `data/map.json` stores `primary`, `accent`, `alert`, and `background` hex colors; missing or invalid values resolve to the original Burnigator defaults.

## Component consistency constraint

When an interface context calls for a button, chip, switch, card, field, dialog, or other established component, always use the shared design-system class and behavior. Do not create one-off visual button styles or controls that bypass the shared component styles. Contextual layout rules (such as full width or icon placement) may be added, while color, typography, shape, focus, and interaction states continue to come from the named design-system component.

## Surfaces and interactive components

- **Cards:** Place rows, POI editors, event editors, and detail popovers use `--shape-card`, a quiet outline, shared spacing, and subtle elevation. Expanded/selected content uses a blue-tinted surface; keyboard focus uses the shared focus ring.
- **Dashboard cards:** The owner dashboard uses `.config-card` surfaces with the same title treatment as configuration cards, nested tiles and list rows on the low surface with `--shape-control`/`--shape-compact`, and status boxes with a 4px success or alert edge. Cards in one grid row share the height of the tallest card and keep their action button on the bottom edge; on phones the grid is a single column and each card is only as tall as its content.
- **Expandable rows:** POI, program, icon, and category summaries look and respond like their mapped Light, Secondary, or Outlined control. Keep a visible disclosure affordance and keyboard focus.
- **Switches:** Binary options such as category visibility, POI name labels, and “has program” use the shared Material-style switch.
- **Category selection:** Admin event category assignment uses inactive/active chips. The visitor WWW category filter uses one full-width row per category with a Material-style switch indicator, wrapped long labels, and `aria-pressed` state.
- **Inputs:** Use the shared 42px minimum height (44px on mobile), `--shape-control`, a neutral outline, and the shared focus ring. Invalid fields use `aria-invalid="true"`.

## Existing control mapping

- Main save and add actions use Primary; destructive delete actions use alert-colored Primary.
- Export, account tools, and add-event actions use Secondary.
- Place rows, expandable POIs, SoundCloud controls, and the event favorite control use Light.
- App install, icon picker, and translation controls use Outlined.
- POI program links in the place list use full-width Outlined buttons; map popup program links use Outlined buttons like the WWW translation action; WWW event detail links and other inline links use Text buttons.
- Map/WWW navigation and admin views use Chips. Festival day selection uses tab-shaped Chip controls visually joined to the timetable surface; WWW filters use outlined controls in a separate, labeled group.
- Map POI details and WWW event details share the same rounded surface, heading, and description typography. WWW event detail actions keep the favorite and close controls together at the end of the header.
