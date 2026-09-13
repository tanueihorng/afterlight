import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoreProvider, useStore, useTimeline } from "./store";
import { dbClear, dbGetAll } from "./db";
import type { Procedure } from "./models";
import { aProcedure } from "../test/factories";

/**
 * The Timeline inline-add defect class: a modal grabs `store.<entity>` once, calls put() in a
 * click handler, and closes. If put() did not notify the provider, the derived timeline would
 * never re-render and the record would silently vanish on reload. The probe reproduces that
 * exact call shape: the ops object is captured on one render, used from another.
 */
function OpsProbe({ procedure }: { procedure: Procedure }) {
  const store = useStore();
  const timeline = useTimeline();
  const captured = store.procedures;
  return (
    <div>
      <ul>
        {timeline.map((e) => (
          <li key={e.id}>{e.title}</li>
        ))}
      </ul>
      {/* The app renders no interactive UI before the provider is ready (the shell shows a
          loading screen), so the modal could never call put() earlier than this gate. */}
      <button disabled={!store.ready} onClick={() => captured.put(procedure)}>put</button>
      <button disabled={!store.ready} onClick={() => captured.del(procedure.id)}>del</button>
      <span data-testid="list-count">{store.procedures.list.length}</span>
    </div>
  );
}

describe("store ops reactivity", () => {
  it("a put() from a captured ops object reaches the derived timeline, the list, and IndexedDB", async () => {
    const user = userEvent.setup();
    for (const store of ["procedures"] as const) await dbClear(store);
    const rec = aProcedure({ procedure_type: "Reactivity probe" });
    render(
      <StoreProvider>
        <OpsProbe procedure={rec} />
      </StoreProvider>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "put" })).toBeEnabled());

    await user.click(screen.getByRole("button", { name: "put" }));

    await waitFor(() => expect(screen.getByTestId("list-count").textContent).toBe("1"));
    expect(screen.getByText("Reactivity probe")).toBeTruthy();
    const stored = await dbGetAll<Procedure>("procedures");
    expect(stored.map((p) => p.id)).toContain(rec.id);
  });

  it("a del() from a captured ops object removes it from all three places", async () => {
    const user = userEvent.setup();
    for (const store of ["procedures"] as const) await dbClear(store);
    const rec = aProcedure({ procedure_type: "Reactivity probe" });
    render(
      <StoreProvider>
        <OpsProbe procedure={rec} />
      </StoreProvider>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "put" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "put" }));
    await waitFor(() => expect(screen.getByTestId("list-count").textContent).toBe("1"));

    await user.click(screen.getByRole("button", { name: "del" }));

    await waitFor(() => expect(screen.getByTestId("list-count").textContent).toBe("0"));
    expect(screen.queryByText("Reactivity probe")).toBeNull();
    const stored = await dbGetAll<Procedure>("procedures");
    expect(stored.map((p) => p.id)).not.toContain(rec.id);
  });
});
