# Pixel Memory World · Decision Log

This file records only decisions that would create meaningful rework if guessed incorrectly.

## D001 · Final character pixel-art direction

**Status:** needs owner decision  
**Blocks:** production spritesheet / atlas generation only  
**Does not block:** current DOM fallback, multiplayer movement, actions, room editor, Tiled map, persistence

The V15.1 technical contract is already fixed:

- logical frame: 32 × 48
- directions: down / left / right / up
- actions: idle / walk / sit / wave / hug / celebrate
- DIY layers: body / hair / outfit / held item
- current DOM character remains the fallback until an atlas exists

Choose the visual language before generating the full atlas:

### A · Warm keepsake pixel — recommended

Closest to the current site identity.

- soft, slightly irregular pixel edges
- warm skin / muted clothing palette
- small facial features
- character still reads clearly against paper / room / outdoor backgrounds
- animation restrained rather than game-like
- best fit with the white embossed keepsake and warm-memory interface

**Tradeoff:** less “classic RPG” energy, more distinctive as a memory product.

### B · Classic handheld RPG

Closer to GBA / 16-bit top-down adventure language.

- crisper outlines
- stronger directional silhouettes
- more obvious walk cycles
- more game-like outdoor exploration
- efficient to animate and easy to read at small sizes

**Tradeoff:** the product can start feeling like a retro game first and a keepsake world second.

### C · Social chibi pixel

More expressive and avatar-focused.

- larger head-to-body ratio inside the same 32 × 48 frame
- more visible hair / outfit identity
- wave / hug / celebrate read more strongly
- strongest DIY / multiplayer personality

**Tradeoff:** requires more careful variant art and can become visually cute enough to compete with the restrained editorial UI.

### Default recommendation

Use **A · Warm keepsake pixel**, but borrow B's readable four-direction silhouette and C's clearer celebration poses.

That preserves the current product identity while making movement and social actions more legible.

---

## D002 · Production storage provider

**Status:** deferred; not blocking current development

V15.1 now routes rooms and uploads through adapters, so the provider can be chosen later without changing browser APIs.

Future options include:

- PostgreSQL / managed Postgres for structured room data
- Supabase if auth + Postgres + storage should live together
- Cloudflare R2 / S3-compatible storage for uploads
- another managed database/object-storage pair

Do not choose this solely for implementation convenience. The right provider depends on expected traffic, whether login is required, deployment platform, cost tolerance, and data-retention requirements.
