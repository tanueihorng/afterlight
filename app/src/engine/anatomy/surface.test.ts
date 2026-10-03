import { describe, expect, it } from "vitest";
import { EYE } from "./dimensions";
import { anteriorSurface, cornealSag } from "./surface";

describe("anterior geometry", () => {
  it("joins the aspheric cornea to the limbus without a gap", () => {
    const surface = anteriorSurface();
    expect(surface.apexZ - cornealSag(surface.limbusRadius)).toBeCloseTo(surface.limbusZ, 10);
    expect(surface.limbusZ ** 2 + surface.limbusRadius ** 2).toBeCloseTo(
      (EYE.axialLength / 2) ** 2,
      10,
    );
    expect(cornealSag(0)).toBe(0);
  });

  it("measures chamber depth from the inner corneal apex, not the limbus", () => {
    const surface = anteriorSurface();
    expect(surface.apexZ - EYE.cornea.centralThickness - surface.irisZ).toBeCloseTo(
      EYE.anteriorChamber.depth,
      10,
    );
    expect(surface.irisZ).toBeLessThan(surface.limbusZ);
  });

  it("flattens towards the edge instead of using a spherical glass cap", () => {
    const r = EYE.limbus.diameter / 2;
    const sphericalSag =
      EYE.cornea.anteriorRadius - Math.sqrt(EYE.cornea.anteriorRadius ** 2 - r ** 2);
    expect(cornealSag(r)).toBeLessThan(sphericalSag);
    for (let radial = 0; radial < r; radial += 0.1) {
      expect(cornealSag(radial + 0.1)).toBeGreaterThan(cornealSag(radial));
    }
  });
});
