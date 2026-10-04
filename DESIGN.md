---
version: 15.3
name: Pixel Memory World
description: A warm multiplayer pixel-memory space. The interface should feel like a keepsake box that became a tiny playable world: soft paper surfaces, restrained pastel accents, readable modern Chinese typography, pixel-art scenes, and motion that responds to people rather than decorating every surface.
---

# Pixel Memory World · DESIGN.md

This is the visual contract for future edits. It follows the DESIGN.md method: tokens, hierarchy, component rules, motion rules, responsive behavior, and explicit anti-patterns.

## Atmosphere

The product is warm before it is nostalgic, playable before it is decorative.

Three layers should coexist:

1. UI layer — calm, readable, soft paper, modern sans-serif.
2. Memory-object layer — tickets, notes, photographs, pressed flowers, small physical imperfections.
3. Pixel-world layer — characters, rooms, terrain, fishing, celebrations.

Do not turn every UI element into pixel art. Pixel art is the world; the interface is the frame that lets people enter it.

## Color roles

| Token | Value | Role |
|---|---:|---|
| paper | #FBF6EE | Main light surface |
| paper-soft | #F5EEE6 | Secondary surface |
| ink | #403733 | Primary text |
| muted | #756B65 | Secondary text |
| coral | #CF7779 | Human / celebration accent |
| sky | #84ADBD | Room / connection accent |
| sage | #8CA58A | Outdoor / calm accent |
| gold | #DDB963 | Memory / warmth accent |
| hairline | rgba(83,66,56,.14) | Quiet boundaries |

Use one accent at a time in a component. Avoid neon colors. Gradients belong to ambient light, sky, water, or memory objects — not to every button.

## Typography

Families:
- UI / Chinese body: PingFang SC → Microsoft YaHei → Noto Sans CJK SC → system-ui.
- Metadata / room codes / tiny English labels: SF Mono / Consolas / Menlo fallback.
- Do not use Courier New as the default Chinese UI face.

Minimum sizes:
- Primary body: 14–16px.
- Secondary body: 12–14px.
- Interactive labels: 12px minimum.
- Metadata: 10–11px minimum.
- 8–9px is only allowed inside decorative pixel-world props where text is not required to operate the product.

Hierarchy:
- Hero: 50–84px desktop, 42–58px mobile.
- Section heading: 34–52px.
- Panel heading: 20–28px.
- Field / option heading: 14–17px.
- Body: 14–16px, line-height 1.6–1.8.


## V14.1 Typography & geometry guardrails

The visual references in awesome-design-md repeatedly separate readable product typography from truly decorative micro-labels. Pixel Memory follows that principle:

- Default body copy: 14–16px.
- Secondary explanatory copy: 12–14px.
- Interactive labels and button text: 12px minimum.
- Operational metadata: 10–11px minimum.
- 8–9px is reserved for decorative labels inside the pixel scene itself.
- Numbered workflow markers (01 / 02 / 03) are navigation cues: render them at 11–12px inside a 32–34px marker, never as 6–8px microtext.
- Section headings should wrap by sentence or phrase, not every 2–4 Chinese characters.
- Main content sections must be centered or intentionally left aligned. Accidental horizontal drift is a defect.
- Do not combine a max-width container with inherited negative horizontal margins.
- Any intentional full-bleed section must be tested at 1440px and 1728px widths for left/right clipping.
- Macro layout uses generous warm-editorial spacing; micro UI stays compact enough for the playable world.

## Shape language

Different actions must not all look like rectangles.

- Primary CTA: generous capsule.
- Icon action: circle.
- Search / invite / soundtrack row: pill.
- Memory object: physical irregular card / ticket / paper.
- Large visual preview: soft asymmetric radius.
- Pixel-world objects: grid-aligned / sprite-like.

Avoid seven identical rectangular buttons in a row, full-height drawers with little content, and huge empty floors added only to balance columns.

## Depth

Prefer light, composition, overlap, and blur over heavy box shadows.

Use hairline boundaries, soft ambient shadows for floating paper objects, backdrop blur only for overlays / navigation, and foreground overlap in world scenes.

Avoid thick border + strong shadow on every card.

## Motion system

Motion must explain state.

Navigation / scroll:
- Lenis may smooth wheel scrolling on content screens.
- World / Quest screens remain gameplay-first; smooth page scrolling should stop there.

Sequencing:
- GSAP is used for hero entrance and section choreography when available.
- Animation durations: 0.35–0.9s.
- Main ease: cubic-bezier(.2,.82,.24,1) / power3.out equivalent.

Micro-interaction:
- Magnetic pull: maximum about 5px for standard UI.
- Press: 1–2px physical compression.
- Spotlight: low-opacity radial light follows pointer on selected cards.
- Pixel dissolve: reserved for world / memory transitions, not general buttons.

Accessibility:
- Honor prefers-reduced-motion.
- Core navigation must work if Lenis / GSAP fail to load.
- Do not gate information behind hover-only effects.

## Landing page

The landing page reads as three scenes:
1. Enter — hero + playable room preview.
2. Leave traces — three compact interaction chapters.
3. Remember — editorial memory collage.

Visual content should replace empty whitespace. If a region feels empty, add meaningful visual narrative, not a decorative box.

## Creator & Avatar

- Creation screen: left preview visibly responds to right-side choices.
- Avatar screen: character is the visual anchor.
- No redundant three-step infographic underneath the character.
- Never stretch the preview column just because the form column is taller.
- Hair / outfit / held-item choices should read as branches or tokens, not spreadsheet cells.

## Keepsake / gift-card language

The saved keepsake is a ceremonial paper object, not an analytics dashboard or a jewelry box.

- Use warm white premium paper as the dominant surface.
- Texture should read as subtle paper fibre, never as a noisy digital pattern.
- Ornament is blind-embossed / debossed: very light gray, low contrast, formed by paired highlight and shadow rather than a printed decorative border.
- Main title and invitation quote stay centered with generous negative space.
- A small tonal pressed medallion may anchor the composition; avoid metallic gold as the primary visual language.
- Stats must not be four hard rectangular cells. Use open spacing and hairline separators.
- Participant tokens should resemble small paper seals / embossed badges, not jewels.
- One softly recessed paper panel is acceptable for the final quote; do not put every field in a box.
- The exported PNG must match the on-screen keepsake language, including paper texture and embossed ornament.
- On mobile, the card may scroll inside its shell and actions must remain reachable without covering content.

## V15.3 curation contract

Shared memories have two distinct concepts: **authorship** and **curation**.

- Authorship is immutable. A host moving or hiding an object must never change its `authorId` or displayed attribution.
- Authors may edit the content of their own memory.
- Hosts may compose the shared space by moving, hiding or removing participant memories, but may not rewrite participant text.
- Privileged mutations are server-authorized with private credentials; public actor IDs are not authentication.
- WebSocket messages are presence/realtime transport, not a trusted persistence authority.
- Host destructive curation must create recoverable history.
- Online host UI must follow the real owner token, not a user-controlled "host" checkbox.

## V15.1 asset boundary

The technical sprite contract is fixed and the production direction is now **Warm Keepsake Pixel (A)**.

- Logical character frame: 32 × 48.
- Directions: down / left / right / up.
- Actions: idle / walk / sit / wave / hug / celebrate.
- Layers: body, hair, outfit, held item.
- The runtime must keep the current DOM sprite as a fallback until a real atlas is present.
- Production atlas language: warm brown outlines, muted clothing, small facial features, restrained handmade irregularity, readable four-direction silhouettes, and expressive-but-not-cartoonish social poses.
- Keep the DOM sprite only as a compatibility fallback; new character work should extend the warm layered atlas instead of creating a second visual system.

## V15 system interaction contract

P1–P4 are now product systems, not decorative experiments.

- **Map / camera:** authored layers are Ground, Path, Objects, Collision and Foreground. Gameplay collision must come from the map contract instead of duplicated hard-coded geometry. Camera motion follows the local player and must disable itself while map placement needs 1:1 pointer coordinates.
- **Character actions:** use one shared state vocabulary — idle, walk, sit, wave, hug, celebrate. New renderers or future spritesheets must map onto these names instead of inventing incompatible animation flags.
- **Room editor:** editing is a deliberate owner mode. Editable props are visibly marked, keyboard-accessible, and save their world coordinates. Normal room play must not accidentally drag furniture.
- **Ownership:** privileged layout writes require a room-owner token. Client-side hiding is not sufficient security; the server must reject unauthorised layout writes.
- **Persistence:** local JSON storage remains a small-deployment adapter, but writes must be atomic and data/upload paths must be configurable so a persistent disk can be mounted without changing application code.

## Room & Outside

Room:
- Dock actions identifiable by icon and label.
- Celebration remains a deliberate full-screen ritual.
- Music drawer is content-sized.

Outside:
- terrain, path, river, bridge, trees and characters create front/back depth;
- avoid duplicate wayfinding signs;
- fishing shows actual pixel fish, bobber feedback, bubbles, splash and a playable reeling step.

## Reference interpretation

The project studies open-source tools and design-system analyses, but does not clone their brand identity.

- Lenis: smooth, native-scroll-compatible motion.
- GSAP: controlled sequencing and scroll choreography.
- Vanta: inspiration for pointer-reactive ambient fields; this project uses a lightweight native canvas instead of adding Three.js for the current visual direction.
- React Bits: Magnet, SpotlightCard and PixelTransition patterns are reinterpreted in vanilla DOM/CSS because this project is not React.
- awesome-design-md: methodology for documenting tokens, hierarchy, component variants, spacing, depth, responsive behavior and anti-patterns.

## Do / Don't

Do:
- keep copy readable;
- make the room preview and memory objects carry visual weight;
- use asymmetry deliberately;
- keep every major interaction keyboard/touch accessible;
- add visual feedback to actions that change shared state.

Don't:
- use tiny text to manufacture premium;
- add VFX just because a library can;
- make every surface a glass card;
- replace the pixel identity with generic 3D SaaS visuals;
- let visual refactors break Create → Avatar → Room → Outside → Return.
