import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import Chart from "./Chart";
import { expectNoA11yViolations } from "../test/axe";
import { seriesFor } from "../lib/trends";
import { anAllData, aMeasurement } from "../test/factories";

const clinicAndHome = anAllData({
  measurements: [
    aMeasurement({
      kind: "visual_acuity",
      value: "6/6",
      unit: undefined,
      eye: "right",
      date: "2026-01-01",
      source_type: "device_measurement",
    }),
    aMeasurement({
      kind: "visual_acuity",
      value: "6/12",
      unit: undefined,
      eye: "right",
      date: "2026-03-01",
      source_type: "patient_reported",
      method: "home_screen_test",
    }),
  ],
});

describe("Chart", () => {
  it("renders the same readings as a table, not only as a picture", () => {
    render(<Chart series={seriesFor(clinicAndHome, "visual_acuity", "right")} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("6/6")).toBeInTheDocument();
    expect(within(table).getByText("6/12")).toBeInTheDocument();
  });

  it("says how each reading was taken, in the table", () => {
    render(<Chart series={seriesFor(clinicAndHome, "visual_acuity", "right")} />);
    expect(screen.getByText(/Measured at a clinic/)).toBeInTheDocument();
    expect(screen.getByText(/Check done at home/)).toBeInTheDocument();
  });

  it("does not join clinic and home readings into one line, and says so", () => {
    render(<Chart series={seriesFor(clinicAndHome, "visual_acuity", "right")} />);
    expect(screen.getByText(/not the same kind of measurement/i)).toBeInTheDocument();
  });

  it("describes itself for a screen reader", () => {
    render(<Chart series={seriesFor(clinicAndHome, "visual_acuity", "right")} />);
    const figure = screen.getByRole("img");
    expect(figure).toHaveAccessibleName(/visual acuity/i);
    expect(figure).toHaveAccessibleName(/2 readings/i);
  });

  it("says plainly when nothing can be plotted rather than drawing an empty chart", () => {
    const nonNumeric = anAllData({
      measurements: [
        aMeasurement({ kind: "visual_acuity", value: "HM", unit: undefined, eye: "right" }),
      ],
    });
    render(<Chart series={seriesFor(nonNumeric, "visual_acuity", "right")} />);
    expect(screen.getByText(/not numbers/i)).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Chart series={seriesFor(clinicAndHome, "visual_acuity", "right")} />);
    await expectNoA11yViolations(container);
  });
});
