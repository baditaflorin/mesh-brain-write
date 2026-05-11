import { useEffect, useState } from "react";
import { Brain, type Mode } from "./features/brain/Brain";
import { SettingsDrawer } from "./features/settings/SettingsDrawer";
import { appConfig } from "./shared/config";

const STORAGE = {
  room: `${appConfig.storagePrefix}:room`,
  peerId: `${appConfig.storagePrefix}:peerId`,
  mode: `${appConfig.storagePrefix}:mode`,
  prompt: `${appConfig.storagePrefix}:prompt`,
  writeDur: `${appConfig.storagePrefix}:writeDurationMin`,
  isWall: `${appConfig.storagePrefix}:isWall`,
  tagBindings: `${appConfig.storagePrefix}:tagBindings`,
};

const DEFAULT_PROMPT = "How can we delight our next 10 customers?";

function readString(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback;
}
function readNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
function readBool(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key);
  return raw === null ? fallback : raw === "1";
}
function readBindings(): Record<number, 1 | 2 | 3> {
  try {
    const raw = localStorage.getItem(STORAGE.tagBindings);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const out: Record<number, 1 | 2 | 3> = {};
    Object.entries(parsed).forEach(([k, v]) => {
      const tag = Number(k);
      if (!Number.isFinite(tag)) return;
      if (v === 1 || v === 2 || v === 3) out[tag] = v;
    });
    return out;
  } catch {
    return {};
  }
}
function getOrCreatePeerId(): string {
  const existing = localStorage.getItem(STORAGE.peerId);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE.peerId, id);
  return id;
}

export function App() {
  const [roomId, setRoomId] = useState(() => readString(STORAGE.room, "default"));
  const [mode, setMode] = useState<Mode>(() => (readString(STORAGE.mode, "tap") as Mode) || "tap");
  const [prompt, setPrompt] = useState(() => readString(STORAGE.prompt, DEFAULT_PROMPT));
  const [writeDurationMin, setWriteDurationMin] = useState(() => readNumber(STORAGE.writeDur, 5));
  const [isWall, setIsWall] = useState(() => readBool(STORAGE.isWall, false));
  const [tagBindings, setTagBindings] = useState<Record<number, 1 | 2 | 3>>(() => readBindings());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [peerId] = useState(() => getOrCreatePeerId());

  useEffect(() => {
    localStorage.setItem(STORAGE.room, roomId);
  }, [roomId]);
  useEffect(() => {
    localStorage.setItem(STORAGE.mode, mode);
  }, [mode]);
  useEffect(() => {
    localStorage.setItem(STORAGE.prompt, prompt);
  }, [prompt]);
  useEffect(() => {
    localStorage.setItem(STORAGE.writeDur, String(writeDurationMin));
  }, [writeDurationMin]);
  useEffect(() => {
    localStorage.setItem(STORAGE.isWall, isWall ? "1" : "0");
  }, [isWall]);
  useEffect(() => {
    localStorage.setItem(STORAGE.tagBindings, JSON.stringify(tagBindings));
  }, [tagBindings]);

  return (
    <div className="app-root">
      <Brain
        roomId={roomId}
        myPeerId={peerId}
        mode={mode}
        tagBindings={tagBindings}
        writeDurationMin={writeDurationMin}
        prompt={prompt}
        isWall={isWall}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <button
        type="button"
        className="settings-fab"
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
      >
        ⚙
      </button>

      <div className="self-ref">
        <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
          source
        </a>
        <span aria-hidden="true">·</span>
        <a href={appConfig.paypalUrl} target="_blank" rel="noreferrer">
          tip ♥
        </a>
        <span aria-hidden="true">·</span>
        <span>
          v{appConfig.version} · {appConfig.commit}
        </span>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        roomId={roomId}
        onRoomChange={setRoomId}
        mode={mode}
        onModeChange={setMode}
        prompt={prompt}
        onPromptChange={setPrompt}
        writeDurationMin={writeDurationMin}
        onWriteDurationMinChange={setWriteDurationMin}
        isWall={isWall}
        onIsWallChange={setIsWall}
        tagBindings={tagBindings}
        onTagBindingsChange={setTagBindings}
      />
    </div>
  );
}
