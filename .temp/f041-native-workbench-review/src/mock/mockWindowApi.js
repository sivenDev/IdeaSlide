const supportedPlatforms = new Set(["macos", "windows", "browser"]);

export function windowChromeInsets({ platform = "macos", fullscreen = false } = {}) {
  if (fullscreen) return { left: 0, right: 0, trafficLights: false };
  if (platform === "macos") return { left: 72, right: 0, trafficLights: true };
  if (platform === "windows") return { left: 0, right: 138, trafficLights: false };
  return { left: 0, right: 0, trafficLights: false };
}

function initialWindowState() {
  if (typeof window === "undefined") return { platform: "macos", fullscreen: false };
  const params = new URLSearchParams(window.location.search);
  const requestedPlatform = params.get("platform");
  return {
    platform: supportedPlatforms.has(requestedPlatform) ? requestedPlatform : "macos",
    fullscreen: params.get("fullscreen") === "1",
  };
}

export class MockWindowApi {
  constructor(state = initialWindowState()) {
    this.state = { platform: supportedPlatforms.has(state.platform) ? state.platform : "browser", fullscreen: Boolean(state.fullscreen) };
    this.listeners = new Set();
  }

  getState() { return { ...this.state }; }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  setPlatform(platform) {
    if (!supportedPlatforms.has(platform) || platform === this.state.platform) return this.getState();
    this.state = { ...this.state, platform };
    this.emit();
    return this.getState();
  }

  setFullscreen(fullscreen) {
    const next = Boolean(fullscreen);
    if (next === this.state.fullscreen) return this.getState();
    this.state = { ...this.state, fullscreen: next };
    this.emit();
    return this.getState();
  }

  toggleFullscreen() { return this.setFullscreen(!this.state.fullscreen); }
}

export const mockWindowApi = new MockWindowApi();
