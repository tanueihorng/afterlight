import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);

// jsdom has no canvas backend; the drawing renderer only needs the calls not to throw.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: { ...globalThis.crypto, randomUUID: () => `test-${Math.random().toString(36).slice(2)}` },
  });
}
