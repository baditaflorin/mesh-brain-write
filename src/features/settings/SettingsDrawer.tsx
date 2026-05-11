import { useEffect, useState } from "react";
import {
  loadSignalingUrl,
  loadTurnTokenUrl,
  resetIceServers,
  saveSignalingUrl,
  saveTurnTokenUrl,
} from "../sync/iceConfig";
import { appConfig } from "../../shared/config";
import type { Mode } from "../brain/Brain";

type Props = {
  open: boolean;
  onClose: () => void;
  roomId: string;
  onRoomChange: (next: string) => void;
  mode: Mode;
  onModeChange: (next: Mode) => void;
  prompt: string;
  onPromptChange: (next: string) => void;
  writeDurationMin: number;
  onWriteDurationMinChange: (next: number) => void;
  isWall: boolean;
  onIsWallChange: (next: boolean) => void;
  tagBindings: Record<number, 1 | 2 | 3>;
  onTagBindingsChange: (next: Record<number, 1 | 2 | 3>) => void;
};

export function SettingsDrawer({
  open,
  onClose,
  roomId,
  onRoomChange,
  mode,
  onModeChange,
  prompt,
  onPromptChange,
  writeDurationMin,
  onWriteDurationMinChange,
  isWall,
  onIsWallChange,
  tagBindings,
  onTagBindingsChange,
}: Props) {
  const [signaling, setSignaling] = useState(loadSignalingUrl());
  const [tokenUrl, setTokenUrl] = useState(loadTurnTokenUrl());
  const [newTagId, setNewTagId] = useState("");
  const [newSlot, setNewSlot] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (open) {
      setSignaling(loadSignalingUrl());
      setTokenUrl(loadTurnTokenUrl());
    }
  }, [open]);

  if (!open) return null;

  const baseUrl = import.meta.env.BASE_URL;

  const addBinding = () => {
    const id = Number(newTagId);
    if (!Number.isFinite(id) || id < 0 || id > 249) return;
    onTagBindingsChange({ ...tagBindings, [id]: newSlot });
    setNewTagId("");
  };

  const removeBinding = (id: number) => {
    const next = { ...tagBindings };
    delete next[id];
    onTagBindingsChange(next);
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-drawer" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <label>
          <span>Room ID</span>
          <input value={roomId} onChange={(e) => onRoomChange(e.target.value)} />
        </label>

        <label>
          <span>Prompt</span>
          <input value={prompt} onChange={(e) => onPromptChange(e.target.value)} />
        </label>

        <label>
          <span>Write duration (minutes)</span>
          <input
            type="number"
            min={1}
            max={30}
            value={writeDurationMin}
            onChange={(e) => onWriteDurationMinChange(Math.max(1, Number(e.target.value) || 5))}
          />
        </label>

        <label>
          <span>Publish mode</span>
          <select value={mode} onChange={(e) => onModeChange(e.target.value as Mode)}>
            <option value="tap">Tap (release all my ideas)</option>
            <option value="apriltag">ArUco (camera scans tagged cards)</option>
          </select>
        </label>

        <label className="brain-check">
          <input
            type="checkbox"
            checked={isWall}
            onChange={(e) => onIsWallChange(e.target.checked)}
          />
          <span>This phone is the wall display (camera + projected board)</span>
        </label>

        <h3>Tag → idea slot bindings</h3>
        <p className="settings-help">
          Bind each printed tag to one of your three idea slots. Example: tag 10 → slot 1 means
          "holding tag 10 publishes idea 1." Tags can be reused per peer because each peer's pending
          slots are stored under their own peer ID.
        </p>

        <ul className="brain-bindings">
          {Object.entries(tagBindings)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([id, slot]) => (
              <li key={id} className="brain-binding-row">
                <span>
                  tag <code>{id}</code> → slot <code>{slot}</code>
                </span>
                <button type="button" onClick={() => removeBinding(Number(id))}>
                  remove
                </button>
              </li>
            ))}
        </ul>

        <div className="brain-binding-add">
          <input
            type="number"
            min={0}
            max={249}
            value={newTagId}
            onChange={(e) => setNewTagId(e.target.value)}
            placeholder="tag id"
          />
          <select value={newSlot} onChange={(e) => setNewSlot(Number(e.target.value) as 1 | 2 | 3)}>
            <option value={1}>slot 1</option>
            <option value={2}>slot 2</option>
            <option value={3}>slot 3</option>
          </select>
          <button type="button" onClick={addBinding} disabled={!newTagId}>
            add
          </button>
        </div>

        <a
          className="brain-pdf-link"
          href={`${baseUrl}marker-sheet.pdf`}
          target="_blank"
          rel="noreferrer"
        >
          Download printable marker sheet (PDF)
        </a>

        <hr />

        <h3>Self-hosted infra (advanced)</h3>
        <p className="settings-help">
          Override the default signaling and TURN endpoints. Leave blank to use the built-in
          defaults (<code>{appConfig.signalingUrl}</code> and <code>{appConfig.turnTokenUrl}</code>
          ).
        </p>

        <label>
          <span>Signaling URL</span>
          <input
            value={signaling}
            onChange={(e) => setSignaling(e.target.value)}
            placeholder={appConfig.signalingUrl}
          />
        </label>

        <label>
          <span>TURN credentials URL</span>
          <input
            value={tokenUrl}
            onChange={(e) => setTokenUrl(e.target.value)}
            placeholder={appConfig.turnTokenUrl}
          />
        </label>

        <div className="settings-actions">
          <button
            type="button"
            onClick={() => {
              saveSignalingUrl(signaling);
              saveTurnTokenUrl(tokenUrl);
              onClose();
              location.reload();
            }}
          >
            Save and reload
          </button>
          <button
            type="button"
            onClick={() => {
              saveSignalingUrl("");
              saveTurnTokenUrl("");
              resetIceServers();
              onClose();
              location.reload();
            }}
          >
            Reset to defaults
          </button>
        </div>

        <hr />

        <footer className="settings-footer">
          <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
            source on github
          </a>
          <span>
            v{appConfig.version} · {appConfig.commit}
          </span>
        </footer>
      </div>
    </div>
  );
}
