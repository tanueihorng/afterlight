import type { ReactElement } from "react";
import { expect } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { STORES, dbClear, dbPutMany, type StoreName } from "../lib/db";
import { StoreProvider } from "../lib/store";
import { SCHEMA_VERSION } from "../lib/migrations";
import type { AllData } from "../lib/db";

/** Wipe the database, seed it with the given slices, and render inside a live store. */
export async function renderWithStore(ui: ReactElement, seed: Partial<AllData> = {}) {
  for (const store of STORES) await dbClear(store);
  for (const [key, rows] of Object.entries(seed)) {
    if (Array.isArray(rows) && rows.length) {
      await dbPutMany<unknown>(key as StoreName, rows as unknown[]);
    }
  }
  // A fresh record is already at the current schema; seeding it older would make every render
  // run a migration and race whatever the test does next.
  await dbPutMany("meta", [
    { id: "meta", onboarded: true, theme: "dark", demo_seeded: false, schema_version: SCHEMA_VERSION },
  ]);

  const result = render(<StoreProvider>{ui}</StoreProvider>);
  // The provider loads asynchronously; wait for it to finish before asserting.
  await waitFor(() => expect(document.body.textContent).not.toBe(""));
  return result;
}
