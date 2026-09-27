/**
 * server/playwright/screenshotStream.ts
 * WebSocket screenshot streaming — sends live browser screenshots
 * to the React UI at configurable FPS for the browser view panel.
 */
import { browserManager } from "./browserManager";

type BroadcastFn = (type: string, payload: unknown) => void;

class ScreenshotStreamManager {
  private _interval: NodeJS.Timeout | null = null;
  private _callback: ((screenshot: string) => void) | null = null;
  private _broadcast: BroadcastFn | null = null;
  private _fps = 2; // 2 frames per second (Termux-safe)

  setBroadcast(fn: BroadcastFn): void {
    this._broadcast = fn;
  }

  startStream(callback?: (screenshot: string) => void): void {
    if (this._interval) return;
    this._callback = callback ?? null;
    this._interval = setInterval(async () => {
      try {
        if (!browserManager.isStarted()) return;
        const screenshot = await browserManager.screenshot(false);
        if (this._callback)   this._callback(screenshot);
        if (this._broadcast)  this._broadcast("playwright:screenshot", { screenshot });
      } catch { /* Browser may be navigating */ }
    }, Math.floor(1000 / this._fps));
    console.log(`[screenshot_stream] Started at ${this._fps}fps`);
  }

  stopStream(): void {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
      console.log("[screenshot_stream] Stopped.");
    }
  }

  setFps(fps: number): void {
    this._fps = Math.max(1, Math.min(10, fps));
    if (this._interval) {
      this.stopStream();
      this.startStream(this._callback ?? undefined);
    }
  }
}

export const broadcastManager = new ScreenshotStreamManager();
