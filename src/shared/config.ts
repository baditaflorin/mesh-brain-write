export const appConfig = {
  appName: "mesh-brain-write",
  storagePrefix: "mesh-brain-write",
  description:
    "Peer-to-peer mesh: silent brainstorm. Type ideas privately on a timer; pooled anonymously. ArUco mode for paper ideas.",
  accentHex: "#8fb8ff",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
  repositoryUrl: "https://github.com/baditaflorin/mesh-brain-write",
  pagesUrl: "https://baditaflorin.github.io/mesh-brain-write/",
  signalingUrl:
    (import.meta.env.VITE_WEBRTC_SIGNALING as string | undefined) ?? "wss://turn.0docker.com/ws",
  turnTokenUrl:
    (import.meta.env.VITE_TURN_TOKEN_URL as string | undefined) ??
    "https://turn.0docker.com/credentials",
  paypalUrl: "https://www.paypal.com/paypalme/florinbadita",
} as const;
