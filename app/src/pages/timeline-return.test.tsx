import { afterEach, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithStore } from "../test/renderWithStore";
import { aSymptom } from "../test/factories";
import TimelinePage from "./TimelinePage";

afterEach(() => {
  window.location.hash = "";
});

it("shows saved observations even outside the recent range when returning from Today", async () => {
  window.location.hash = "#/timeline/recorded";
  await renderWithStore(<TimelinePage />, {
    symptoms: [aSymptom({ date_time: "2020-01-15T12:00:00", symptom_type: "glare" })],
  });
  expect(screen.getByRole("button", { name: "With my notes" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "All time" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await screen.findByText(/glare/i)).toBeVisible();
  expect(screen.getByText(/patient reported/i)).toBeVisible();
});
