import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithStore } from "../test/renderWithStore";
import SelfTests from "./SelfTests";
import { dbGetAll } from "../lib/db";
import type { SelfTestResult } from "../lib/models";

describe("self-tests are framed as self-comparison, never as measurement", () => {
  it("states the boundary before offering any check", async () => {
    await renderWithStore(<SelfTests />, {});
    expect(await screen.findByText(/not a measurement of your vision/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot be compared with a test done at a clinic/i)).toBeInTheDocument();
  });

  it("refuses to record a result until the conditions are known", async () => {
    const user = userEvent.setup();
    await renderWithStore(<SelfTests />, {});

    await user.click((await screen.findAllByRole("button", { name: /start this check/i }))[0]);
    expect(
      await screen.findByText(/could not be compared with any other/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save this check/i })).toBeNull();
  });

  it("records an Amsler check with its conditions and marks nothing on its own", async () => {
    const user = userEvent.setup();
    await renderWithStore(<SelfTests />, {});

    await user.click((await screen.findAllByRole("button", { name: /start this check/i }))[0]);
    await user.selectOptions(screen.getByLabelText(/screen brightness/i), "medium");
    await user.selectOptions(screen.getByLabelText(/room lighting/i), "normal");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save this check/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /save this check/i }));

    await waitFor(async () => {
      const saved = await dbGetAll<SelfTestResult>("selfTests");
      expect(saved).toHaveLength(1);
      expect(saved[0].kind).toBe("amsler");
      expect(saved[0].source_type).toBe("patient_reported");
      expect(saved[0].conditions.distance_cm).toBeTruthy();
      expect(saved[0].conditions.brightness).toBe("medium");
    });
  });

  it("shows a previous check as patient-performed, with the conditions it was taken under", async () => {
    await renderWithStore(<SelfTests />, {
      selfTests: [
        {
          id: "t1",
          kind: "home_acuity",
          date_time: "2026-09-01T09:00:00",
          eye: "left",
          result: { smallest_step: 3, notation: "about 6/12 on a home screen check" },
          conditions: {
            brightness: "medium",
            ambient: "normal",
            distance_cm: 40,
            correction: "glasses",
          },
          source_type: "patient_reported",
          created_at: "2026-09-01T09:00:00",
          updated_at: "2026-09-01T09:00:00",
        } satisfies SelfTestResult,
      ],
    });

    expect(await screen.findByText(/patient performed/i)).toBeInTheDocument();
    expect(screen.getByText(/on a home screen check/i)).toBeInTheDocument();
    expect(screen.getByText(/40 cm away, with glasses/i)).toBeInTheDocument();
  });

  it("never renders a bare clinical acuity", async () => {
    await renderWithStore(<SelfTests />, {});
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/(?:^|\s)(6|20)\/\d+(?:\s|$)/);
  });
});
