import { describe, expect, it } from "vitest";
import { renderWithStore } from "../test/renderWithStore";
import Today from "./Today";
import MyEyes from "./MyEyes";
import Appointments from "./Appointments";
import Imaging from "./Imaging";
import Settings from "./Settings";
import { aDiagnosis, anAppointment, anImaging, aSymptom } from "../test/factories";

/**
 * jsdom has no layout, so this checks the declared minimum rather than the painted box: no
 * interactive control may declare a height smaller than the target token. It catches the pattern
 * that caused the problem — inline `minHeight: 28` on secondary buttons.
 */
const TOO_SMALL = /^(\d+(\.\d+)?)px$/;

function undersizedControls(container: HTMLElement): string[] {
  const problems: string[] = [];
  for (const el of container.querySelectorAll<HTMLElement>("button, a[href], summary")) {
    if (el.classList.contains("backdrop-dismiss")) continue;
    const declared = el.style.minHeight || el.style.height;
    const match = declared.match(TOO_SMALL);
    if (match && Number(match[1]) < 44) {
      problems.push(`${el.textContent?.trim().slice(0, 40)} declares ${declared}`);
    }
  }
  return problems;
}

const seed = {
  symptoms: [aSymptom()],
  diagnoses: [aDiagnosis()],
  appointments: [anAppointment()],
  imaging: [anImaging()],
};

const pages: [string, () => JSX.Element][] = [
  ["Today", Today],
  ["My Eyes", MyEyes],
  ["Appointments", Appointments],
  ["Imaging", Imaging],
  ["Settings", Settings],
];

describe("no control is smaller than the minimum target", () => {
  for (const [name, Page] of pages) {
    it(name, async () => {
      const { container } = await renderWithStore(<Page />, seed);
      expect(undersizedControls(container)).toEqual([]);
    });
  }
});
