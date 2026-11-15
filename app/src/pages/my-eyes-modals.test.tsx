import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { dbGetAll } from "../lib/db";
import type { Procedure } from "../lib/models";
import { renderWithStore } from "../test/renderWithStore";
import MyEyes from "./MyEyes";
import { DiagnosisModal, ProcedureModal } from "../components/RecordModals";
import { aDocument, aMeasurement, aProcedure } from "../test/factories";

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

describe("editing a procedure", () => {
  it("corrects the source of a surgery recorded at set-up, keeping the same record", async () => {
    // Surgery entered at set-up before schema 7 was labelled clinician-documented; editing is the
    // only way a person can say it was their own account.
    const told = aProcedure({ id: "prc-1", procedure_type: "Vitrectomy", source_type: "clinician_reported", demo: true });
    await renderWithStore(<MyEyes />, { procedures: [told] });
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole("button", { name: /edit vitrectomy/i }))[0]);
    const dialog = screen.getByRole("dialog", { name: /edit procedure/i });
    await user.selectOptions(within(dialog).getByRole("combobox", { name: /source/i }), "patient_reported");
    await user.click(within(dialog).getByRole("button", { name: /save procedure/i }));

    const stored = await dbGetAll<Procedure>("procedures");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: "prc-1", procedure_type: "Vitrectomy", source_type: "patient_reported" });
    // Typed-over demo data becomes the person's own and survives "remove demo data".
    expect(stored[0].demo).toBeUndefined();
  });

  it("opens empty for a new procedure", async () => {
    await renderWithStore(<ProcedureModal onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: /add procedure/i })).toBeInTheDocument();
  });
});
