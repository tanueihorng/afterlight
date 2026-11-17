import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithStore } from "../test/renderWithStore";
import { expectNoA11yViolations } from "../test/axe";
import EyeDashboard from "./EyeDashboard";
import { aMeasurement, aMedication, aProcedure } from "../test/factories";

const iop = (date: string, value: string, over = {}) =>
  aMeasurement({ date, value, kind: "iop", unit: "mmHg", eye: "right", ...over });

const seed = {
  measurements: [
    iop("2026-01-01", "14"),
    iop("2026-04-01", "24"),
    iop("2026-07-01", "19"),
    aMeasurement({ kind: "visual_acuity", value: "6/9", date: "2026-07-01", eye: "left" }),
  ],
  procedures: [aProcedure({ procedure_type: "vitrectomy", date: "2026-03-10", eye: "right" })],
  medications: [aMedication({ name: "Timolol", eye: "left", start_date: "2026-02-01" })],
};

describe("My Eyes dashboard", () => {
  it("shows a card per measurement, with the latest placed among the person's own readings", async () => {
    const { container } = await renderWithStore(<EyeDashboard />, seed);
    const cards = screen.getByRole("list", { name: /measurements, right eye/i });
    const iopCard = within(cards).getByRole("button", { name: /intraocular pressure/i });
    expect(iopCard).toHaveTextContent("19 mmHg");
    expect(
      within(iopCard).getByRole("img", { name: /latest 19 mmHg\. the bar's ends are your own readings 14 mmHg on the left and 24 mmHg on the right/i }),
    ).toBeInTheDocument();
    // Acuity was only recorded for the left eye: the right says so, and is not a button.
    expect(within(cards).queryByRole("button", { name: /visual acuity/i })).toBeNull();
    expect(within(cards).getByText("Not recorded")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("lists the treatments within the chart's dates, for the chosen eye only", async () => {
    await renderWithStore(<EyeDashboard />, seed);
    const events = screen.getByRole("heading", { name: "Treatment dates in this period" }).parentElement!;
    expect(within(events).getByText("Vitrectomy")).toBeInTheDocument();
    expect(within(events).queryByText(/Timolol/)).toBeNull();
  });

  it("switches eye, and never grades a reading in words", async () => {
    const user = userEvent.setup();
    const { container } = await renderWithStore(<EyeDashboard />, seed);
    await user.click(screen.getByRole("button", { name: "Left eye" }));
    expect(screen.getByRole("button", { name: "Left eye" })).toHaveAttribute("aria-pressed", "true");
    const card = screen.getByRole("button", { name: /^visual acuity 6\/9.* 1 jul 2026$/i });
    expect(card).toHaveAttribute("aria-current", "true");
    expect(card).toHaveTextContent("Showing");
    expect(document.getElementById(card.getAttribute("aria-controls")!)).toHaveRole("region");
    // The one sentence allowed to name a verdict is the one saying the bars are not one.
    const fine = container.querySelector(".eyedash > .eyedash-fine")!.textContent!;
    const text = container.textContent!.replace(fine, "");
    expect(text).not.toMatch(/\b(normal|abnormal|high|low|borderline|optimal|good|bad|risk)\b/i);
  });

  it("does not call a waiting transcription 'Not recorded'", async () => {
    await renderWithStore(<EyeDashboard />, {
      measurements: [
        iop("2026-01-01", "14", { eye: "left" }),
        iop("2026-02-01", "15", { source_type: "document_extracted", confirmed: false }),
      ],
    });
    expect(screen.getByText("Read from a document, not checked yet")).toBeInTheDocument();
  });

  it("mentions a waiting transcription beside a checked latest value, and labels a home check", async () => {
    await renderWithStore(<EyeDashboard />, {
      measurements: [
        iop("2026-01-01", "14"),
        iop("2026-02-01", "15", { source_type: "document_extracted", confirmed: false }),
        aMeasurement({ kind: "visual_acuity", value: "6/9", date: "2026-03-01", eye: "right", source_type: "patient_reported", method: "home_screen_test" }),
      ],
    });
    expect(screen.getAllByText("Also 1 read from a document, not checked yet").length).toBeGreaterThan(0);
    expect(document.querySelector(".measure .measure-how")).toHaveTextContent(/Home screen test — not a clinical measurement/);
  });

  it("is absent when nothing about the eyes has been measured", async () => {
    // The helper waits for text to appear, so give it something beside the dashboard to show.
    const { container } = await renderWithStore(
      <>
        <p>Page</p>
        <EyeDashboard />
      </>,
      { measurements: [aMeasurement({ kind: "hba1c", value: "48", eye: "not_applicable" })] },
    );
    expect(container.querySelector(".eyedash")).toBeNull();
  });
});
