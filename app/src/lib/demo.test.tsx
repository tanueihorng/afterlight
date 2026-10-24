import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoreProvider, useStore } from "./store";
import { STORES, dbClear, dbGetAll, dbPut } from "./db";
import { SCHEMA_VERSION } from "./migrations";
import type { EyeBaseline } from "./models";
import { removeDemoData, seedDemo } from "./demo";

// The test environment has no canvas; demo drawings only need some thumbnail to store.
vi.mock("./render", async (original) => ({
  ...(await original<typeof import("./render")>()),
  drawingToDataURL: () => "data:image/png;base64,",
}));

// Demo data also paints sample scans. A context that accepts every call is enough here: these
// tests are about which records are written and removed, not about the pictures.
const noopContext = new Proxy({}, { get: () => () => ({ addColorStop: () => {} }), set: () => true });
HTMLCanvasElement.prototype.getContext = (() => noopContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
  cb(new Blob([new Uint8Array([1])], { type: "image/png" }));
};

function DemoProbe() {
  const store = useStore();
  return (
    <div>
      <button disabled={!store.ready} onClick={() => seedDemo(store)}>load demo</button>
      <button disabled={!store.ready} onClick={() => removeDemoData(store)}>remove demo</button>
    </div>
  );
}

const mine: EyeBaseline = {
  id: "right",
  text: "Two faint dots, a little glare at night. My own words.",
  established_date: "2026-01-10",
  revisions: [{ date: "2026-01-10", text: "Written at set-up." }],
  updated_at: "2026-01-10T09:00:00Z",
};

const baselines = async () => new Map((await dbGetAll<EyeBaseline>("baselines")).map((b) => [b.id, b]));

describe("demo data never touches the person's own baseline", () => {
  it("leaves a real baseline in place when loaded, and in place when removed", async () => {
    // Baselines have one fixed id per eye, so a demo baseline could only exist by overwriting
    // the person's own — and "Remove demo data" would then delete the original for good.
    for (const s of STORES) await dbClear(s);
    await dbPut("baselines", mine);
    await dbPut("meta", { id: "meta", onboarded: true, theme: "dark", demo_seeded: false, schema_version: SCHEMA_VERSION });
    render(
      <StoreProvider>
        <DemoProbe />
      </StoreProvider>,
    );
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("button", { name: "load demo" })).toBeEnabled());

    await user.click(screen.getByRole("button", { name: "load demo" }));
    await waitFor(async () => expect((await dbGetAll<{ demo_seeded: boolean }>("meta"))[0].demo_seeded).toBe(true), { timeout: 10_000 });
    expect((await baselines()).get("left")?.demo).toBe(true);
    expect((await baselines()).get("right")).toEqual(mine);

    await user.click(screen.getByRole("button", { name: "remove demo" }));
    await waitFor(async () => expect((await dbGetAll<{ demo_seeded: boolean }>("meta"))[0].demo_seeded).toBe(false), { timeout: 10_000 });
    expect((await baselines()).has("left")).toBe(false);
    expect((await baselines()).get("right")).toEqual(mine);
  }, 30_000);
});
