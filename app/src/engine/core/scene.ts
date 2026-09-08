// The eye scene: geometry, materials, lighting and the render loop.
//
// Framework-agnostic on purpose. React mounts it and tears it down; nothing here knows React
// exists, which is what keeps it testable and what makes the standalone offline build possible.

import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferAttribute,
  CircleGeometry,
  Clock,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
  type Object3D,
} from "three";
import { EYE, mm } from "../anatomy/dimensions";
import { DEFAULT_IRIS, pupilRadiusMm, type IrisParams } from "../anatomy/iris";
import { DEFAULT_FUNDUS, type FundusParams } from "../anatomy/fundus";
import { irisTexture, scleraTexture, disposeTextureCache } from "../materials/textures";
import { TIERS, probeCapability, type QualityTier } from "./capability";

export type ViewMode = "exterior" | "cross_section" | "fundus";

export interface EyeSceneOptions {
  eye: "right" | "left";
  iris: IrisParams;
  fundus: FundusParams;
  /** Episcleral vessel density: how red the white of the eye looks. */
  scleraVessels: number;
  quality?: QualityTier;
  view: ViewMode;
  /** 0 dark to 1 bright; drives pupil size. */
  light: number;
  reducedMotion: boolean;
}

export const DEFAULT_SCENE: EyeSceneOptions = {
  eye: "right",
  iris: DEFAULT_IRIS,
  fundus: DEFAULT_FUNDUS,
  scleraVessels: 0.45,
  view: "exterior",
  light: 0.5,
  reducedMotion: false,
};

/**
 * A ring with polar UVs: u runs around the circle, v from the pupil margin outwards. Three's own
 * RingGeometry maps a square over the annulus, which smears an iris texture badly.
 */
function polarRing(inner: number, outer: number, segments: number): RingGeometry {
  const geometry = new RingGeometry(inner, outer, segments, 2);
  const position = geometry.getAttribute("position");
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const radius = Math.hypot(x, y);
    const angle = Math.atan2(y, x);
    uv[i * 2] = (angle + Math.PI) / (Math.PI * 2);
    uv[i * 2 + 1] = 1 - (radius - inner) / (outer - inner);
  }
  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  return geometry;
}

function clampAngle(value: number, limit: number): number {
  return Math.min(limit, Math.max(-limit, value));
}

export class EyeScene {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  private renderer: WebGLRenderer | null = null;
  private clock = new Clock();
  private frame = 0;
  private options: EyeSceneOptions;
  private tier: QualityTier;
  private disposables: { dispose(): void }[] = [];
  private iris: Mesh | null = null;
  private eyeGroup: Group | null = null;
  private targetPupil = 0;
  private currentPupil = 0;
  private onContextLost?: () => void;

  constructor(private canvas: HTMLCanvasElement, options: Partial<EyeSceneOptions> = {}) {
    this.options = { ...DEFAULT_SCENE, ...options };
    const capability = probeCapability();
    this.tier = this.options.quality ?? capability.tier;

    this.camera = new PerspectiveCamera(28, 1, 0.01, 100);
    this.camera.position.set(0, 0, 6.4);
    this.scene.background = new Color(0x05070c);

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: this.tier !== "low",
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, TIERS[this.tier].pixelRatioCap));

    canvas.addEventListener("webglcontextlost", this.handleContextLost);
    canvas.addEventListener("webglcontextrestored", this.handleContextRestored);

    this.build();
    this.currentPupil = pupilRadiusMm(this.options.iris);
    this.targetPupil = this.currentPupil;
  }

  /* ------------------------------------------------------------ building */

  private track<T extends { dispose(): void }>(resource: T): T {
    this.disposables.push(resource);
    return resource;
  }

  private build(): void {
    const settings = TIERS[this.tier];

    // Work out the anterior geometry from the real dimensions rather than by eye.
    const globeRadius = mm(EYE.axialLength / 2);
    const limbusRadius = mm(EYE.limbus.diameter / 2);
    // Where the limbus sits on the globe, and therefore where the sclera has to stop.
    const limbusZ = Math.sqrt(globeRadius ** 2 - limbusRadius ** 2);
    const limbusAngle = Math.asin(limbusRadius / globeRadius);
    const corneaRadius = mm(EYE.cornea.anteriorRadius);
    // The corneal cap must meet the globe exactly at the limbus, or there is a visible seam.
    const corneaCentreZ = limbusZ - Math.sqrt(corneaRadius ** 2 - limbusRadius ** 2);
    const irisZ = limbusZ - mm(EYE.anteriorChamber.depth);

    const eyeGroup = new Group();
    eyeGroup.name = "eye";
    this.scene.add(eyeGroup);
    this.eyeGroup = eyeGroup;

    // Sclera: a sphere with the corneal aperture cut out of the front. Without the cut the iris
    // is sealed inside an opaque ball, which is exactly what an eye is not.
    const globeGeometry = this.track(
      new SphereGeometry(
        globeRadius,
        settings.globeSegments,
        settings.globeSegments,
        0,
        Math.PI * 2,
        limbusAngle,
        Math.PI - limbusAngle,
      ),
    );
    const scleraMap = scleraTexture(this.options.scleraVessels, settings.textureSize);
    const globeMaterial = this.track(
      new MeshPhysicalMaterial({
        map: scleraMap ?? undefined,
        color: 0xffffff,
        roughness: 0.38,
        clearcoat: 0.55,
        clearcoatRoughness: 0.22,
        sheen: 0.35,
        side: DoubleSide,
      }),
    );
    const globe = new Mesh(globeGeometry, globeMaterial);
    // The sphere's pole is +Y; rotate it so the aperture faces the viewer.
    globe.rotation.x = Math.PI / 2;
    globe.scale.set(EYE.horizontalDiameter / EYE.axialLength, 1, EYE.verticalDiameter / EYE.axialLength);
    eyeGroup.add(globe);

    // Iris: a flat annulus behind the anterior chamber, textured in polar coordinates.
    const irisGeometry = this.track(
      polarRing(mm(1), limbusRadius, settings.irisSegments),
    );
    const irisMap = irisTexture(this.options.iris, settings.textureSize);
    const irisMaterial = this.track(
      new MeshStandardMaterial({
        map: irisMap ?? undefined,
        // The same painting drives relief: fibres and crypts have depth, which is most of what
        // separates an iris from a flat disc with a pattern on it.
        bumpMap: irisMap ?? undefined,
        bumpScale: 0.6,
        roughness: 0.5,
        metalness: 0,
        side: DoubleSide,
      }),
    );
    this.iris = new Mesh(irisGeometry, irisMaterial);
    this.iris.position.z = irisZ;
    eyeGroup.add(this.iris);

    // Pupil: a real dark disc so it can constrict, not a hole painted in the texture.
    const pupilGeometry = this.track(new CircleGeometry(mm(2), 64));
    const pupilMaterial = this.track(new MeshStandardMaterial({ color: 0x04050b, roughness: 1 }));
    const pupil = new Mesh(pupilGeometry, pupilMaterial);
    pupil.name = "pupil";
    pupil.position.z = irisZ - mm(0.05);
    eyeGroup.add(pupil);

    // Cornea: transmissive and refractive. This is the single strongest cue that the render is an
    // eye rather than a ball with a picture on it — it bends the iris behind it.
    const corneaGeometry = this.track(
      new SphereGeometry(
        corneaRadius,
        settings.globeSegments,
        settings.globeSegments,
        0,
        Math.PI * 2,
        0,
        Math.asin(limbusRadius / corneaRadius),
      ),
    );
    const corneaMaterial = this.track(
      new MeshPhysicalMaterial({
        transmission: 1,
        thickness: mm(EYE.cornea.centralThickness) * 6,
        ior: EYE.cornea.ior,
        roughness: 0.015,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.01,
        transparent: true,
        side: DoubleSide,
      }),
    );
    const cornea = new Mesh(corneaGeometry, corneaMaterial);
    cornea.rotation.x = Math.PI / 2;
    cornea.position.z = corneaCentreZ;
    eyeGroup.add(cornea);

    // Limbus: the transition from clear cornea to sclera is a soft band, not an edge.
    const limbusGeometry = this.track(
      new RingGeometry(limbusRadius * 0.94, limbusRadius * 1.13, 96, 1),
    );
    const limbusMaterial = this.track(
      new MeshStandardMaterial({
        color: 0x2b2530,
        transparent: true,
        opacity: 0.42 * this.options.iris.limbalRing,
        roughness: 0.8,
        side: DoubleSide,
      }),
    );
    const limbus = new Mesh(limbusGeometry, limbusMaterial);
    limbus.position.z = limbusZ - mm(0.2);
    eyeGroup.add(limbus);

    // Tear film: a thin, very smooth layer whose specular is the wet look.
    const tearGeometry = this.track(
      new SphereGeometry(
        corneaRadius * 1.005,
        48,
        48,
        0,
        Math.PI * 2,
        0,
        Math.asin(limbusRadius / corneaRadius) * 0.98,
      ),
    );
    const tearMaterial = this.track(
      new MeshPhysicalMaterial({
        transmission: 1,
        roughness: 0,
        ior: 1.336,
        thickness: 0.01,
        transparent: true,
        opacity: 0.6,
        side: DoubleSide,
      }),
    );
    const tear = new Mesh(tearGeometry, tearMaterial);
    tear.rotation.x = Math.PI / 2;
    tear.position.z = corneaCentreZ;
    eyeGroup.add(tear);

    // Lighting: a key, a fill and a rim, all generated. Nothing is fetched.
    const key = new DirectionalLight(0xfff4e6, 3.1);
    key.position.set(2.2, 2.4, 4.4);
    this.scene.add(key);

    const fill = new DirectionalLight(0xc3d6ff, 0.8);
    fill.position.set(-3.2, -1.4, 2.2);
    this.scene.add(fill);

    const rim = new DirectionalLight(0xffffff, 1.1);
    rim.position.set(-1.6, 1.6, -2.6);
    this.scene.add(rim);

    this.scene.add(new AmbientLight(0xffffff, 0.4));
  }

  /* -------------------------------------------------------------- runtime */

  setLight(light: number): void {
    this.options.light = light;
    this.targetPupil = (8 - 6 * Math.min(1, Math.max(0, light)) ** 0.55) / 2;
  }

  resize(width: number, height: number): void {
    if (!this.renderer) return;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  /** Rotate the eye, as a person would turn a model in their hand. */
  rotate(deltaX: number, deltaY: number): void {
    if (!this.eyeGroup) return;
    this.eyeGroup.rotation.y = clampAngle(this.eyeGroup.rotation.y + deltaX, 1.1);
    this.eyeGroup.rotation.x = clampAngle(this.eyeGroup.rotation.x + deltaY, 0.8);
    this.renderOnce();
  }

  private tick = (): void => {
    if (!this.renderer) return;
    const delta = Math.min(this.clock.getDelta(), 0.05);

    // The pupil eases to its target; an instant jump reads as a glitch, not a reflex.
    const speed = this.options.reducedMotion ? 1 : 4;
    this.currentPupil += (this.targetPupil - this.currentPupil) * Math.min(1, delta * speed);
    const pupil = this.eyeGroup?.getObjectByName("pupil");
    // The disc is built at 2 mm radius; scale it to the current pupil radius.
    if (pupil) pupil.scale.setScalar(Math.max(0.1, this.currentPupil / 2));

    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.tick);
  };

  start(): void {
    if (this.frame) return;
    this.clock.start();
    this.frame = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  /** Render exactly one frame — used for stills and for reduced-motion mode. */
  renderOnce(): void {
    this.renderer?.render(this.scene, this.camera);
  }

  onContextLoss(handler: () => void): void {
    this.onContextLost = handler;
  }

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.stop();
    this.onContextLost?.();
  };

  private handleContextRestored = (): void => {
    this.start();
  };

  /* ------------------------------------------------------------ teardown */

  /**
   * Release everything. A leaked geometry or texture is invisible until the tab runs out of GPU
   * memory, so this is tested rather than assumed.
   */
  dispose(): void {
    this.stop();
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);

    this.scene.traverse((object: Object3D) => {
      const mesh = object as Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    this.scene.clear();

    for (const resource of this.disposables) resource.dispose();
    this.disposables = [];

    disposeTextureCache();
    this.renderer?.dispose();
    this.renderer = null;
  }

  /** Diagnostic: what the renderer is currently holding. */
  info() {
    return this.renderer?.info ?? null;
  }
}
