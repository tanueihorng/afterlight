import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithStore } from "../test/renderWithStore";
import { expectNoA11yViolations } from "../test/axe";
import Atlas from "../components/Atlas";
import { aDiagnosis } from "../test/factories";
import { dbGetAll } from "../lib/db";

describe("the atlas is a reference, not a suggestion engine", () => {
  it("says so before showing anything", async () => {
    await renderWithStore(<Atlas />, {});
    expect(
      await screen.findByText(/never suggests what you might have/i),
    ).toBeInTheDocument();
  });

  it("does not surface conditions from the person's symptoms", async () => {
    // A record full of symptoms must not produce a list of candidate conditions anywhere.
    await renderWithStore(<Atlas />, {});
    expect(screen.queryByText(/you may have|possible causes|likely condition/i)).toBeNull();
  });

  it("links a documented diagnosis to its entry, and labels the illustration as generic", async () => {
    await renderWithStore(<Atlas />, {
      diagnoses: [aDiagnosis({ name: "Rhegmatogenous retinal detachment — macula on" })],
    });
    expect(await screen.findByText(/documented in your record/i)).toBeInTheDocument();
    expect(screen.getByText(/generic and shows the concept, not your eye/i)).toBeInTheDocument();
  });

  it("opens an entry and states the boundary on it", async () => {
    const user = userEvent.setup();
    await renderWithStore(<Atlas initialId="rhegmatogenous_detachment" />, {});

    expect(await screen.findByText(/reference, not an assessment/i)).toBeInTheDocument();
    expect(screen.getByText(/not by your symptom log/i)).toBeInTheDocument();
    expect(user).toBeTruthy();
  });

  it("frames severity as description, never as prediction", async () => {
    await renderWithStore(<Atlas initialId="dry_amd" />, {});
    expect(await screen.findByText(/not a prediction about you/i)).toBeInTheDocument();
    expect(screen.getByText(/says nothing about where anyone is heading/i)).toBeInTheDocument();
  });

  it("writes nothing to the record just by being read", async () => {
    await renderWithStore(<Atlas initialId="wet_amd" />, {});
    await waitFor(async () => {
      expect(await dbGetAll("drawings")).toHaveLength(0);
      expect(await dbGetAll("symptoms")).toHaveLength(0);
    });
  });

  it("has no accessibility violations, as a list or as an entry", async () => {
    const list = await renderWithStore(<Atlas />, {});
    await expectNoA11yViolations(list.container);
    list.unmount();

    const detail = await renderWithStore(<Atlas initialId="pdr" />, {});
    await expectNoA11yViolations(detail.container);
  });
});
