import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithStore } from "../test/renderWithStore";
import { expectNoA11yViolations } from "../test/axe";
import { applyPrefs, DEFAULT_PREFS, THEMES, type ThemeId } from "../lib/prefs";
import Today from "./Today";
import TimelinePage from "./TimelinePage";
import MyEyes from "./MyEyes";
import Imaging from "./Imaging";
import Appointments from "./Appointments";
import Settings from "./Settings";
import Visualize from "./Visualize";
import WhatISee from "./WhatISee";
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
import { todayLocal } from "../lib/util";

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
  ["What I See", WhatISee],
  ["Timeline", TimelinePage],
  ["My Eyes", MyEyes],
  ["Imaging", Imaging],
  ["Appointments", Appointments],
  ["Settings", Settings],
  ["Visualize", Visualize],
];

describe("every page is free of axe violations", () => {
  for (const [name, Page] of pages) {
    it(`${name}, with records`, async () => {
      const { container } = await renderWithStore(<Page />, populated);
      await expectNoA11yViolations(container);
    });

    it(`${name}, empty`, async () => {
      const { container } = await renderWithStore(<Page />, {});
      await expectNoA11yViolations(container);
    });
  }
});

describe("every theme and type scale is free of axe violations", () => {
  for (const theme of THEMES) {
    it(`Today in ${theme.label} at the largest text size`, async () => {
      applyPrefs({ ...DEFAULT_PREFS, theme: theme.id as ThemeId, typeScale: 2 }, document.documentElement);
      const { container } = await renderWithStore(<Today />, populated);
      await expectNoA11yViolations(container);
      applyPrefs(DEFAULT_PREFS, document.documentElement);
    });
  }
});

describe("modals are free of axe violations", () => {
  it("the symptom entry flow", async () => {
    const { container } = await renderWithStore(<Today />, {});
    const [addSymptom] = await screen.findAllByRole("button", { name: /add symptom/i });
    await userEvent.click(addSymptom);
    await expectNoA11yViolations(container);
  });

  it("the appointment brief", async () => {
    const today = todayLocal();
    const { container } = await renderWithStore(<Appointments />, {
      appointments: [anAppointment({ date_time: `${today}T10:00:00` })],
      symptoms: [aSymptom({ date_time: `${today}T09:00:00` })],
    });
    await userEvent.click(await screen.findByRole("button", { name: /prepare appointment brief/i }));
    await waitFor(() => expect(screen.getByText(/APPOINTMENT BRIEF/i)).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});
