import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithStore } from "../test/renderWithStore";
import { todayLocal } from "../lib/util";
import Today from "./Today";
import TimelinePage from "./TimelinePage";
import MyEyes from "./MyEyes";
import Imaging from "./Imaging";
import Appointments from "./Appointments";
import Settings from "./Settings";
import Visualize from "./Visualize";
import {
  aBaseline,
  aDiagnosis,
  aDocument,
  aDrawing,
  aFloater,
  aMeasurement,
  aMedication,
  anAppointment,
  anImaging,
  aPrescription,
  aProcedure,
  aQuestion,
  aSymptom,
} from "../test/factories";

const populated = {
  symptoms: [aSymptom({ eye: "left" }), aSymptom({ eye: "right", status: "worse" })],
  drawings: [aDrawing()],
  floaters: [aFloater()],
  appointments: [anAppointment()],
  questions: [aQuestion()],
  diagnoses: [aDiagnosis()],
  procedures: [aProcedure()],
  medications: [aMedication()],
  prescriptions: [aPrescription()],
  measurements: [aMeasurement()],
  imaging: [anImaging()],
  documents: [aDocument()],
  baselines: [aBaseline()],
};

const pages: [string, () => JSX.Element][] = [
  ["Today", Today],
  ["Timeline", TimelinePage],
  ["My Eyes", MyEyes],
  ["Imaging", Imaging],
  ["Appointments", Appointments],
  ["Settings", Settings],
  ["Visualize", Visualize],
];

describe("every page renders against a populated record", () => {
  for (const [name, Page] of pages) {
    it(`${name} renders`, async () => {
      await renderWithStore(<Page />, populated);
      await waitFor(() => expect(screen.getAllByRole("heading").length).toBeGreaterThan(0));
    });
  }
});

describe("every page renders against an empty record", () => {
  // The empty case is the one that breaks in practice, and the one a new user sees first.
  for (const [name, Page] of pages) {
    it(`${name} renders with nothing stored`, async () => {
      await renderWithStore(<Page />, {});
      await waitFor(() => expect(screen.getAllByRole("heading").length).toBeGreaterThan(0));
    });
  }
});

describe("Today", () => {
  it("asks the daily question and offers the no-change answer", async () => {
    await renderWithStore(<Today />, {});
    expect(
      await screen.findByRole("button", { name: /nothing different today/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /something changed/i })).toBeInTheDocument();
  });
});

describe("Timeline", () => {
  it("labels events with their source rather than blending them", async () => {
    // The timeline defaults to a recent window, so date these to today.
    const today = todayLocal();
    await renderWithStore(<TimelinePage />, {
      symptoms: [aSymptom({ eye: "left", date_time: `${today}T09:00:00` })],
      imaging: [anImaging({ source_type: "clinician_reported", date: today })],
    });
    await waitFor(() => {
      expect(screen.getAllByText(/patient reported/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/device measurement|clinician documented/i).length).toBeGreaterThan(0);
    });
  });
});
