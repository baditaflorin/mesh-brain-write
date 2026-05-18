import { useEffect, useState } from "react";
import { MeshShell } from "@baditaflorin/mesh-common";
import { Brain, type Mode } from "./features/brain/Brain";
import { SettingsExtras } from "./features/settings/SettingsExtras";
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

/** Programmatically open MeshShell's settings drawer by clicking its FAB. */
function openMeshSettings() {
  const fab = document.querySelector<HTMLButtonElement>(".mesh-settings-fab");
  fab?.click();
}

export function App() {
  const [roomId, setRoomId] = useState(() => readString(STORAGE.room, "default"));
  const [mode, setMode] = useState<Mode>(() => (readString(STORAGE.mode, "tap") as Mode) || "tap");
  const [prompt, setPrompt] = useState(() => readString(STORAGE.prompt, DEFAULT_PROMPT));
  const [writeDurationMin, setWriteDurationMin] = useState(() => readNumber(STORAGE.writeDur, 5));
  const [isWall, setIsWall] = useState(() => readBool(STORAGE.isWall, false));
  const [tagBindings, setTagBindings] = useState<Record<number, 1 | 2 | 3>>(() => readBindings());

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
    <MeshShell
      config={appConfig}
      roomId={roomId}
      onRoomChange={setRoomId}
      settingsExtras={
        <SettingsExtras
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
      }
    >
      <Brain
        roomId={roomId}
        myPeerId={peerId}
        mode={mode}
        tagBindings={tagBindings}
        writeDurationMin={writeDurationMin}
        prompt={prompt}
        isWall={isWall}
        onOpenSettings={openMeshSettings}
      />
    </MeshShell>
  );
}
