import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithStore } from "../test/renderWithStore";
import MyEyes, { DiagnosisModal } from "./MyEyes";
import { aDocument, aMeasurement } from "../test/factories";

describe("DiagnosisModal provenance default", () => {
  it("opens with clinician-confirmed unchecked — a person typing a diagnosis has not had a clinician confirm it", async () => {
    await renderWithStore(<DiagnosisModal onClose={() => {}} />);
    const box = screen.getByRole("checkbox", { name: /confirmed by a clinician/i }) as HTMLInputElement;
    expect(box.checked).toBe(false);
  });
});

describe("My Eyes document values", () => {
  it("shows transcribed values with their source while leaving the last clinical value missing", async () => {
    await renderWithStore(<MyEyes />, {
      documents: [aDocument({ id: "report", title: "Eye report" })],
      measurements: [aMeasurement({
        eye: "right", kind: "iop", value: "14.6", unit: "mmHg",
        source_type: "document_extracted", confirmed: false, source_document_id: "report",
      })],
    });
    expect(await screen.findByText(/Intraocular pressure: 14.6 mmHg/)).toBeInTheDocument();
    expect(screen.getByText("Source: Eye report")).toBeInTheDocument();
    expect(screen.getByText("Not checked yet")).toBeInTheDocument();
    expect(screen.getAllByText("Not recorded").length).toBeGreaterThan(0);
  });
});
