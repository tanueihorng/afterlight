import { afterEach, expect, it } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithStore } from "../test/renderWithStore";
import { aSymptom } from "../test/factories";
import { loadAllData } from "../lib/db";
import TimelinePage from "./TimelinePage";
import Imaging from "./Imaging";

afterEach(() => {
  sessionStorage.clear();
  window.location.hash = "";
});

it("the timeline keeps the lens and range someone chose when they come back to it", async () => {
  const seed = { symptoms: [aSymptom({ date_time: "2020-01-15T12:00:00", symptom_type: "glare" })] };
  await renderWithStore(<TimelinePage />, seed);
  await userEvent.click(screen.getByRole("button", { name: "With my notes" }));
  await userEvent.click(screen.getByRole("button", { name: "All time" }));
  cleanup();

  await renderWithStore(<TimelinePage />, seed);
  expect(screen.getByRole("button", { name: "With my notes" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "All time" })).toHaveAttribute("aria-pressed", "true");
  expect(await screen.findByText(/glare/i)).toBeVisible();
});

it("imaging typed in by hand, with no file, is saved as the person's own entry", async () => {
  await renderWithStore(<Imaging />);
  await userEvent.click(screen.getByRole("button", { name: /add one scan, with details/i }));
  await userEvent.type(screen.getByLabelText(/findings as documented/i), "Small epiretinal membrane");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));

  await waitFor(async () => {
    const [rec] = (await loadAllData()).imaging;
    expect(rec?.findings).toBe("Small epiretinal membrane");
    expect(rec?.file_ids).toEqual([]);
    expect(rec?.source_type).toBe("patient_reported");
  });
});

it("imaging with neither a file nor findings says why it was not saved", async () => {
  await renderWithStore(<Imaging />);
  await userEvent.click(screen.getByRole("button", { name: /add one scan, with details/i }));
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/add an image file, or the findings/i);
});
