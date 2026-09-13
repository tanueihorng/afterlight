import { describe, expect, it } from "vitest";
import { inLens, weightOf } from "./timeline-story";

describe("timeline story weights", () => {
  it("weights the clinical spine as milestones", () => {
    for (const t of ["diagnosis", "procedure", "appointment", "imaging"]) {
      expect(weightOf(t)).toBe("milestone");
    }
  });

  it("weights treatment as its own band", () => {
    expect(weightOf("medication")).toBe("treatment");
    expect(weightOf("prescription")).toBe("treatment");
  });

  it("weights the person's own observations as observations", () => {
    for (const t of ["daily_log", "symptom", "floater", "drawing", "measurement", "document"]) {
      expect(weightOf(t)).toBe("observation");
    }
  });

  it("never crashes on an unknown type — it stays visible as an observation", () => {
    expect(weightOf("something_new")).toBe("observation");
    expect(inLens({ event_type: "something_new" } as never, "everything")).toBe(true);
    expect(inLens({ event_type: "something_new" } as never, "clinical")).toBe(false);
  });

  it("lens: clinical hides observations, everything shows them", () => {
    const e = { event_type: "symptom" } as never;
    expect(inLens(e, "clinical")).toBe(false);
    expect(inLens(e, "everything")).toBe(true);
    const dx = { event_type: "diagnosis" } as never;
    expect(inLens(dx, "clinical")).toBe(true);
  });
});
