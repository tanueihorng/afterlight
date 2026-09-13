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
    /**
     * Where the retina's anterior edge (the ora serrata) sits behind the limbus, measured along
     * the globe surface. Nasal ~5.75 mm, temporal ~6.50 mm (EyeWiki, "Eye in Numbers"); modelled
     * as one ring at the mean, an approximation recorded in docs/eye-realism/anatomy-contract.md.
     */
    oraBehindLimbus: 6.1,
  },

  choroid: {
    /**
     * Modelled thickness. Histology gives 0.17–0.22 mm (Entezari 2018, PMC5782455; Ding 2011,
     * IOVS); the cutaway renders this at a labelled illustrative magnification so the layer
     * reads at all (see layerMagnification).
     */
    thickness: 0.18,
  },

  nerve: {
    /** Optic disc / scleral canal diameter. */
    canalDiameter: 1.9,
    /** Intraorbital length behind the globe (Radiopaedia, "Optic nerve": ~25 mm). */
    intraorbitalLength: 25.0,
    /** Core diameter in the orbit, 3–3.5 mm in the standard texts. */
    coreDiameter: 3.3,
    /**
     * Sheath diameter just behind the globe. The ultrasound ONSD convention measures 5–6 mm
     * (PMC6851876); the model tapers from that envelope to a slimmer 4.6 mm stalk.
     */
    sheathDiameterAtGlobe: 5.0,
    sheathDiameterDistal: 4.6,
  },

  muscles: {
    /**
     * Spiral of Tillaux: insertion distance behind the limbus, medial/inferior/lateral/superior.
     * Classic teaching values (EyeWiki, "Extraocular Muscles"); cadaveric means run ~0.2–0.9 mm
     * smaller (Kim 2024, PubMed 38708857). The classic values are used and the delta noted.
     */
    insertionBehindLimbus: { medial: 5.5, inferior: 6.5, lateral: 6.9, superior: 7.7 },
    /** Belly width at the insertion: ~10 mm medial, LR thinnest at ~9.2 (EyeWiki). */
    bellyWidth: { medial: 10.0, inferior: 9.6, lateral: 9.2, superior: 10.6 },
    /** Belly thickness, ultrasound 3.6–4.0 mm (J Med Assoc Thai 90:307). */
    bellyThickness: 3.8,
    /** Total length from the annulus of Zinn to the insertion, ~40 mm (Haładaj 2019, TVST). */
    totalLength: 40.0,
    /** Tendon length before the insertion: MR ~3.7–4.5, SR ~5.5, LR ~8.8 (Haładaj 2019). */
    tendonLength: { medial: 4.2, inferior: 5.0, lateral: 8.8, superior: 5.5 },
    /** Where the muscle cone closes at the orbital apex, behind the globe centre: the recti run
     * ~40 mm from apex to insertion, which with insertions ~6-7 mm behind the limbus puts the
     * annulus of Zinn ~28 mm behind centre (Haładaj 2019; standard orbital geometry). */
    apexBehindCentre: 28.0,
    /** Radius of the origin ring around the nerve at the apex. */
    apexRingRadius: 2.6,
  },

  ciliaryBody: {
    /**
     * Radial width at the mean of nasal 5.9 / temporal 6.7 mm (Guedes 2024, PMC11130848;
     * Lincke 2020, PMC8166736). The muscle itself fills the anterior half; the pars plana behind.
     */
    width: 6.0,
  },

  sclera: {
    thicknessPosterior: 1.0,
    thicknessEquator: 0.5,
    /** Approaching the limbus the wall thins further (standard texts; ~0.3–0.4 mm at the spur). */
    thicknessLimbal: 0.4,
    /** Posterior aperture for the optic nerve (canal diameter). */
    canalDiameter: 1.9,
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
