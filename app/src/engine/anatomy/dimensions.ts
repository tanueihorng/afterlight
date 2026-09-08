// Ocular dimensions, in millimetres.
//
// Every builder takes its numbers from here rather than from whatever looked right on screen.
// A model built to real proportions is the difference between "an eye" and "a ball with a picture
// on it", and it means a clinician looking over a patient's shoulder does not wince.
//
// These are textbook adult averages. They are not this patient's eye, and nothing in the engine
// may claim otherwise.

export const EYE = {
  /** Anterior–posterior length of the globe. */
  axialLength: 24.0,
  /** The globe is not a sphere; it is slightly wider than it is tall. */
  horizontalDiameter: 23.5,
  verticalDiameter: 23.0,

  cornea: {
    /** Anterior surface radius of curvature. */
    anteriorRadius: 7.8,
    posteriorRadius: 6.5,
    centralThickness: 0.55,
    peripheralThickness: 0.67,
    /** Asphericity: the cornea flattens towards the periphery. */
    Q: -0.26,
    /** Refractive index, which is what makes the iris appear where it does. */
    ior: 1.376,
  },

  limbus: {
    /** Horizontal visible iris diameter — the "white to white" measurement. */
    diameter: 11.7,
    /** Width of the transition band from clear cornea to sclera. */
    width: 1.2,
  },

  anteriorChamber: {
    /** Corneal endothelium to anterior lens surface. */
    depth: 3.1,
  },

  iris: {
    /** Pupil diameter range from constricted to dilated. */
    pupilMin: 2.0,
    pupilMax: 8.0,
    /** The collarette sits at roughly a third of the iris radius from the pupil margin. */
    collaretteRatio: 0.36,
    thickness: 0.5,
  },

  lens: {
    diameter: 9.0,
    thickness: 4.0,
    anteriorRadius: 10.0,
    posteriorRadius: -6.0,
  },

  retina: {
    /** Optic disc, horizontal by vertical. */
    discWidth: 1.8,
    discHeight: 1.9,
    /** Disc centre relative to the fovea. */
    discNasalDegrees: 15.5,
    discSuperiorDegrees: 1.5,
    /** Foveal avascular zone — the vessel tree must respect this. */
    favDiameter: 0.5,
    /** Macula, the pigmented central region. */
    maculaDiameter: 5.5,
    thickness: 0.25,
  },

  sclera: {
    thicknessPosterior: 1.0,
    thicknessEquator: 0.5,
  },
} as const;

/** Scene units are millimetres divided by this, so a whole eye is about 2.4 units across. */
export const SCENE_SCALE = 10;

export function mm(value: number): number {
  return value / SCENE_SCALE;
}

/**
 * Where the optic disc sits on the retina, as a direction from the eye's centre.
 * Nasal is +x for a right eye and −x for a left one, which is why laterality matters here.
 */
export function discDirection(eye: "right" | "left"): { x: number; y: number; z: number } {
  const nasal = ((eye === "right" ? 1 : -1) * EYE.retina.discNasalDegrees * Math.PI) / 180;
  const superior = (EYE.retina.discSuperiorDegrees * Math.PI) / 180;
  return {
    x: Math.sin(nasal) * Math.cos(superior),
    y: Math.sin(superior),
    z: -Math.cos(nasal) * Math.cos(superior),
  };
}
