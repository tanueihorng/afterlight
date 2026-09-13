// The eye scene: the Blender-authored model, live materials, sections and the render loop.
//
// Framework-agnostic on purpose. React mounts it and tears it down; nothing here knows React
// exists, which is what keeps it testable and what makes the standalone offline build possible.
//
// Geometry comes from the committed anatomical model (engine/anatomy/assets) — no nested
// spheres. Everything the contract keeps runtime-owned — iris colour, pupil, vessel tree, the
// fundus, laterality, slices — is applied here as materials, transforms and generated caps, so
// no condition can ever freeze into the model.

import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Clock,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  PMREMGenerator,
  PlaneGeometry,
  Vector2,
  Vector3,
  SRGBColorSpace,
  Scene,
  ShapeGeometry,
  Shape,
  TextureLoader,
  WebGLRenderer,
  type Material,
  type Object3D,
} from "three";
import { irisNormalUrl } from "../materials/iris-detail";
import { EYE, mm } from "../anatomy/dimensions";
import { DEFAULT_IRIS, pupilRadiusMm, type IrisParams } from "../anatomy/iris";
import { DEFAULT_FUNDUS, type FundusParams } from "../anatomy/fundus";
import {
  irisTexture,
  scleraTexture,
  fundusTexture,
  muscleFibreTexture,
  disposeTextureCache,
} from "../materials/textures";
import { loadEyeModel } from "../anatomy/model-assets";
import { sectionCap, type SectionPlane } from "../anatomy/section";
import { vesselTubesFor, type VesselTubeMesh } from "../anatomy/vessels3d";
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

/** Slice s ∈ [0,1] → kept-side plane offset: 0 = whole eye, 1 = deep cut past the disc. */
function sliceConstant(s: number): number {
  return mm(13 - 15 * Math.max(0, Math.min(1, s)));
}

interface StructureNode {
  group: Group;
  mesh: Mesh;
  caps: Mesh[];
  cutMaterials: Material[];
  /** local-space x range, for skipping sections that cannot touch the structure */
  minX: number;
  maxX: number;
  sliceable: boolean;
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
  private structures = new Map<string, StructureNode>();
  private pupil: Mesh | null = null;
  private limbus: Mesh | null = null;
  private vesselMeshes: Mesh[] = [];
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
    this.camera.position.set(0, 0, 7.2);
    this.scene.background = new Color(0x05070c);

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: this.tier !== "low",
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
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
    this.scene.environmentIntensity = 0.5;
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

  /** Model millimetres → scene units. */
  private toScene(positions: Float32Array): Float32Array {
    const out = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i++) out[i] = mm(positions[i]);
    return out;
  }

  private geometryFromMesh(
    positions: Float32Array,
    uvs: Float32Array | null,
    indices: Uint32Array,
  ): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.toScene(positions), 3));
    if (uvs && uvs.length === (positions.length / 3) * 2) {
      geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
    }
    geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1));
    geometry.computeVertexNormals();
    return geometry;
  }

  private buildMaterials(): Map<string, Material[]> {
    const settings = TIERS[this.tier];
    const track = <T extends Material>(m: T): T => this.track(m) as T;

    const scleraMap = scleraTexture(this.options.scleraVessels, settings.textureSize);
    const sclera = track(
      new MeshPhysicalMaterial({
        map: scleraMap ?? undefined,
        color: 0xffffff,
        roughness: 0.42,
        clearcoat: 0.12,
        clearcoatRoughness: 0.35,
        sheen: 0.25,
        side: DoubleSide,
      }),
    );
    const scleraCut = track(
      new MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.85, side: DoubleSide }),
    );
    scleraCut.name = "cut";
    const cornea = track(
      new MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 1,
        thickness: mm(EYE.cornea.centralThickness),
        ior: EYE.cornea.ior,
        roughness: 0.02,
        metalness: 0,
        clearcoat: 0.6,
        clearcoatRoughness: 0.08,
        envMapIntensity: 0.9,
        specularIntensity: 0.5,
        side: DoubleSide,
      }),
    );
    const irisMap = irisTexture(this.options.iris, settings.textureSize, () => this.renderOnce());
    const irisNormal = this.track(new TextureLoader().load(irisNormalUrl, () => this.renderOnce()));
    irisNormal.anisotropy = 8;
    const iris = track(
      new MeshStandardMaterial({
        map: irisMap ?? undefined,
        normalMap: irisNormal,
        normalScale: new Vector2(
          0.65 * this.options.iris.fibreDensity,
          0.65 * this.options.iris.fibreDensity,
        ),
        roughness: 0.72,
        metalness: 0,
        side: DoubleSide,
      }),
    );
    const irisCut = track(
      new MeshStandardMaterial({ color: 0x4a3226, roughness: 0.9, side: DoubleSide }),
    );
    const lens = track(
      new MeshPhysicalMaterial({
        color: 0xfbf7ec,
        transmission: 1,
        thickness: mm(EYE.lens.thickness),
        ior: 1.42,
        roughness: 0.03,
        envMapIntensity: 0.7,
        side: DoubleSide,
      }),
    );
    const lensCut = track(
      new MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.6, side: DoubleSide }),
    );
    lensCut.name = "cut";
    const fundusMap = fundusTexture(this.fundusParams(), settings.textureSize);
    const retina = track(
      new MeshStandardMaterial({
        map: fundusMap ?? undefined,
        roughness: 0.55,
        side: DoubleSide,
      }),
    );
    const retinaCut = track(
      new MeshStandardMaterial({ color: 0xe8b48c, roughness: 0.85, side: DoubleSide }),
    );
    retinaCut.name = "cut";
    const choroid = track(
      new MeshStandardMaterial({ color: 0x6e3222, roughness: 0.8, side: DoubleSide }),
    );
    const choroidCut = track(
      new MeshStandardMaterial({ color: 0x9c6047, roughness: 0.85, side: DoubleSide }),
    );
    choroidCut.name = "cut";
    const ciliary = track(
      new MeshStandardMaterial({ color: 0xb56a5a, roughness: 0.6, side: DoubleSide }),
    );
    const ciliaryCut = track(
      new MeshStandardMaterial({ color: 0xd09a8a, roughness: 0.8, side: DoubleSide }),
    );
    const zonule = track(
      new MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.55, side: DoubleSide }),
    );
    const sheath = track(
      new MeshPhysicalMaterial({ color: 0xe9e4d6, roughness: 0.5, sheen: 0.3, side: DoubleSide }),
    );
    const core = track(
      new MeshStandardMaterial({ color: 0xdccbb8, roughness: 0.55, side: DoubleSide }),
    );
    const nerveHead = track(
      new MeshStandardMaterial({ color: 0xf0cba8, roughness: 0.6, side: DoubleSide }),
    );
    const fibreMap = muscleFibreTexture();
    const muscleBelly = track(
      new MeshStandardMaterial({
        color: 0xb2685c,
        roughness: 0.62,
        bumpMap: fibreMap,
        bumpScale: 0.15,
        side: DoubleSide,
      }),
    );
    const muscleCut = track(
      new MeshStandardMaterial({ color: 0xd49a90, roughness: 0.85, side: DoubleSide }),
    );
    muscleCut.name = "cut";
    const tendon = track(
      new MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.5, side: DoubleSide }),
    );

    const byStructure = new Map<string, Material[]>();
    const set = (id: string, mats: Material[]) => byStructure.set(id, mats);
    set("sclera", [sclera, scleraCut, scleraCut, sclera, sclera, sclera]);
    set("cornea", [cornea]);
    set("iris", [iris, irisCut]);
    set("lens", [lens]);
    set("ciliary_body", [ciliary, ciliaryCut]);
    set("zonules", [zonule]);
    set("retina", [retinaCut, retina, retinaCut, retina, retinaCut, retinaCut]);
    set("choroid", [choroid, choroid, choroidCut, choroid, choroidCut, choroidCut]);
    set("optic_nerve_sheath", [sheath]);
    set("optic_nerve_core", [core]);
    set("nerve_head", [nerveHead]);
    for (const id of ["muscle_medial", "muscle_lateral", "muscle_superior", "muscle_inferior"]) {
      set(id, [muscleBelly, tendon, muscleCut]);
    }
    return byStructure;
  }

  private build(): void {
    const model = loadEyeModel();
    const materials = this.buildMaterials();

    const eyeGroup = new Group();
    eyeGroup.name = "eye";
    this.scene.add(eyeGroup);
    this.eyeGroup = eyeGroup;

    const sliceable = new Set([
      "sclera",
      "cornea",
      "iris",
      "lens",
      "ciliary_body",
      "retina",
      "choroid",
      "optic_nerve_sheath",
      "optic_nerve_core",
      "nerve_head",
      "zonules",
      "muscle_medial",
      "muscle_lateral",
      "muscle_superior",
      "muscle_inferior",
    ]);

    for (const [structure, meshData] of model) {
      const geometry = this.geometryFromMesh(meshData.positions, meshData.uvs, meshData.indices);
      const structureMaterials = materials.get(structure) ?? [];

      // group per contiguous slot run → one material per group
      const slotOrder: string[] = [];
      for (const slot of meshData.slotOfTriangle) {
        if (!slotOrder.includes(slot)) slotOrder.push(slot);
      }
      let scanned = 0;
      while (scanned < meshData.slotOfTriangle.length) {
        const slot = meshData.slotOfTriangle[scanned];
        let count = 0;
        while (scanned + count < meshData.slotOfTriangle.length && meshData.slotOfTriangle[scanned + count] === slot) {
          count++;
        }
        geometry.addGroup(scanned * 3, count * 3, slotOrder.indexOf(slot));
        scanned += count;
      }

      const material: Material | Material[] =
        structureMaterials.length > 1 ? structureMaterials : structureMaterials[0];
      if (sliceable.has(structure)) {
        const mats = Array.isArray(material) ? material : [material];
        for (const m of mats) m.clippingPlanes = [this.sectionPlane];
      }

      const mesh = new Mesh(geometry, material);
      mesh.name = structure;

      const group = new Group();
      group.name = structure;
      group.add(mesh);

      let minX = Infinity;
      let maxX = -Infinity;
      for (let i = 0; i < meshData.positions.length; i += 3) {
        minX = Math.min(minX, meshData.positions[i]);
        maxX = Math.max(maxX, meshData.positions[i]);
      }

      const list = Array.isArray(material) ? material : [material];
      const node: StructureNode = {
        group,
        mesh,
        caps: [],
        cutMaterials: [],
        minX,
        maxX,
        sliceable: sliceable.has(structure),
      };
      if (node.sliceable) {
        // the palest variant in the array is the cut face; caps reuse it so a sliced wall reads
        const cut = list.find((m) => m.name === "cut") ?? list[list.length - 1];
        node.cutMaterials = [cut];
      }
      this.structures.set(structure, node);
      eyeGroup.add(group);
    }

    // Laterality is a mirror transform on the whole group: the model is authored right-eye.
    // Three renders correct winding for negative determinant.
    eyeGroup.scale.x = this.options.eye === "left" ? -1 : 1;

    this.buildVessels();
    this.buildPupilAndLimbus();

    // Lighting: key, fill, rim and a soft anterior fill so the cut bowl reads. All generated.
    const key = new DirectionalLight(0xfff4e6, 2.0);
    key.position.set(2.2, 2.4, 4.4);
    this.scene.add(key);

    const fill = new DirectionalLight(0xc3d6ff, 1.1);
    fill.position.set(-3.2, -1.4, 2.2);
    this.scene.add(fill);

    const rim = new DirectionalLight(0xffffff, 1.1);
    rim.position.set(-1.6, 1.6, -2.6);
    this.scene.add(rim);

    const bowl = new DirectionalLight(0xfff0e2, 0.7);
    bowl.position.set(0.6, 0.4, 3.2);
    this.scene.add(bowl);

    this.scene.add(new AmbientLight(0xffffff, 0.45));
  }

  /** The retina texture is always painted for the authored right eye; laterality is the mirror. */
  private fundusParams(): FundusParams {
    return { ...this.options.fundus, eye: "right" };
  }

  private buildVessels(): void {
    const tubes: VesselTubeMesh = vesselTubesFor(this.fundusParams(), {
      calibre: 1,
      radialSegments: this.tier === "low" ? 5 : this.tier === "medium" ? 6 : 8,
      eye: "right",
    });
    const artery = this.track(
      new MeshStandardMaterial({ color: 0xb2544a, roughness: 0.75, clippingPlanes: [this.sectionPlane] }),
    );
    const vein = this.track(
      new MeshStandardMaterial({ color: 0x8e4040, roughness: 0.8, clippingPlanes: [this.sectionPlane] }),
    );
    // `kind` is per-vertex: a triangle's kind is the kind of its first corner
    for (const kindIndex of [0, 1] as const) {
      const indices: number[] = [];
      for (let t = 0; t < tubes.indices.length / 3; t++) {
        if (tubes.kind[tubes.indices[t * 3]] === kindIndex) {
          indices.push(
            tubes.indices[t * 3],
            tubes.indices[t * 3 + 1],
            tubes.indices[t * 3 + 2],
          );
        }
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(this.toScene(tubes.positions), 3));
      geometry.setAttribute("normal", new BufferAttribute(new Float32Array(tubes.normals), 3));
      geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1));
      const mesh = new Mesh(geometry, kindIndex === 0 ? artery : vein);
      mesh.name = kindIndex === 0 ? "retinal_arteries" : "retinal_veins";
      this.vesselMeshes.push(mesh);
      this.eyeGroup?.add(mesh);
    }
  }

  private buildPupilAndLimbus(): void {
    // Pupil: a real dark disc so it can constrict, sitting at the iris plane.
    const shape = new Shape();
    shape.absarc(0, 0, mm(1), 0, Math.PI * 2, false);
    const pupilGeometry = this.track(new ShapeGeometry(shape, 48));
    const pupilMaterial = this.track(
      new MeshBasicMaterial({ color: 0x05060c, side: DoubleSide }),
    );
    this.pupil = new Mesh(pupilGeometry, pupilMaterial);
    this.pupil.name = "pupil";
    this.pupil.position.z = mm(9.315) - 0.01;
    this.eyeGroup?.add(this.pupil);

    // Limbus: the transition from clear cornea to sclera as a soft band, not an edge.
    const ring = new Shape();
    ring.absarc(0, 0, mm(EYE.limbus.diameter / 2 + EYE.limbus.width / 4), 0, Math.PI * 2, false);
    const hole = new Shape();
    hole.absarc(0, 0, mm(EYE.limbus.diameter / 2 - EYE.limbus.width / 4), 0, Math.PI * 2, true);
    ring.holes.push(hole);
    const limbusGeometry = this.track(new ShapeGeometry(ring, 64));
    const limbusMaterial = this.track(
      new MeshBasicMaterial({
        color: 0x241f28,
        transparent: true,
        opacity: 0.32,
        side: DoubleSide,
        depthWrite: false,
      }),
    );
    this.limbus = new Mesh(limbusGeometry, limbusMaterial);
    this.limbus.name = "limbus";
    this.limbus.position.z = mm(10.42);
    this.eyeGroup?.add(this.limbus);
  }

  /* -------------------------------------------------------------- sections */

  private rebuildCaps(): void {
    const model = loadEyeModel();
    for (const [structure, node] of this.structures) {
      for (const cap of node.caps) {
        node.group.remove(cap);
        cap.geometry.dispose();
      }
      node.caps = [];
      if (!node.sliceable) continue;
      const c = sliceConstant(this.options.slice);
      if (this.options.view !== "cross_section" || c >= node.maxX || c <= node.minX) continue;
      const data = model.get(structure);
      if (!data) continue;
      const plane: SectionPlane = { normal: [1, 0, 0], constant: c };
      const cap = sectionCap(data, plane);
      if (!cap || !cap.indices.length) continue;
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(this.toScene(cap.positions), 3));
      geometry.setIndex(new BufferAttribute(new Uint32Array(cap.indices), 1));
      geometry.computeVertexNormals();
      const cutMaterial = node.cutMaterials[0] ?? node.mesh.material;
      const capMesh = new Mesh(geometry, cutMaterial);
      capMesh.name = `${structure}.cap`;
      capMesh.renderOrder = 1;
      node.group.add(capMesh);
      node.caps.push(capMesh);
    }
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

  /** Live appearance updates — sliders retune materials without rebuilding the scene. */
  setAppearance(options: {
    iris?: IrisParams;
    fundus?: FundusParams;
    scleraVessels?: number;
    eye?: "right" | "left";
  }): void {
    if (options.iris) {
      this.options.iris = options.iris;
      const irisNode = this.structures.get("iris");
      const irisMaterials = Array.isArray(irisNode?.mesh.material) ? irisNode!.mesh.material : [];
      const map = irisTexture(options.iris, TIERS[this.tier].textureSize, () => this.renderOnce());
      const target = irisMaterials.find((m) => (m as MeshStandardMaterial).map !== undefined);
      if (target) {
        (target as MeshStandardMaterial).map = map ?? null;
        (target as MeshStandardMaterial).needsUpdate = true;
      }
      // the pupil follows the iris params' live pupilMm (which the studio derives from light)
      this.targetPupil = pupilRadiusMm(options.iris);
    }
    if (options.fundus) {
      this.options.fundus = options.fundus;
      const retinaNode = this.structures.get("retina");
      const retinaMaterials = Array.isArray(retinaNode?.mesh.material) ? retinaNode!.mesh.material : [];
      const map = fundusTexture(this.fundusParams(), TIERS[this.tier].textureSize);
      const target = retinaMaterials.find((m) => (m as MeshStandardMaterial).map !== undefined);
      if (target) {
        (target as MeshStandardMaterial).map = map ?? null;
        (target as MeshStandardMaterial).needsUpdate = true;
      }
    }
    if (options.scleraVessels !== undefined) {
      this.options.scleraVessels = options.scleraVessels;
      const scleraNode = this.structures.get("sclera");
      const scleraMaterials = Array.isArray(scleraNode?.mesh.material) ? scleraNode!.mesh.material : [];
      const map = scleraTexture(options.scleraVessels, TIERS[this.tier].textureSize);
      const target = scleraMaterials.find((m) => (m as MeshStandardMaterial).map !== undefined);
      if (target) {
        (target as MeshStandardMaterial).map = map ?? null;
        (target as MeshStandardMaterial).needsUpdate = true;
      }
    }
    if (options.eye) {
      this.options.eye = options.eye;
      if (this.eyeGroup) this.eyeGroup.scale.x = options.eye === "left" ? -1 : 1;
    }
    this.renderOnce();
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
      exterior: ["*"],
      cross_section: ["*"],
      cornea: ["cornea", "iris", "pupil", "lens", "limbus", "ciliary_body", "zonules"],
      fundus: ["retina", "retinal_arteries", "retinal_veins", "nerve_head"],
    };
    const list = visible[view];
    for (const [name, node] of this.structures) {
      node.group.visible = list.includes("*") || list.includes(name);
    }
    for (const vessel of this.vesselMeshes) {
      vessel.visible = list.includes("*") || list.includes(vessel.name);
    }
    if (this.pupil) this.pupil.visible = list.includes("*") || list.includes("pupil");
    if (this.limbus) this.limbus.visible = list.includes("*") || list.includes("limbus");

    // Fixed framings from the anatomy. The cutaway's yaw puts the kept (nasal) bowl towards
    // the viewer with the cornea to the opposite screen side; the mirror follows laterality.
    const yaw = this.options.eye === "left" ? 0.95 : -0.95;
    this.rotationTarget = {
      x: view === "cross_section" ? 0.12 : 0,
      y: view === "cross_section" ? yaw : view === "cornea" ? yaw * 0.4 : 0,
    };
    if (this.options.reducedMotion) this.eyeGroup?.rotation.set(this.rotationTarget.x, this.rotationTarget.y, 0);
    const distance =
      view === "cornea" ? 5.4 : view === "fundus" ? 3.4 : view === "cross_section" ? 5.6 : 7.2;
    this.camera.position.set(
      view === "fundus" ? 0.5 : 0,
      view === "fundus" ? 0.3 : 0,
      distance,
    );
    this.camera.lookAt(view === "fundus" ? 0 : 0, view === "fundus" ? 0 : 0, view === "fundus" ? -1.0 : 0);
    this.rebuildCaps();
    if (!this.options.reducedMotion) this.start();
  }

  setSlice(value: number): void {
    this.options.slice = Math.max(0, Math.min(1, value));
    const active = this.options.view === "cross_section";
    this.sectionPlane.normal.set(-1, 0, 0);
    this.sectionPlane.constant = active ? sliceConstant(this.options.slice) : 1e6;
    this.rebuildCaps();
    this.renderOnce();
  }

  setSeparation(value: number): void {
    this.options.separation = Math.max(0, Math.min(1, value));
    const order: Record<string, number> = {
      cornea: 1,
      limbus: 0.95,
      iris: 0.75,
      pupil: 0.75,
      lens: 0.5,
      zonules: 0.35,
      ciliary_body: 0.3,
    };
    for (const [name, node] of this.structures) {
      const factor = order[name];
      if (factor === undefined) continue;
      const apply = this.options.view === "cross_section" || this.options.view === "cornea";
      node.group.position.z = apply ? factor * this.options.separation * mm(EYE.anteriorChamber.depth) * 2 : 0;
    }
    if (this.pupil) {
      this.pupil.position.z =
        mm(9.315) - 0.01 + (order.pupil ?? 0) * this.options.separation * mm(EYE.anteriorChamber.depth) * 2;
    }
    if (this.limbus) {
      this.limbus.position.z =
        mm(10.42) + (order.limbus ?? 0) * this.options.separation * mm(EYE.anteriorChamber.depth) * 2;
    }
    this.renderOnce();
  }

  setZoom(value: number): void {
    this.camera.zoom = Math.max(0.7, Math.min(1.6, value));
    this.camera.updateProjectionMatrix();
    this.renderOnce();
  }

  private updatePupil(): void {
    if (this.pupil) this.pupil.scale.setScalar(this.currentPupil / 2);
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
