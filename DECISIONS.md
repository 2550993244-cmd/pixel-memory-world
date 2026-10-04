# Pixel Memory World · Decision Log

This file records only decisions that would create meaningful rework if guessed incorrectly.

## D001 · Final character pixel-art direction

**Status:** decided — A · Warm keepsake pixel  
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

### Decision

Selected **A · Warm keepsake pixel**, while deliberately borrowing B's readable four-direction silhouette and C's clearer social poses.

Implemented in V15.2 as the `warm-v1` layered atlas:
- warm brown outline
- muted coral / lake blue / sage / butter clothing
- small restrained facial features
- four-direction silhouettes
- clearer wave / hug / celebrate poses
- DOM sprite retained only as fallback

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


---

## D003 · Participant memory authority

**Status:** needs owner decision  
**Blocks:** dragging / rotating / deleting participant mementos in the room editor; server-side author permissions  
**Does not block:** furniture editing, Tiled map, character atlas, room revisions, storage adapters

V15.2 now records a persistent `authorId` on newly created notes, photos, room mementos and Outside memories. The project can therefore distinguish a realtime player session from the person/device that originally contributed a memory.

The remaining question is product governance: **what is the room owner allowed to do with memories contributed by other people?**

### A · Host as curator — recommended

The room creator is also the curator of the shared memory space.

- authors can edit / move / remove their own memories
- the host can reposition any memory to compose the room
- the host may hide / remove any memory for moderation
- moving a memory never changes its attribution
- destructive host actions should be recoverable from room history

**Best fit:** a birthday / anniversary / group keepsake where one person designs the final experience and guests contribute material.

**Tradeoff:** contributors do not have absolute control over placement after contributing.

### B · Author-owned objects

Contributors keep spatial ownership.

- authors can move / edit / remove their own memories
- host can rearrange furniture but cannot move another person's memory
- host may only hide/remove content for moderation

**Best fit:** a more equal collaborative world.

**Tradeoff:** the host cannot fully compose the final room and clutter/conflicts are harder to resolve.

### C · Shared-editing world

Any participant can rearrange shared memories.

- everyone can move objects
- attribution stays attached
- deletion still needs author or host permission

**Best fit:** playful synchronous sessions with trusted friends.

**Tradeoff:** easiest to disrupt accidentally and hardest to make feel like a durable keepsake.

### Default recommendation

Choose **A · Host as curator**.

It matches the current product structure: one person creates the world, invites others in, and ultimately preserves a composed keepsake. Author attribution should remain immutable even when the host changes placement.
