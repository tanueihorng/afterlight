import { EYE } from "./dimensions";

export function cornealSag(radiusMm: number): number {
  const radius = EYE.cornea.anteriorRadius;
  return (
    radiusMm ** 2 / (radius * (1 + Math.sqrt(1 - (1 + EYE.cornea.Q) * (radiusMm / radius) ** 2)))
  );
}

export function anteriorSurface() {
  const limbusRadius = EYE.limbus.diameter / 2;
  const limbusZ = Math.sqrt((EYE.axialLength / 2) ** 2 - limbusRadius ** 2);
  const apexZ = limbusZ + cornealSag(limbusRadius);
  return {
    limbusRadius,
    limbusZ,
    apexZ,
    irisZ: apexZ - EYE.cornea.centralThickness - EYE.anteriorChamber.depth,
  };
}
