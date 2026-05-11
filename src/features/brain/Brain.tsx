import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { createRoomSync } from "../sync/yjsRoom";
import { createClockSync } from "../sync/clockSync";
import { maybeFetchTurnCredentials } from "../sync/iceConfig";
import {
  startScanner,
  drawPreview,
  type MarkerEvent,
  type ScannerHandle,
} from "../markers/scanner";
import { seededShuffle } from "./shuffle";

export type Mode = "tap" | "apriltag";
export type Phase = "write" | "release" | "vote" | "results";

type Idea = { id: string; text: string };

type Session = {
  phase: Phase;
  prompt: string;
  startedAt: number;
  durationMs: number;
  releaseSeed: number; // set when entering release phase
};

type PendingPeer = {
  tagSlots: Record<string, string>; // tagId(stringified) -> idea text
};

type Props = {
  roomId: string;
  myPeerId: string;
  mode: Mode;
  tagBindings: Record<number, 1 | 2 | 3>; // tagId -> slot
  writeDurationMin: number;
  prompt: string;
  isWall: boolean;
  onOpenSettings: () => void;
};

export function Brain({
  roomId,
  myPeerId,
  mode,
  tagBindings,
  writeDurationMin,
  prompt,
  isWall,
  onOpenSettings,
}: Props) {
  const [armed, setArmed] = useState(false);
  const [session, setSession] = useState<Session>({
    phase: "write",
    prompt,
    startedAt: Date.now(),
    durationMs: writeDurationMin * 60_000,
    releaseSeed: 0,
  });
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [votes, setVotes] = useState<Record<string, Set<string>>>({});
  const [now, setNow] = useState(Date.now());
  const [peers, setPeers] = useState(0);
  const [lastMarker, setLastMarker] = useState<number | null>(null);

  // Pending ideas (per peer, 3 slots).
  const [pending1, setPending1] = useState("");
  const [pending2, setPending2] = useState("");
  const [pending3, setPending3] = useState("");

  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const scannerRef = useRef<ScannerHandle | null>(null);

  const meshHandle = useMemo(() => {
    if (!armed) return null;
    const room = createRoomSync(roomId);
    const clock = createClockSync(room.provider);
    return { room, clock };
  }, [armed, roomId]);

  useEffect(() => {
    if (!armed) return;
    void maybeFetchTurnCredentials();
  }, [armed]);

  useEffect(() => {
    return () => {
      meshHandle?.clock.destroy();
      meshHandle?.room.provider?.destroy();
      scannerRef.current?.stop();
      scannerRef.current = null;
    };
  }, [meshHandle]);

  // Load my pending from localStorage.
  useEffect(() => {
    setPending1(localStorage.getItem("mesh-brain-write:pending1") ?? "");
    setPending2(localStorage.getItem("mesh-brain-write:pending2") ?? "");
    setPending3(localStorage.getItem("mesh-brain-write:pending3") ?? "");
  }, []);

  useEffect(() => {
    localStorage.setItem("mesh-brain-write:pending1", pending1);
    localStorage.setItem("mesh-brain-write:pending2", pending2);
    localStorage.setItem("mesh-brain-write:pending3", pending3);
  }, [pending1, pending2, pending3]);

  // Bind Yjs.
  useEffect(() => {
    if (!meshHandle) return;
    const doc = meshHandle.room.doc;
    const ySession = doc.getMap("session");
    const yIdeas = doc.getArray<Idea>("ideas");
    const yVotes = doc.getMap<Y.Map<boolean>>("votes");
    const yPending = doc.getMap<PendingPeer>("pending");

    const readSession = () => {
      setSession({
        phase: (ySession.get("phase") as Phase | undefined) ?? "write",
        prompt: (ySession.get("prompt") as string | undefined) ?? prompt,
        startedAt: (ySession.get("startedAt") as number | undefined) ?? Date.now(),
        durationMs: (ySession.get("durationMs") as number | undefined) ?? writeDurationMin * 60_000,
        releaseSeed: (ySession.get("releaseSeed") as number | undefined) ?? 0,
      });
    };
    const readIdeas = () => setIdeas(yIdeas.toArray());
    const readVotes = () => {
      const next: Record<string, Set<string>> = {};
      yVotes.forEach((m, id) => {
        const s = new Set<string>();
        m.forEach((_, peerId) => s.add(peerId));
        next[id] = s;
      });
      setVotes(next);
    };

    if (!ySession.has("phase")) {
      doc.transact(() => {
        ySession.set("phase", "write");
        ySession.set("prompt", prompt);
        ySession.set("startedAt", Date.now());
        ySession.set("durationMs", writeDurationMin * 60_000);
        ySession.set("releaseSeed", 0);
      });
    }

    readSession();
    readIdeas();
    readVotes();

    ySession.observe(readSession);
    yIdeas.observe(readIdeas);
    yVotes.observeDeep(readVotes);

    // Awareness for peer count.
    const awareness = (
      meshHandle.room.provider as unknown as {
        awareness?: {
          on: (e: string, cb: () => void) => void;
          off: (e: string, cb: () => void) => void;
          getStates: () => Map<number, unknown>;
        };
      } | null
    )?.awareness;
    const updatePeers = () => {
      if (!awareness) return;
      setPeers(Math.max(0, awareness.getStates().size - 1));
    };
    awareness?.on("change", updatePeers);
    updatePeers();

    // Always publish our pending slots — kept fresh by the effect below.
    void yPending;

    return () => {
      ySession.unobserve(readSession);
      yIdeas.unobserve(readIdeas);
      yVotes.unobserveDeep(readVotes);
      awareness?.off("change", updatePeers);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meshHandle]);

  // Push pending ideas to Yjs.
  useEffect(() => {
    if (!meshHandle) return;
    const yPending = meshHandle.room.doc.getMap<PendingPeer>("pending");
    const slots: Record<string, string> = {};
    if (pending1.trim()) slots["1"] = pending1.trim();
    if (pending2.trim()) slots["2"] = pending2.trim();
    if (pending3.trim()) slots["3"] = pending3.trim();
    // Also expose them keyed by tagId for ArUco lookup.
    const tagSlots: Record<string, string> = { ...slots };
    Object.entries(tagBindings).forEach(([tagIdStr, slotNum]) => {
      const slotKey = String(slotNum);
      const text = slots[slotKey];
      if (text) tagSlots[`tag:${tagIdStr}`] = text;
    });
    yPending.set(myPeerId, { tagSlots });
  }, [pending1, pending2, pending3, meshHandle, myPeerId, tagBindings]);

  // Animation tick.
  useEffect(() => {
    if (!meshHandle) return;
    let frame = 0;
    const tick = () => {
      setNow(meshHandle.clock.meshNow());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [meshHandle]);

  // Auto-advance write -> release when time runs out (any phone races).
  useEffect(() => {
    if (!meshHandle) return;
    if (session.phase !== "write") return;
    const elapsed = now - session.startedAt;
    if (elapsed >= session.durationMs) {
      const ySession = meshHandle.room.doc.getMap("session");
      meshHandle.room.doc.transact(() => {
        ySession.set("phase", "release");
        ySession.set("releaseSeed", Math.floor(Date.now()));
      });
    }
  }, [meshHandle, now, session]);

  // Scanner (wall + apriltag + release).
  useEffect(() => {
    if (!armed || !isWall || mode !== "apriltag" || session.phase !== "release") {
      scannerRef.current?.stop();
      scannerRef.current = null;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const h = await startScanner({
          width: 480,
          height: 360,
          onMarker: (m) => onScannedMarker(m, meshHandle?.room.doc ?? null),
          onFrame: (markers) => {
            if (previewRef.current && scannerRef.current) {
              drawPreview(previewRef.current, scannerRef.current.canvas, markers);
            }
          },
        });
        if (cancelled) {
          h.stop();
          return;
        }
        scannerRef.current = h;
      } catch (err) {
        console.warn("[scanner] failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, isWall, mode, session.phase, meshHandle]);

  function onScannedMarker(m: MarkerEvent, doc: Y.Doc | null) {
    if (!doc) return;
    setLastMarker(m.id);
    const yPending = doc.getMap<PendingPeer>("pending");
    const yIdeas = doc.getArray<Idea>("ideas");
    const tagKey = `tag:${m.id}`;
    let foundText: string | null = null;
    let foundPeer: string | null = null;
    let foundSlots: Record<string, string> | null = null;
    yPending.forEach((p, peerId) => {
      if (foundText) return;
      const text = p?.tagSlots?.[tagKey];
      if (text && text.trim()) {
        foundText = text;
        foundPeer = peerId;
        foundSlots = p.tagSlots;
      }
    });
    if (!foundText || !foundPeer || !foundSlots) return;
    const text: string = foundText;
    const peer: string = foundPeer;
    const slots: Record<string, string> = foundSlots;
    const idea: Idea = { id: crypto.randomUUID(), text: text.trim() };
    // Clear that tag entry from the peer's pending slots.
    const newSlots: Record<string, string> = { ...slots };
    delete newSlots[tagKey];
    doc.transact(() => {
      yIdeas.push([idea]);
      yPending.set(peer, { tagSlots: newSlots });
    });
  }

  const publishMyIdeas = () => {
    if (!meshHandle) return;
    const doc = meshHandle.room.doc;
    const yIdeas = doc.getArray<Idea>("ideas");
    const yPending = doc.getMap<PendingPeer>("pending");
    const texts = [pending1, pending2, pending3].map((t) => t.trim()).filter((t) => !!t);
    if (texts.length === 0) return;
    doc.transact(() => {
      yIdeas.push(texts.map((t) => ({ id: crypto.randomUUID(), text: t })));
      yPending.set(myPeerId, { tagSlots: {} });
    });
    setPending1("");
    setPending2("");
    setPending3("");
  };

  const setPhase = (next: Phase) => {
    if (!meshHandle) return;
    const ySession = meshHandle.room.doc.getMap("session");
    ySession.set("phase", next);
    if (next === "release" && !session.releaseSeed) {
      ySession.set("releaseSeed", Math.floor(Date.now()));
    }
  };

  const toggleVote = (id: string) => {
    if (!meshHandle) return;
    const yVotes = meshHandle.room.doc.getMap<Y.Map<boolean>>("votes");
    let m = yVotes.get(id);
    if (!m) {
      m = new Y.Map<boolean>();
      yVotes.set(id, m);
    }
    if (m.has(myPeerId)) {
      m.delete(myPeerId);
    } else {
      let used = 0;
      yVotes.forEach((mm) => {
        if (mm.has(myPeerId)) used += 1;
      });
      if (used >= 3) return;
      m.set(myPeerId, true);
    }
  };

  const myUsedDots = Object.values(votes).filter((s) => s.has(myPeerId)).length;
  const dotsLeft = 3 - myUsedDots;

  const writeRemainingMs = Math.max(0, session.durationMs - (now - session.startedAt));
  const writeRemainingS = Math.ceil(writeRemainingMs / 1000);

  const arm = () => setArmed(true);

  const shuffledIdeas = useMemo(() => {
    if (session.releaseSeed === 0) return ideas;
    return seededShuffle(ideas, session.releaseSeed);
  }, [ideas, session.releaseSeed]);

  const sortedByVotes = useMemo(() => {
    return [...ideas].sort((a, b) => (votes[b.id]?.size ?? 0) - (votes[a.id]?.size ?? 0));
  }, [ideas, votes]);

  if (!armed) {
    return (
      <div className="brain-arm">
        <h1>mesh-brain-write</h1>
        <p>
          Silent brainstorm. Type up to 3 ideas privately on a timer. When the timer hits zero,
          everyone's ideas flow into a shuffled anonymous list for voting.
          {mode === "apriltag"
            ? " ArUco mode: write each idea on its own index card with a printed tag glued in the corner; hold them up to the wall camera during release."
            : null}
        </p>
        <p className="brain-arm-info">
          Role: <code>{isWall ? "wall display" : "writer"}</code> · {writeDurationMin} min write
        </p>
        <button type="button" className="brain-arm-button" onClick={arm}>
          {isWall ? "Open the wall display" : "Join the brainstorm"}
        </button>
        <button type="button" className="brain-arm-secondary" onClick={onOpenSettings}>
          Open settings
        </button>
        <p className="brain-hint">
          Room <code>{roomId}</code> · prompt <em>"{prompt}"</em>
        </p>
      </div>
    );
  }

  return (
    <div className="brain-stage">
      <div className="brain-hud">
        <span>{peers + 1} phones</span>
        <span aria-hidden="true">·</span>
        <span>{session.phase}</span>
        {lastMarker !== null ? (
          <>
            <span aria-hidden="true">·</span>
            <span>last #{lastMarker}</span>
          </>
        ) : null}
      </div>

      {isWall && mode === "apriltag" && session.phase === "release" && (
        <canvas
          ref={previewRef}
          className="brain-preview"
          width={240}
          height={180}
          aria-label="ArUco scanner preview"
        />
      )}

      <div className="brain-phase-bar">
        {(["write", "release", "vote", "results"] as Phase[]).map((p) => (
          <button
            key={p}
            type="button"
            className={"brain-phase-btn" + (session.phase === p ? " brain-phase-active" : "")}
            onClick={() => setPhase(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="brain-prompt">{session.prompt}</div>

      {session.phase === "write" && (
        <>
          <div className="brain-countdown">{formatClock(writeRemainingS)}</div>
          {!isWall && (
            <div className="brain-write">
              {[1, 2, 3].map((slot) => (
                <textarea
                  key={slot}
                  className="brain-textarea"
                  placeholder={`Idea ${slot}`}
                  value={slot === 1 ? pending1 : slot === 2 ? pending2 : pending3}
                  onChange={(e) => {
                    if (slot === 1) setPending1(e.target.value);
                    if (slot === 2) setPending2(e.target.value);
                    if (slot === 3) setPending3(e.target.value);
                  }}
                  rows={2}
                />
              ))}
              <div className="brain-write-actions">
                <button type="button" onClick={() => setPhase("release")}>
                  I'm done — go to release
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {session.phase === "release" && (
        <>
          {!isWall && mode === "tap" ? (
            <div className="brain-release-tap">
              <button
                type="button"
                onClick={publishMyIdeas}
                disabled={!pending1.trim() && !pending2.trim() && !pending3.trim()}
              >
                Release my {[pending1, pending2, pending3].filter((t) => t.trim()).length} idea(s)
              </button>
            </div>
          ) : !isWall && mode === "apriltag" ? (
            <div className="brain-release-tag">
              Hold each tagged card up to the wall camera. Your ideas will appear here as they're
              published.
            </div>
          ) : null}
          <div className="brain-grid">
            {shuffledIdeas.map((i) => (
              <div key={i.id} className="brain-card">
                {i.text}
              </div>
            ))}
            {shuffledIdeas.length === 0 && (
              <div className="brain-empty">No ideas released yet.</div>
            )}
          </div>
        </>
      )}

      {session.phase === "vote" && (
        <>
          <div className="brain-vote-hud">
            {dotsLeft} dot{dotsLeft === 1 ? "" : "s"} left
          </div>
          <div className="brain-grid">
            {shuffledIdeas.map((i) => {
              const count = votes[i.id]?.size ?? 0;
              const mine = votes[i.id]?.has(myPeerId) ?? false;
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => toggleVote(i.id)}
                  className={"brain-card brain-card-clickable" + (mine ? " brain-card-mine" : "")}
                >
                  <span>{i.text}</span>
                  {count > 0 ? <span className="brain-card-dots">●{count}</span> : null}
                </button>
              );
            })}
          </div>
        </>
      )}

      {session.phase === "results" && (
        <div className="brain-grid">
          {sortedByVotes.map((i, idx) => (
            <div key={i.id} className={"brain-card" + (idx < 3 ? " brain-card-top" : "")}>
              <span>{i.text}</span>
              <span className="brain-card-dots">●{votes[i.id]?.size ?? 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
