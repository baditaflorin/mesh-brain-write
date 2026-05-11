---
status: accepted
date: 2026-05-12
---

# 0002 — Phased state machine with privacy boundary

## Context

A brainwriting session has two phases with very different privacy semantics:

- **Write phase**: each peer is composing privately. No one else should see
  what you've typed, not even partially — that defeats the "no anchoring
  bias" benefit of silent brainstorming.
- **Release phase**: ideas pool into a shared list. Authorship should be
  unrecoverable.

The data model has to enforce both, or it's not actually a brainwriting tool.

## Decision

Two Yjs structures with a deliberate boundary between them:

1. `Y.Map<peerId, { tagSlots: Record<string, string> }>("pending")` — each
   peer's pending ideas, keyed by peer's stable UUID. Slot keys are `"1"`,
   `"2"`, `"3"` plus optional `"tag:<id>"` mirrors for ArUco lookup.
2. `Y.Array<{ id, text }>("ideas")` — flat, anonymous, released ideas.

During **write**, peers only ever write to `pending[myPeerId]`. To keep the
UX honest, the UI never displays anyone else's pending ideas — they're
technically visible in the Yjs doc (everyone can read everything), but the
write-phase UI shows only `pending[myPeerId]`. A debugger user could break
this, but at that point they're trying to cheat the brainstorm.

During **release**, the publish action atomically (within one
`doc.transact`) pushes the texts into `ideas[]` and clears the peer's
`pending.tagSlots`. The released entry contains only `{ id, text }` — no
peer ID, no original slot, no submission order.

The released list is then rendered **shuffled**, with the shuffle seed =
the session's `releaseSeed` (set when the phase transitioned, identical
on every phone). Shuffle is deterministic mulberry32, so every phone sees
the same order regardless of CRDT delivery order.

## Consequences

- A peer can re-enter write mode and edit pending ideas freely without
  affecting anyone else's view.
- The released list breaks submission-order correlation. Without the
  shuffle, a network observer could correlate "the first idea to land is
  whoever's network was fastest." With the shuffle and the seed
  established once at phase transition, that signal is gone.
- The system is leaderless: any phone can flip the phase. We pick one
  arbitrary releaseSeed (the first writer's `Date.now()`); Yjs' LWW means
  one wins and everyone agrees. Worst case: two phases flip near-
  simultaneously and the second seed overwrites the first. The shuffle
  still works.

## Alternatives considered

- **Encrypted pending notes.** Considered ephemeral encryption per peer
  with reveal at release. Rejected — adds complexity for protection
  against a threat (peer-inspecting-CRDT) that the UI already disincents.
- **Sort released ideas by random ID.** Would also work, but the seeded
  shuffle is easier to reason about and survives id-format changes.
