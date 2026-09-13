// The eye scene: geometry, materials, lighting and the render loop.
//
// Framework-agnostic on purpose. React mounts it and tears it down; nothing here knows React
// exists, which is what keeps it testable and what makes the standalone offline build possible.

import {
  ACESFilmicToneMapping,
  AmbientLight,
  MeshBasicMaterial,
  PlaneGeometry,
  FrontSide,
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
  Plane,
  Vector3,
  PMREMGenerator,
  RingGeometry,
  TextureLoader,
  Vector2,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
  type Object3D,
} from "three";
import { irisNormalUrl } from "../materials/iris-detail";
import { anteriorSurface, cornealSag } from "../anatomy/surface";
import { EYE, mm, SCENE_SCALE } from "../anatomy/dimensions";
import { DEFAULT_IRIS, pupilRadiusMm, type IrisParams } from "../anatomy/iris";
import { DEFAULT_FUNDUS, type FundusParams } from "../anatomy/fundus";
import {
  irisTexture,
  scleraTexture,
  fundusTexture,
  disposeTextureCache,
} from "../materials/textures";
import { TIERS, probeCapability, type QualityTier } from "./capability";

export type ViewMode = "exterior" | "cross_section" | "fundus" | "cornea";

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
  slice: number;
  separation: number;
  zoom: number;
  reducedMotion: boolean;
}

export const DEFAULT_SCENE: EyeSceneOptions = {
  eye: "right",
  iris: DEFAULT_IRIS,
  fundus: DEFAULT_FUNDUS,
  scleraVessels: 0.45,
  view: "exterior",
  light: 0.5,
  slice: 0.5,
  separation: 0,
  zoom: 1,
  reducedMotion: false,
};

/**
 * A ring with polar UVs: u runs around the circle, v from the pupil margin outwards. Three's own
 * RingGeometry maps a square over the annulus, which smears an iris texture badly.
 */
function polarRing(inner: number, outer: number, segments: number): RingGeometry {
  const geometry = new RingGeometry(inner, outer, segments, 32);
  const position = geometry.getAttribute("position");
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const radius = Math.hypot(x, y);
    const angle = Math.atan2(y, x);
    uv[i * 2] = (angle + Math.PI) / (Math.PI * 2);
    const radial = (radius - inner) / (outer - inner);
    uv[i * 2 + 1] = radial;
    position.setZ(i, mm(EYE.iris.thickness) * 0.18 * Math.sin(radial * Math.PI));
  }
  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
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
  private sectionPlane = new Plane(new Vector3(-1, 0, 0), 0);
  private rotationTarget = { x: 0, y: 0 };
  private targetPupil = 0;
  private currentPupil = 0;
  private onContextLost?: () => void;

  constructor(
    private canvas: HTMLCanvasElement,
    options: Partial<EyeSceneOptions> = {},
  ) {
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
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, TIERS[this.tier].pixelRatioCap));

    canvas.addEventListener("webglcontextlost", this.handleContextLost);
    canvas.addEventListener("webglcontextrestored", this.handleContextRestored);

    this.renderer.localClippingEnabled = true;
    const room = new Scene();
    room.background = new Color(0x343536);
    const softboxGeometry = new PlaneGeometry(3.5, 5);
    const softboxMaterial = new MeshBasicMaterial({ color: new Color(0xfff3df).multiplyScalar(4) });
    const softbox = new Mesh(softboxGeometry, softboxMaterial);
    softbox.position.set(-4, 5, 6);
    softbox.lookAt(0, 0, 0);
    room.add(softbox);
    const pmrem = new PMREMGenerator(this.renderer);
    const environment = this.track(pmrem.fromScene(room, 0.04, 0.1, 100, { size: 64 }));
    this.scene.environment = environment.texture;
    this.scene.environmentIntensity = 0.45;
    softboxGeometry.dispose();
    softboxMaterial.dispose();
    room.clear();
    pmrem.dispose();
    this.build();
    this.setView(this.options.view);
    this.setSlice(this.options.slice);
    this.setSeparation(this.options.separation);
    this.setZoom(this.options.zoom);
    this.currentPupil = pupilRadiusMm(this.options.iris);
    this.targetPupil = this.currentPupil;
    this.updatePupil();
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
    const anterior = anteriorSurface();
    const corneaCentreZ = mm(anterior.apexZ) - corneaRadius;
    const irisZ = mm(anterior.irisZ);

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
    globe.scale.set(
      EYE.horizontalDiameter / EYE.axialLength,
      1,
      EYE.verticalDiameter / EYE.axialLength,
    );
    globe.name = "sclera";
    globeMaterial.clippingPlanes = [this.sectionPlane];
    eyeGroup.add(globe);

    // Iris: a flat annulus behind the anterior chamber, textured in polar coordinates.
    const irisGeometry = this.track(
      polarRing(mm(pupilRadiusMm(this.options.iris)), limbusRadius, settings.irisSegments),
    );
    const irisMap = irisTexture(this.options.iris, settings.textureSize, () => this.renderOnce());
    const irisNormal = this.track(new TextureLoader().load(irisNormalUrl, () => this.renderOnce()));
    irisNormal.anisotropy = 8;
    const irisMaterial = this.track(
      new MeshStandardMaterial({
        map: irisMap ?? undefined,
        normalMap: irisNormal,
        normalScale: new Vector2(
          0.65 * this.options.iris.fibreDensity,
          0.65 * this.options.iris.fibreDensity,
        ),
        roughness: 0.78,
        metalness: 0,
        side: DoubleSide,
      }),
    );
    this.iris = new Mesh(irisGeometry, irisMaterial);
    this.iris.name = "iris";
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
    const corneaPositions = corneaGeometry.getAttribute("position");
    for (let i = 0; i < corneaPositions.count; i++) {
      const radial = Math.hypot(corneaPositions.getX(i), corneaPositions.getZ(i));
      corneaPositions.setY(i, corneaRadius - mm(cornealSag(radial * SCENE_SCALE)));
    }
    corneaGeometry.computeVertexNormals();
    const corneaMaterial = this.track(
      new MeshPhysicalMaterial({
        transmission: 1,
        thickness: mm(EYE.cornea.centralThickness),
        ior: EYE.cornea.ior,
        roughness: 0.015,
        metalness: 0,
        clearcoat: 0,
        envMapIntensity: 0.8,
        specularIntensity: 0.55,
        side: FrontSide,
      }),
    );
    const cornea = new Mesh(corneaGeometry, corneaMaterial);
    cornea.rotation.x = Math.PI / 2;
    cornea.position.z = corneaCentreZ;
    cornea.name = "cornea";
    eyeGroup.add(cornea);

    // Limbus: the transition from clear cornea to sclera is a soft band, not an edge.
    const limbusGeometry = this.track(
      new RingGeometry(
        limbusRadius - mm(EYE.limbus.width / 4),
        limbusRadius + mm(EYE.limbus.width / 4),
        96,
        1,
      ),
    );
    const limbusMaterial = this.track(
      new MeshStandardMaterial({
        color: 0x2b2530,
        transparent: true,
        opacity: 0.14 * this.options.iris.limbalRing,
        roughness: 0.8,
        side: DoubleSide,
      }),
    );
    const limbus = new Mesh(limbusGeometry, limbusMaterial);
    limbus.position.z = limbusZ - mm(0.2);
    limbus.name = "limbus";
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
    tear.name = "tear";
    eyeGroup.add(tear);

    const retinaRadius = globeRadius - mm(EYE.sclera.thicknessPosterior);
    const retinaGeometry = this.track(
      new SphereGeometry(
        retinaRadius,
        settings.globeSegments,
        settings.globeSegments,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      ),
    );
    retinaGeometry.rotateX(-Math.PI / 2);
    // Project the existing fundus painter onto the posterior bowl, preserving its laterality.
    const positions = retinaGeometry.getAttribute("position");
    const retinaUV = retinaGeometry.getAttribute("uv");
    for (let i = 0; i < positions.count; i++) {
      retinaUV.setXY(
        i,
        0.5 + positions.getX(i) / (2 * retinaRadius),
        0.5 + positions.getY(i) / (2 * retinaRadius),
      );
    }
    const retinaMaterial = this.track(
      new MeshStandardMaterial({
        map: fundusTexture(this.options.fundus, settings.textureSize) ?? undefined,
        side: DoubleSide,
        roughness: 0.65,
        clippingPlanes: [this.sectionPlane],
      }),
    );
    const retina = new Mesh(retinaGeometry, retinaMaterial);
    retina.name = "retina";
    eyeGroup.add(retina);

    const lens = new Mesh(
      this.track(new SphereGeometry(1, 64, 32)),
      this.track(
        new MeshPhysicalMaterial({
          color: 0xf4e5c5,
          transmission: 0.8,
          roughness: 0.06,
          thickness: mm(EYE.lens.thickness),
          side: DoubleSide,
        }),
      ),
    );
    lens.name = "lens";
    lens.scale.set(
      mm(EYE.lens.diameter / 2),
      mm(EYE.lens.diameter / 2),
      mm(EYE.lens.thickness / 2),
    );
    lens.position.z = irisZ - mm(EYE.lens.thickness / 2);
    eyeGroup.add(lens);
    eyeGroup.children.forEach((part) => {
      part.userData.baseZ = part.position.z;
    });

    // Lighting: a key, a fill and a rim, all generated. Nothing is fetched.
    const key = new DirectionalLight(0xfff4e6, 2.0);
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
    if (this.options.reducedMotion) {
      this.currentPupil = this.targetPupil;
      this.updatePupil();
      this.renderOnce();
    } else this.start();
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
    this.rotationTarget.y = clampAngle(this.rotationTarget.y + deltaX, Math.PI);
    this.rotationTarget.x = clampAngle(this.rotationTarget.x + deltaY, 1.4);
    if (this.options.reducedMotion) {
      this.eyeGroup.rotation.set(this.rotationTarget.x, this.rotationTarget.y, 0);
    }
    if (!this.options.reducedMotion) this.start();
    this.renderOnce();
  }

  setView(view: ViewMode): void {
    this.options.view = view;
    const visible: Record<ViewMode, string[]> = {
      exterior: ["sclera", "iris", "pupil", "cornea", "limbus"],
      cross_section: ["sclera", "iris", "pupil", "cornea", "limbus", "retina", "lens"],
      fundus: ["retina"],
      cornea: ["cornea", "limbus", "iris", "pupil"],
    };
    this.eyeGroup?.children.forEach((part) => {
      part.visible = visible[view].includes(part.name);
    });
    this.rotationTarget = {
      x: 0,
      y: view === "cross_section" ? -0.85 : view === "cornea" ? 0.65 : 0,
    };
    if (this.options.reducedMotion) this.eyeGroup?.rotation.set(0, this.rotationTarget.y, 0);
    this.setSlice(this.options.slice);
    this.setSeparation(this.options.separation);
    if (!this.options.reducedMotion) this.start();
  }

  setSlice(value: number): void {
    this.options.slice = Math.max(0, Math.min(1, value));
    this.sectionPlane.constant =
      this.options.view === "cross_section"
        ? (this.options.slice * 2 - 1) * mm(EYE.axialLength / 2)
        : mm(EYE.axialLength);
    this.renderOnce();
  }

  setSeparation(value: number): void {
    this.options.separation = Math.max(0, Math.min(1, value));
    const order: Record<string, number> = {
      cornea: 1,
      tear: 1,
      limbus: 0.7,
      iris: 0.4,
      pupil: 0.4,
      lens: 0.2,
    };
    this.eyeGroup?.children.forEach((part) => {
      part.position.z =
        Number(part.userData.baseZ) +
        (order[part.name] ?? 0) *
          (this.options.view === "cross_section" || this.options.view === "cornea"
            ? this.options.separation
            : 0) *
          mm(EYE.anteriorChamber.depth);
    });
    this.renderOnce();
  }

  setZoom(value: number): void {
    this.camera.zoom = Math.max(0.7, Math.min(1.6, value));
    this.camera.updateProjectionMatrix();
    this.renderOnce();
  }

  private updatePupil(): void {
    const pupil = this.eyeGroup?.getObjectByName("pupil");
    if (pupil) pupil.scale.setScalar(this.currentPupil / 2);
  }

  private tick = (): void => {
    if (!this.renderer) return;
    const delta = Math.min(this.clock.getDelta(), 0.05);

    // The pupil eases to its target; an instant jump reads as a glitch, not a reflex.
    const speed = this.options.reducedMotion ? 1 : 4;
    this.currentPupil += (this.targetPupil - this.currentPupil) * Math.min(1, delta * speed);
    this.updatePupil();
    if (this.eyeGroup) {
      const ease = this.options.reducedMotion ? 1 : 1 - Math.exp(-12 * delta);
      this.eyeGroup.rotation.x += (this.rotationTarget.x - this.eyeGroup.rotation.x) * ease;
      this.eyeGroup.rotation.y += (this.rotationTarget.y - this.eyeGroup.rotation.y) * ease;
    }

    this.updateSectionPlane();
    this.renderer.render(this.scene, this.camera);
    const turning =
      this.eyeGroup &&
      (Math.abs(this.eyeGroup.rotation.x - this.rotationTarget.x) > 0.0001 ||
        Math.abs(this.eyeGroup.rotation.y - this.rotationTarget.y) > 0.0001);
    // Once the control settles, a still eye needs no further GPU work.
    if (turning || Math.abs(this.targetPupil - this.currentPupil) > 0.0001) {
      this.frame = requestAnimationFrame(this.tick);
    } else {
      this.frame = 0;
    }
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
  private updateSectionPlane(): void {
    if (this.eyeGroup) this.sectionPlane.normal.set(-1, 0, 0).applyEuler(this.eyeGroup.rotation);
  }

  renderOnce(): void {
    this.updateSectionPlane();
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
