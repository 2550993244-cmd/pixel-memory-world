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

**Status:** decided — A · Host as curator  
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

### Decision

Selected **A · Host as curator**.

Implemented in V15.3:
- every new contributor receives a persistent local actor identity plus a private actor credential
- the server, not the browser UI, verifies author / owner mutations
- authors can edit, move, hide and remove their own memories
- hosts can move, hide and remove participant memories but **cannot rewrite another person's title/text**
- attribution is immutable during host curation
- host memento / Outside curation creates recoverable server revisions
- raw WebSocket memory writes no longer bypass REST authorization


---

## D004 · Cross-device identity and recovery

**Status:** decided — A · No mandatory account + optional recovery key  
**Blocks:** ownership recovery on a new phone/computer, portable author identity, long-term room deletion/recovery, whether an auth provider is required  
**Does not block:** current room codes, same-device ownership, host curation, multiplayer, Tiled maps, character art, storage adapters

V15.3 deliberately keeps identity **device-local**. A private actor credential and room-owner token live only in that browser. This gives a low-friction experience, but clearing browser storage or changing devices loses privileged identity unless a recovery mechanism is added.

The product now needs to choose how much account infrastructure it wants.

### A · No mandatory account + optional recovery key — recommended

Keep the current invitation flow account-free.

- guests enter with a room code and never need to register
- creators can optionally export a recovery key / QR for room ownership
- contributors can optionally export their personal identity key if they want authorship portability
- importing the key on another device restores the same privileges
- no email/password database is required for ordinary use

**Best fit:** a lightweight keepsake link that friends can open immediately.

**Tradeoff:** users who never save a recovery key can still lose privileged access after clearing storage.

### B · Optional sign-in

Keep guests account-free, but let creators / contributors attach identity to an account.

- room joining still needs no login
- sign-in can restore ownership and authored memories across devices
- supports future room library / dashboard
- likely requires passkey, magic-link or social-auth infrastructure

**Best fit:** if Pixel Memory is becoming a recurring personal product rather than a one-off shared keepsake.

**Tradeoff:** significantly more privacy, auth, email and account-lifecycle complexity.

### C · Mandatory accounts

Every participant signs in before contributing.

- strongest identity and cross-device guarantees
- easiest future moderation / room history / personal library model

**Tradeoff:** highest friction and weakest fit with spontaneous birthday / anniversary invitations.

### Decision

Selected **A · No mandatory account + optional recovery key**.

Implemented in V15.4:
- ordinary room entry remains account-free
- owner recovery keys restore both room ownership and the creator's author identity
- participant identity keys restore authorship without granting owner privileges
- recovery keys use a versioned `PMR1` envelope with SHA-256 corruption detection
- imported credentials are checked against the room server before replacing current browser credentials
- corrupted keys and incorrect owner tokens are rejected
- the recovery center supports copyable keys and portable `.pmrkey` files

A recovery key is a bearer secret: possession of the key grants the represented privilege. The UI must continue treating it like a password, never like a shareable invitation code.


---

## D005 · Room deletion and retention

**Status:** needs owner decision  
**Blocks:** owner-facing delete/archive controls, automatic cleanup policy, recovery after accidental deletion  
**Does not block:** invitations, recovery keys, author identity, curation, multiplayer, maps, character art

Now that room ownership can survive device changes, the next irreversible product rule is what “delete this world” should actually mean.

### A · Archive first, permanent delete later — recommended

- owner can archive a room immediately
- archived rooms stop accepting normal joins and become read-only to the owner
- server keeps the room for a fixed recovery window
- owner can restore it during that window
- permanent deletion happens only after a second explicit action or after the recovery window expires

**Best fit:** sentimental content where accidental deletion would be disproportionately painful.

**Tradeoff:** the service retains data for a period after the user first asks to remove it, so the UI must state the recovery window clearly.

### B · Immediate permanent deletion

- one confirmed delete removes room data and uploaded media immediately
- no server-side recovery

**Best fit:** strongest “delete means delete now” semantics.

**Tradeoff:** one mistaken click can permanently erase a shared keepsake.

### C · Archive only, no self-service permanent delete

- owner can hide/archive a world
- permanent deletion requires support/admin action

**Best fit:** early prototype with maximum safety against accidental loss.

**Tradeoff:** poor long-term user control and not appropriate for a mature privacy model.

### Default recommendation

Choose **A · Archive first, permanent delete later**, with a clearly disclosed recovery window and an explicit “delete permanently now” escape hatch.
