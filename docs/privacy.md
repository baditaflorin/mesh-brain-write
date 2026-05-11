# Privacy threat model — mesh-brain-write

## What other peers in the same room can see

- **Released ideas** (`Y.Array<{ id, text }>`): no peer ID, no slot
  origin, no submission order. See [ADR 0002](adr/0002-phased-privacy-boundary.md).
- **Pending entries** (`Y.Map<peerId, { tagSlots }>`): each peer's
  not-yet-released ideas, keyed by their stable per-device UUID. **In
  principle every peer in the room can read every pending entry through
  the Yjs CRDT.** The UI is designed not to display anyone else's pending,
  but a debugger user could.
- **Session state** (`{ phase, prompt, startedAt, durationMs, releaseSeed }`).
- **Votes** (`Y.Map<ideaId, Y.Map<peerId, true>>`): voting is correlatable
  to peer UUIDs (used to enforce 3 dots per peer).

## What stays local

- Your room ID, mode, prompt, write duration, and tag bindings live in
  `localStorage`.
- Your peer UUID (`mesh-brain-write:peerId`) is generated on first load
  and persists.
- Your typed-but-not-yet-released ideas are in `localStorage` (keys
  `mesh-brain-write:pending1/2/3`) so a reload during the timer doesn't
  lose them.
- Camera frames on the wall are processed locally; only marker IDs are
  written into Yjs.

## What the signaling server sees

`signaling-server` sees the room name (`mesh-brain-write:<roomId>`),
encrypted SDP exchanges, and the connecting peer's IP. It does not see
ideas, votes, or camera frames.

## What the TURN server sees

`coturn-hetzner` relays encrypted WebRTC bytes when peers can't connect
directly. It sees IPs and encrypted payloads it cannot decrypt.

## Permissions asked

- **Camera (`getUserMedia`)** — only on the wall display, only in ArUco
  mode, only during the release phase.

## Known leaks

- **Pending visibility to debugger users.** The Yjs structure for pending
  entries is technically readable by anyone in the room. If you have a
  team member who would inspect the Yjs document during a brainstorm to
  see what others are typing, this app is the wrong tool. The UI does not
  display other peers' pending entries; the privacy of "what you've
  typed" is UI-enforced, not crypto-enforced.
- **Release ordering on the wire.** While the rendered list uses a
  deterministic shuffle, peers' CRDT update messages still arrive in some
  order. A network observer with packet timing could correlate a release
  to a peer's IP. The shuffle defeats UI-level correlation, not
  network-level.
