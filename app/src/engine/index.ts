// Public surface of the eye engine.
//
// Framework-agnostic by design: React wraps this, the standalone offline build wraps this, and
// tests call into it directly. Nothing above this line knows about Three.js.

export { EyeScene, DEFAULT_SCENE, type EyeSceneOptions, type ViewMode } from "./core/scene";
export { probeCapability, TIERS, type Capability, type QualityTier } from "./core/capability";
export { EYE, SCENE_SCALE, mm, discDirection } from "./anatomy/dimensions";
export {
  DEFAULT_IRIS,
  IRIS_PRESETS,
  irisBaseColour,
  pupillaryZoneColour,
  pupilForLight,
  pupilRadiusMm,
  toHex,
  type IrisParams,
} from "./anatomy/iris";
export {
  DEFAULT_FUNDUS,
  fundusBackground,
  fundusLayout,
  paintFundus,
  type FundusParams,
} from "./anatomy/fundus";
export {
  DEFAULT_VESSELS,
  calibreRatio,
  growVessels,
  violatesFAV,
  type VesselParams,
  type VesselSegment,
} from "./anatomy/vessels";
export { disposeTextureCache, cachedTextureCount } from "./materials/textures";

/**
 * The boundary every view of this engine must carry. Kept here so it cannot drift between the
 * app, the standalone build and the docs.
 *
 * The more convincing the render, the easier it is for a patient to believe they are looking at
 * their own retina. This sentence is the safety property of the whole engine, not decoration.
 */
export const GENERIC_MODEL_BOUNDARY =
  "A generic model of a human eye, tuned to look roughly like yours. It is not your anatomy, not built from your scans, and shows nothing about your own condition.";
