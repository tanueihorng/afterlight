import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithStore } from "../test/renderWithStore";
import { DiagnosisModal } from "./MyEyes";

describe("DiagnosisModal provenance default", () => {
  it("opens with clinician-confirmed unchecked — a person typing a diagnosis has not had a clinician confirm it", async () => {
    await renderWithStore(<DiagnosisModal onClose={() => {}} />);
    const box = screen.getByRole("checkbox", { name: /confirmed by a clinician/i }) as HTMLInputElement;
    expect(box.checked).toBe(false);
  });
});
