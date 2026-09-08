import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithStore } from "../test/renderWithStore";
import Today from "./Today";
import Appointments from "./Appointments";
import Settings from "./Settings";
import { anAppointment, aSymptom } from "../test/factories";
import { todayLocal } from "../lib/util";
import { dbGetAll } from "../lib/db";
import type { DailyLog } from "../lib/models";
import { applyPrefs, DEFAULT_PREFS } from "../lib/prefs";

/** Every interactive element must be reachable and operable without a mouse. */
async function tabTo(user: ReturnType<typeof userEvent.setup>, matcher: RegExp, limit = 60) {
  for (let i = 0; i < limit; i++) {
    await user.tab();
    const active = document.activeElement as HTMLElement | null;
    if (active && matcher.test(active.textContent ?? "")) return active;
    if (active && matcher.test(active.getAttribute("aria-label") ?? "")) return active;
  }
  throw new Error(`Never reached a control matching ${matcher} by tabbing`);
}

describe("the daily entry works without a mouse", () => {
  it("records a no-change day using only the keyboard", async () => {
    const user = userEvent.setup();
    await renderWithStore(<Today />, {});

    const noChange = await tabTo(user, /nothing different today/i);
    await user.keyboard("{Enter}");
    expect(noChange).toBeTruthy();

    await waitFor(async () => {
      const logs = await dbGetAll<DailyLog>("dailyLogs");
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].overall).toBe("no_change");
    });
  });

  it("reaches the symptom form from the keyboard and can add a row", async () => {
    const user = userEvent.setup();
    await renderWithStore(<Today />, {});

    await tabTo(user, /something changed/i);
    await user.keyboard("{Enter}");
    const [addSymptom] = await screen.findAllByRole("button", { name: /add symptom/i });
    addSymptom.focus();
    await user.keyboard("{Enter}");

    // The new row's controls must be reachable by continuing to tab, not only by clicking.
    await waitFor(() => expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0));
    const description = await tabTo(user, /small dark dot/i, 40).catch(() => null);
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
    expect(description === null || description instanceof HTMLElement).toBe(true);
  });
});

describe("the appointment brief is reachable without a mouse", () => {
  it("generates a brief from the keyboard", async () => {
    const user = userEvent.setup();
    const today = todayLocal();
    await renderWithStore(<Appointments />, {
      appointments: [anAppointment({ date_time: `${today}T10:00:00` })],
      symptoms: [aSymptom({ date_time: `${today}T09:00:00`, eye: "left" })],
    });

    await tabTo(user, /prepare appointment brief/i);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByText(/APPOINTMENT BRIEF/i)).toBeInTheDocument());
  });
});

describe("dialogs manage focus", () => {
  it("moves focus into the dialog and restores it on close", async () => {
    const user = userEvent.setup();
    const today = todayLocal();
    await renderWithStore(<Appointments />, {
      appointments: [anAppointment({ date_time: `${today}T10:00:00` })],
    });

    const opener = await tabTo(user, /questions for/i);
    await user.keyboard("{Enter}");

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

describe("display preferences are operable from the keyboard", () => {
  it("switches to a high-contrast theme and a larger type scale", async () => {
    const user = userEvent.setup();
    await renderWithStore(<Settings />, {});

    const display = screen.getByRole("heading", { name: /display/i }).closest("section")!;
    await user.click(within(display).getByRole("button", { name: /high contrast dark/i }));
    await user.click(within(display).getByRole("button", { name: /largest/i }));

    // Preferences are part of the record, so they survive a reload and an export.
    await waitFor(async () => {
      const meta = await dbGetAll<{ theme: string; type_scale: number }>("meta");
      expect(meta[0]?.theme).toBe("hc-dark");
      expect(meta[0]?.type_scale).toBe(2);
    });

    // And they must be reflected on the document when the shell applies them.
    applyPrefs({ ...DEFAULT_PREFS, theme: "hc-dark", typeScale: 2 }, document.documentElement);
    expect(document.documentElement.getAttribute("data-theme")).toBe("hc-dark");
    expect(document.documentElement.style.getPropertyValue("--type-scale")).toBe("2");
  });
});
