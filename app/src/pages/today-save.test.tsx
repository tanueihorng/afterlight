import { expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithStore } from "../test/renderWithStore";
import { aDailyLog, aSymptom } from "../test/factories";
import { loadAllData } from "../lib/db";
import { useStore } from "../lib/store";
import { todayLocal } from "../lib/util";
import Today from "./Today";

const today = todayLocal();

/** The app mounts Today only once the record has loaded; so does this test. */
function Ready() {
  return useStore().ready ? <Today /> : <p>Loading</p>;
}

it("keeps a saved symptom the form cannot fully show — no comparison, both eyes — on update", async () => {
  const imported = aSymptom({
    date_time: `${today}T08:00:00`,
    eye: "both",
    symptom_type: "glare",
    status: "new",
    description: "From an imported record",
  });
  await renderWithStore(<Ready />, {
    symptoms: [imported],
    dailyLogs: [aDailyLog({ id: today, date: today, overall: "recorded" })],
  });

  await userEvent.click(await screen.findByRole("button", { name: /update today's record/i }));
  await screen.findByText(/today is recorded/i);

  const stored = (await loadAllData()).symptoms.find((s) => s.id === imported.id);
  expect(stored).toBeDefined();
  expect(stored).toMatchObject({ eye: "both", status: "new", description: "From an imported record" });
});

it("says what a save removed, and puts it back in one tap", async () => {
  const glare = aSymptom({ date_time: `${today}T08:00:00`, eye: "left", symptom_type: "glare" });
  await renderWithStore(<Ready />, {
    symptoms: [{ ...glare, baseline_comparison: "same_as_usual" }],
    dailyLogs: [aDailyLog({ id: today, date: today, overall: "recorded" })],
  });

  await userEvent.click(await screen.findByRole("button", { name: /remove symptom/i }));
  await userEvent.click(screen.getByRole("button", { name: /update today's record/i }));
  expect(await screen.findByText(/removed from today: glare, left eye/i)).toBeVisible();
  await waitFor(async () =>
    expect((await loadAllData()).symptoms.some((s) => s.id === glare.id)).toBe(false),
  );

  await userEvent.click(screen.getByRole("button", { name: /put it back/i }));
  await waitFor(async () => {
    const data = await loadAllData();
    expect(data.symptoms.find((s) => s.id === glare.id)?.date_time).toBe(glare.date_time);
    expect(data.dailyLogs.find((l) => l.date === today)?.overall).toBe("recorded");
  });
});
