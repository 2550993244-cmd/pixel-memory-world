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

**Status:** decided — A · Archive first, permanent delete later  
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

### Decision

Selected **A · Archive first, permanent delete later**.

Implemented in V15.5:
- archive is the default destructive room action
- archived rooms reject ordinary joins with HTTP 410
- archived rooms reject mutations with HTTP 423 and close live sockets
- the recovery window is **30 days**
- owner tokens / recovery keys can reopen the room during that window
- owners can still choose an explicit immediate permanent delete by retyping the room code
- permanent purge removes room data and associated uploaded assets
- an hourly server sweep permanently purges expired archives

The interface must state the recovery deadline clearly. “Archive” and “permanent delete” are separate concepts and must never be presented as the same button.


---

## D006 · Invitation access model

**Status:** decided — A · Secret invite link + friendly room code  
**Blocks:** whether invitation URLs need a secret token, whether room codes remain sufficient access credentials, waiting-room approval, invite rotation, anti-enumeration UX  
**Does not block:** current room creation, recovery keys, archive lifecycle, author permissions, world editor, maps, character art

V15.5 still uses a friendly six-character room code as both the room locator and the practical invitation credential. That is extremely low-friction, but it is not the strongest privacy boundary for a long-lived room containing photos, voices and personal messages.

### A · Secret invite link + friendly room code — recommended

Keep the six-character room code as the human-readable room identity, but add a high-entropy invitation token to the share link.

- invited friends tap one link and enter directly
- no account, password prompt or host approval
- guessing a six-character code alone is not enough to enter
- host can rotate the invite token if a link leaks without changing the room code or recovery key
- manually entering a room code can ask for the invitation token only when needed

**Best fit:** preserves the current “open the link and walk in” experience while making long-lived private memories materially harder to enumerate.

**Tradeoff:** sharing becomes link-first rather than relying only on a memorable six-character code.

### B · Host approval / waiting room

- room code or link brings a guest to a waiting room
- host approves each new participant before entry
- strongest social control for live events

**Tradeoff:** requires the host to be online and adds friction to birthday / graduation links that should work asynchronously.

### C · Six-character code remains sufficient

- keep the current model unchanged
- simplest invitation flow and easiest verbal sharing
- add only rate limiting and monitoring against brute-force attempts

**Tradeoff:** room privacy continues to depend heavily on a short code staying unknown.

### Decision

Selected **A · Secret invite link + friendly room code**.

Implemented in V15.6:
- each new room receives a high-entropy invite token separate from its six-character room code
- invite secrets are stored hashed on the server and are omitted from public room payloads
- the browser saves a received secret locally, then removes the `invite` query parameter from the visible URL
- protected-room GET, WebSocket, writes and room-scoped uploads all require the current invite secret unless the request proves room ownership
- invalid / missing invite tokens do not reveal protected-room existence through the ordinary GET endpoint
- the host can rotate the invite secret without changing the room code, owner recovery key or room content
- rotation immediately invalidates the old token and disconnects sessions authenticated with the previous link
- owner recovery bundles created from V15.6 onward can carry the current invite token

Legacy rooms stay code-accessible until the owner explicitly generates or rotates a secret invite, avoiding an invisible breaking migration.


---

## D007 · Invited guest capability

**Status:** decided — B · Collaborative link + view-only link  
**Blocks:** whether every valid invite is collaborative, whether view-only links exist, invite-role encoding, contribution controls in long-lived rooms  
**Does not block:** current secret invite protection, room archive/recovery, owner curation, recovery keys, maps or character work

V15.6 answers **who may enter**, but a valid invitation currently implies the normal collaborative experience: the guest can walk around and, after receiving an author credential, leave notes, photos, mementos and Outside memories.

The next product question is whether every invite should grant contribution rights.

### A · One collaborative invite — recommended for now

- anyone with the current secret invite can enter and contribute
- host curation and immutable authorship continue to protect the final keepsake
- one link remains extremely easy to explain and share

**Best fit:** birthdays, graduations and close-friend groups where participation is the point.

**Tradeoff:** there is no safe “just let relatives view it” link.

### B · Collaborative link + view-only link

- host gets two independently rotatable secret links
- collaborative invite can contribute
- view-only invite can explore, read, listen and view photos but cannot create or modify memories
- both remain account-free

**Best fit:** a room that is edited by a small group but later shared with a wider audience.

**Tradeoff:** introduces invite roles across REST, WebSocket UI and sharing surfaces.

### C · Host toggles the whole room between collaborative and view-only

- keep one invite secret
- host changes whether invited guests may contribute
- useful after an event ends

**Best fit:** “collect memories during the event, freeze afterward.”

**Tradeoff:** existing guests can suddenly lose contribution ability, and the single link cannot support contributors and viewers simultaneously.

### Decision

Selected **B · Collaborative link + view-only link**.

Implemented in V15.7:
- every new room receives two independent high-entropy invitation secrets
- the **contributor** invite grants normal collaborative access
- the **viewer** invite grants read/explore access only
- server GET responses identify the active access role without exposing either secret or hash
- viewer REST writes and room-scoped uploads return `403 view_only`
- viewer WebSocket sessions may publish only presence / movement events; chat, reactions, celebration, music control and content-changing realtime messages are blocked
- the browser removes creation controls and also blocks local mutation functions, preventing false local-only edits
- contributor and viewer secrets rotate independently and only disconnect sessions using the rotated role
- owner recovery bundles retain both invitation secrets

Both links remain account-free. A viewer can still walk through the room, read and listen, but cannot leave a new trace.


---

## D008 · View-only presence model

**Status:** decided — A · Invisible spectators  
**Blocks:** whether viewer avatars appear to collaborators, viewer online-count semantics, spectator privacy, large-audience realtime scaling  
**Does not block:** the dual invite permission model itself, persistent content permissions, archive/recovery, character art or map editing

V15.7 makes view-only guests read-only, but they still enter through the normal avatar flow and currently publish presence / movement. That means contributors can see viewer avatars walking around.

If a finished room is shared with a much wider audience, this becomes a distinct product choice.

### A · Invisible spectators — recommended

- viewers can move locally and explore every scene
- their avatar is not broadcast to contributors or other viewers
- they do not appear in the normal “people online” count
- the UI may show a coarse anonymous viewing count separately
- contributors continue to feel like the people actually “in the room”

**Best fit:** finished keepsakes shared with relatives, classmates or a larger audience.

**Tradeoff:** viewer mode feels less socially alive.

### B · Visible read-only avatars

- viewer avatars appear and move like normal participants
- they cannot create content or send social interactions
- everyone sees a shared crowd

**Best fit:** small trusted audiences where seeing who is present is part of the experience.

**Tradeoff:** wide sharing can clutter the world, expose presence and increase realtime load.

### C · Host chooses spectator visibility

- add a host setting: “只看访客可见 / 隐身”
- same viewer link, room-wide behavior can be switched later

**Best fit:** maximum flexibility.

**Tradeoff:** adds another live room setting and makes audience expectations less predictable.

### Decision

Selected **A · Invisible spectators**.

Implemented in V15.8:
- viewer avatars remain visible only to the viewer on their own device
- viewer presence, movement and Outside player-state messages are never rebroadcast by the server
- contributors keep their normal participant count; viewers do not inflate it
- contributors / owners receive only an anonymous viewer count
- viewer count is deduplicated by room + player id across multiple scene WebSockets
- viewer clients do not receive the anonymous audience count themselves
- viewers continue receiving collaborative room updates and contributor presence, so the finished world can still feel live
- forged viewer presence events are discarded server-side, not merely hidden by UI

This makes the viewer link a true spectator credential rather than a muted participant credential.


---

## D009 · Spectator entry flow

**Status:** decided — A · Instant spectator entry + optional local customization  
**Blocks:** whether view-only links retain full avatar customization, spectator onboarding friction, whether viewer names are collected at all  
**Does not block:** viewer privacy, anonymous counts, content permissions, contributor onboarding, archive/recovery

V15.8 makes viewer avatars local-only. That raises a UX question: if nobody else can see a viewer's name or avatar, should a viewer still complete the same full avatar-builder flow before entering?

### A · Instant spectator entry + optional local customization — recommended

- clicking a view-only link opens the world almost immediately
- assign a warm default / randomized local avatar
- viewer can optionally open “我的小人” later and customize it for their own screen
- do not ask for a name by default because it is not shared

**Best fit:** wider sharing to classmates, family and casual viewers.

**Tradeoff:** viewer onboarding feels less ceremonial than contributor onboarding.

### B · Keep the full avatar builder

- viewer still chooses name, hair, outfit and held item before entering
- their customization remains entirely local
- preserves the feeling of “walking into the world as yourself”

**Best fit:** small audiences where playful onboarding matters more than speed.

**Tradeoff:** adds friction for people who only want to look around, and collecting a name can falsely imply that others will see it.

### C · Lightweight spectator card

- ask only for a local nickname and one avatar preset
- fewer steps than the contributor builder
- clearly state “只有你自己看得到”

**Best fit:** a middle ground.

**Tradeoff:** creates a second onboarding UI to maintain.

### Decision

Selected **A · Instant spectator entry + optional local customization**.

Implemented in V15.9:
- valid viewer links skip the contributor avatar-builder screen and open the world immediately
- no viewer name is requested; the local-only label is simply “我”
- a stable warm avatar is derived locally from the browser's persistent actor identity
- a “我的小人” control lets the viewer change hair, outfit and held item after entering
- viewer customization is stored only in a separate local browser profile and is never sent through room REST / WebSocket APIs
- reopening or refreshing a room with saved viewer credentials continues directly into the world
- contributor onboarding remains unchanged

The view-only link now behaves like opening an interactive keepsake, while avatar customization remains available as an optional personal layer.


---

## D010 · Contributor entry flow

**Status:** decided — A · Keep the full contributor avatar builder  
**Blocks:** whether collaborator onboarding remains ceremonial, how quickly contributors can start leaving content, contributor identity expectations  
**Does not block:** viewer instant entry, spectator privacy, room access controls, persistence or archive/recovery

V15.9 deliberately makes viewer entry nearly frictionless, but contributors still complete the full avatar builder because their character is visible to others and their memories carry authorship.

The next question is whether contributors should keep that richer entrance.

### A · Keep the full contributor avatar builder — recommended

- contributor chooses name, hair, outfit and held item before entering
- the chosen identity is visible to collaborators
- authored notes / memories retain a clearer social context
- preserves the small ritual of “arriving as yourself” before contributing

**Best fit:** the contributor link is for close friends who are actively helping build the keepsake.

**Tradeoff:** a few more seconds before someone can leave their first memory.

### B · Quick contributor presets

- ask for a name, then choose one of 3–4 complete avatar presets
- enter in one compact screen
- detailed customization remains available later

**Best fit:** larger contributor groups where speed matters.

**Tradeoff:** loses some of the DIY character charm that the current site already supports.

### C · Instant contributor entry too

- assign a temporary visible identity and enter immediately
- name / avatar can be edited later

**Best fit:** absolute minimum friction.

**Tradeoff:** visible temporary names and avatars can make a collaborative room feel anonymous or messy, especially when authored memories are being created immediately.

### Decision

Selected **A · Keep the full contributor avatar builder**.

Implemented in V15.10:
- contributor secret links stop at the complete avatar-builder screen
- name, hair, outfit and held item are all chosen before entering
- the UI explicitly states that this identity is visible to collaborators and will contextualize authored memories
- only viewer links use the instant-entry path
- contributor presence is broadcast only after the person presses the final enter button
- CI verifies a contributor cannot skip directly into the world and that the chosen visible identity reaches the owner session

The asymmetry is intentional: **viewer = open and explore immediately; contributor = deliberately arrive as a visible participant before leaving a trace.**


---

## D011 · Returning contributor identity

**Status:** decided — A · Remember and prefill, but still show the full builder  
**Blocks:** whether repeat contributors must rebuild their character each visit, local contributor-profile persistence, how much friction remains after the first visit  
**Does not block:** the full contributor builder itself, viewer fast entry, authorship credentials, room permissions or recovery keys

V15.10 keeps the full contributor entry ritual. On the same device, however, a returning contributor still starts from the default name / appearance each time even though the underlying actor identity is already persistent.

The next question is how much of the **visible contributor profile** should be remembered locally.

### A · Remember and prefill, but still show the full builder — recommended

- save the last contributor name, hair, outfit and held item on that device
- the next contributor visit still opens the complete builder
- all previous choices are already selected and can be confirmed or changed
- entering remains a deliberate act, but returning friends do not rebuild themselves from zero

**Best fit:** preserves D010's ceremony while making repeat visits feel continuous.

**Tradeoff:** someone sharing a device may see the previous contributor profile until they edit it.

### B · Always reset to defaults

- every contributor visit starts blank / default
- no visible profile persistence

**Best fit:** shared devices and maximum explicitness.

**Tradeoff:** repeat contributors must redo the same setup every time even though their authorship identity is already recognized.

### C · Auto-resume returning contributors

- if a saved contributor profile and valid actor identity exist, skip the builder on repeat visits
- first visit still uses the full builder

**Best fit:** minimum friction for frequent collaborators.

**Tradeoff:** weakens the D010 rule and makes “first visit” vs “return visit” behavior less predictable.

### Decision

Selected **A · Remember and prefill, but still show the full builder**.

Implemented in V15.11:
- contributor name, hair, outfit and held item are stored locally under the persistent actor identity
- returning contributors still stop on the complete builder
- prior choices are prefilled and visibly selected
- the identity notice changes to “这台设备记得你” so the remembered state is explicit
- nothing is auto-broadcast until the contributor presses the final enter button
- viewer local profiles remain completely separate
- owner / creator onboarding does not consume contributor profile state

This preserves the entry ritual while making repeat visits continuous.


---

## D012 · In-room contributor avatar editing

**Status:** decided — A · Allow in-room appearance editing, keep name stable  
**Blocks:** whether a visible contributor can change their name / look without leaving and re-entering  
**Does not block:** returning-profile prefill, authorship credentials, viewer customization or room permissions

V15.11 remembers a contributor between visits, but once that contributor is already inside the room, their visible identity is effectively fixed until the next entry.

### A · Allow in-room appearance editing, keep name stable — recommended

Add a “我的小人” control for contributors too. Hair, outfit and held item can change live and broadcast to the room; the authored display name stays fixed for the current visit.

**Why:** people can play with their look without making authorship confusing.

### B · Allow full in-room identity editing

Name, hair, outfit and held item can all change live.

**Tradeoff:** old messages and memories may show one name while the current avatar shows another, which weakens social continuity.

### C · Keep contributor identity fixed for the whole visit

No in-room editor. To change anything, leave and re-enter through the builder.

**Tradeoff:** strongest ceremony, but unnecessarily rigid for cosmetic changes.

### Decision

Selected **A · Allow in-room appearance editing, keep name stable**.

Implemented in V15.12:
- contributors see an in-room “我的小人” control after entering
- the live editor exposes hair, outfit and held item only
- the current visit name is displayed but cannot be edited there
- saving updates the local player immediately and broadcasts a normal realtime `state` message
- other participants see the new appearance without a rejoin
- the updated appearance is written back to the remembered contributor profile for the next visit
- viewer customization remains local-only and separate
- room owners are not silently routed through the contributor editor

This keeps appearance playful while preserving authored-name continuity during a visit.


---

## D013 · Historical author display names

**Status:** decided — A · Keep the name snapshot stored with each memory  
**Blocks:** what happens when a contributor changes their name on a later visit, whether old memories should visually follow the latest name  
**Does not block:** stable current-visit names, appearance editing, actor credentials, viewer privacy or room permissions

V15.12 keeps a contributor's name stable while they are inside a room. But D011 still lets a returning contributor change their name on the next visit before entering.

That creates a historical question: if “小林” later returns as “Lynn”, what should old notes and mementos created as “小林” show?

### A · Keep the name snapshot stored with each memory — recommended

- old memories keep the display name used when they were created
- new memories use the newly confirmed name
- actor identity still links both to the same underlying contributor credential
- the room preserves how each memory originally appeared at that moment

**Best fit:** sentimental keepsakes where historical context matters.

**Tradeoff:** one person can appear under different names across years.

### B · Retroactively show the contributor's latest name everywhere

- all old memories render using the contributor's newest display name
- the room looks more consistent today

**Tradeoff:** historical content silently changes, and old screenshots / exports may no longer match the live room.

### C · Show both current identity and original snapshot

For example: “Lynn（当时：小林）”.

**Best fit:** maximum traceability.

**Tradeoff:** visually heavy for a warm, lightweight memorial interface.

### Decision

Selected **A · Keep the name snapshot stored with each memory**.

Implemented in V15.13:
- new authored objects store an immutable authorName snapshot alongside authorId
- the server canonicalizes the initial display-name snapshot and preserves it on duplicate / replayed add operations
- later text edits, movement, curation and contributor renames do not mutate the stored author name
- old records without authorName render through their existing by field
- notes, mementos, photos, activity items and Outside memories all use the snapshot contract
- the same authorId may legitimately appear as “小林” on an older memory and “Lynn” on a newer one

The hidden actor identity provides continuity and permissions; the displayed author name remains part of the historical moment.


---

## D014 · Public alias linkage

**Status:** needs owner decision  
**Blocks:** whether viewers can visibly tell that two historical names belong to the same contributor  
**Does not block:** permissions, immutable author snapshots, contributor renaming, recovery keys or room access

After D013, the system can know that “小林” and “Lynn” are the same underlying actor while preserving both historical names. The next question is whether that hidden continuity should ever be exposed in the warm public interface.

### A · Keep alias linkage private — recommended

- memories show only the name captured at creation time
- no “same person as…” badge or public alias history
- actorId remains an internal permission / continuity concept
- contributors can change how they present themselves over time without the room publishing an identity trail

**Best fit:** keeps the memorial interface simple and privacy-preserving.

### B · Subtle same-person indicator

When two names share an actorId, a detail view may show a small “同一位朋友” indicator without listing every historical name.

**Tradeoff:** adds identity inference that the contributor did not explicitly choose to publish.

### C · Public alias history

A contributor profile could show “曾用名：小林 / Lynn”.

**Tradeoff:** strongest continuity, but creates a persistent public identity history that is much heavier than the current product.

### Default recommendation

Choose **A · Keep alias linkage private**.

The system needs identity continuity for authorship and permissions; the room does not need to turn that internal identity graph into public biography.
