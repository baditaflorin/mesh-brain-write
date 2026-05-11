---
status: accepted
date: 2026-05-12
---

# 0003 — ArUco tag slots per peer

## Context

In ArUco mode, peers write each idea on its own paper index card with a
printed marker glued to the corner. The wall camera detects the tag and
publishes the matching idea. The question: how does the camera know
**which** of the peer's 3 ideas to publish for a given tag?

## Decision

Each peer binds tag IDs to their 3 idea slots in Settings:

```
tag 10 -> slot 1
tag 11 -> slot 2
tag 12 -> slot 3
```

The peer's `pending` Yjs entry exposes both slot-keyed and tag-keyed
mirrors:

```ts
tagSlots: {
  "1": "first idea text",
  "2": "second idea text",
  "tag:10": "first idea text",
  "tag:11": "second idea text",
  // …
}
```

When the wall camera detects tag 10, it iterates the `pending` map looking
for any peer whose `tagSlots["tag:10"]` is set; the first hit wins. The
matching idea is moved to the public `ideas[]` array and that entry is
removed from the peer's `tagSlots` in the same transaction.

Tag IDs **can be reused across peers** because lookups are scoped to the
peer entry. Tag 10 in Alice's `tagSlots` is independent of tag 10 in Bob's.
In practice you'd give different physical cards (and tag IDs) to different
people because the cards are paper, but the data model doesn't require it.

## Consequences

- **Three cards per person, one tag each.** Matches the physical mental
  model: each card is a discrete idea, hold up one card to publish one
  idea.
- **No multi-publish.** Once a peer's `tag:10` is consumed, holding the
  card up again is a no-op. To re-use a card across sessions, refresh the
  app (which re-publishes pending slots from `localStorage`).
- **Sloppy UX if bindings overlap.** If Alice binds tag 10 to slot 1 and
  Bob also binds tag 10, whichever peer's idea is found first wins
  (forEach iteration order). Document this and rely on convention.

## Alternatives considered

- **Tag ID directly = peer slot index.** Reserves a global tag space, e.g.
  tag 100..102 = Alice's three slots, tag 110..112 = Bob's three slots.
  Requires more printed cards and stricter handout.
- **One tag per peer, with a number scribbled next to it.** Requires OCR
  or hand-key entry. Same Tesseract complaint as the retro ADR.
