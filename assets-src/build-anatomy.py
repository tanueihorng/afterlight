#!/usr/bin/env python3
"""Author the original anatomical eye in Blender, export browser assets, render studies.

Run: blender --background --python assets-src/build-anatomy.py

The single authoring pass for the neutral anatomical model:

1. Executes build-eye.py in-process, preserving the iris sculpt and its Cycles bakes.
2. Builds every static structure from the same parameter data the browser uses
   (assets-src/generated/params.json, written by app/scripts/anatomy/export-anatomy-data.mjs).
   Every solid is assembled from regular grid patches whose shared border rows carry identical
   coordinates, so the model is watertight after welding, wall thickness is real geometry, and
   every cut edge can be capped. Openings (limbus, canal, disc) are built into the grids — no
   booleans in exported geometry, so the browser can regenerate indices from rows×cols.
3. Validates topology: watertight solids, finite coordinates, outward winding.
4. Exports quantised grid vertices for the browser: app/src/engine/assets/anatomy.bin plus
   anatomy.json (per-part rows/cols/bbox/offset). Positions and UVs only — the browser
   generates indices, welds coincident vertices and computes normals itself.
5. Saves the editable scene (named collections, four cameras) to assets-src/eye.blend and
   renders four studies into assets-src/renders/.

Axes match the browser: +Z anterior (cornea), -Z posterior, +Y superior, +X nasal (right eye).
Units are millimetres throughout (scene scale 0.001).

Neutral only: colour, pupil size, vessel density, laterality and every condition delta stay
runtime parameters. Nothing here is a patient's anatomy.
"""

import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Quaternion, Vector

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "app/src/engine/assets"
GENERATED = ROOT / "assets-src/generated"
RENDERS = ROOT / "assets-src/renders"

import json

PARAMS = json.loads((GENERATED / "params.json").read_text())
EYE = PARAMS["EYE"]
MODEL = PARAMS.get("model", {})
VESSELS = json.loads((GENERATED / "vessels-default.json").read_text())

TAU = math.tau

# Modelled as a sphere of the axial radius rather than the slight 23.5/23.0 ellipsoid: the ~2%
# asymmetry is invisible, and a circular limbus is what every anterior measurement and the
# existing anteriorSurface() arithmetic assume. Recorded in docs/eye-realism/anatomy-contract.md.
R_GLOBE = EYE["axialLength"] / 2
R_LIMBUS = EYE["limbus"]["diameter"] / 2
LIMBUS_ANGLE = math.asin(R_LIMBUS / R_GLOBE)

T_POST = EYE["sclera"]["thicknessPosterior"]
T_EQ = EYE["sclera"]["thicknessEquator"]
T_LIM = EYE["sclera"]["thicknessLimbal"]
T_CHOROID = EYE["choroid"]["thickness"] * MODEL.get("choroidMagnification", 3)  # illustrative, labelled
T_RETINA = EYE["retina"]["thickness"]

# Concentric shell radii about the globe centre.
R_SCL_IN_EQ = R_GLOBE - T_EQ
R_CH_OUT = R_GLOBE - T_POST
R_CH_IN = R_CH_OUT - T_CHOROID
R_RET_OUT = R_CH_IN
R_RET_IN = R_RET_OUT - T_RETINA

THETA_ORA = LIMBUS_ANGLE + EYE["retina"]["oraBehindLimbus"] / R_GLOBE

DISC = Vector(VESSELS["disc3d"])
DISC_DIR = DISC.normalized()
CANAL_R = EYE["nerve"]["canalDiameter"] / 2

COLLECTIONS = {}


def col(name):
    if name not in COLLECTIONS:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
        COLLECTIONS[name] = c
    return COLLECTIONS[name]


# ------------------------------------------------------------------ grid kit
#
# A Grid is a regular rows×cols vertex lattice. wrap=True means column i and column 0 are the
# same ring continued (cols points, faces wrap); wrap=False means the grid carries an explicit
# duplicated seam column (cols points per ring, u 0..1). A Solid is a list of parts whose
# shared border rows hold identical coordinates, so welding makes one continuous skin.

class Grid:
    def __init__(self, rows, cols, point, uv, slot, wrap=True, wrap_rows=False):
        self.rows, self.cols, self.slot, self.wrap = rows, cols, slot, wrap
        self.wrap_rows = wrap_rows
        self.verts = []
        self.uvs = []
        for j in range(rows):
            for i in range(cols):
                p = point(j, i)
                if not all(math.isfinite(c) for c in p):
                    raise AssertionError(f"non-finite vertex at row {j} col {i} of {slot}")
                self.verts.append(tuple(p))
                self.uvs.append(tuple(uv(j, i)))

    def row(self, j):
        return self.verts[j * self.cols:(j + 1) * self.cols]

    def faces(self, offset):
        out = []
        span = self.cols if self.wrap else self.cols - 1
        rows = self.rows if self.wrap_rows else self.rows - 1
        for j in range(rows):
            j2 = (j + 1) % self.rows if self.wrap_rows else j + 1
            for i in range(span):
                i2 = (i + 1) % self.cols if self.wrap else i + 1
                n0 = offset + j * self.cols + i
                out.append((n0, offset + j * self.cols + i2,
                            offset + j2 * self.cols + i2,
                            offset + j2 * self.cols + i))
        return out


def sphere_grid(theta0, theta1, radius, rows, cols, slot, fundus_r=None):
    """Grid on a sphere about the Z axis (theta from the +Z anterior axis). radius may be a
    callable of theta. fundus_r: if set, UVs are the fundus painter's mapping at that radius."""
    def point(j, i):
        theta = theta0 + (theta1 - theta0) * j / (rows - 1)
        phi = TAU * i / cols
        r = radius(theta) if callable(radius) else radius
        return (r * math.sin(theta) * math.cos(phi),
                r * math.sin(theta) * math.sin(phi),
                r * math.cos(theta))
    # cols segments -> cols+1 points (explicit seam column)

    if fundus_r is not None:
        def uv(j, i):
            x, y, _ = point(j, i)
            return (0.5 + x / (2 * fundus_r), 0.5 + y / (2 * fundus_r))
    else:
        def uv(j, i):
            return (i / cols, j / (rows - 1))
    return Grid(rows, cols + 1, point, uv, slot, wrap=False)


def disc_polar_grid(alpha0, alpha1, radius, rows, cols, slot, ring=None):
    """Grid on a sphere about the disc axis (alpha from DISC_DIR, in the posterior region).
    radius may be a callable of the point's angle from the posterior pole. If `ring` is given,
    the last row is that exact ring (shared border with a main grid)."""
    side = Vector((0, 0, 1)).cross(DISC_DIR).normalized()
    up = DISC_DIR.cross(side).normalized()

    def point(j, i):
        if ring is not None and j == rows - 1:
            return tuple(ring[i])
        alpha = alpha0 + (alpha1 - alpha0) * j / (rows - 1)
        phi = TAU * i / cols
        d = (math.cos(alpha) * DISC_DIR +
             math.sin(alpha) * (math.cos(phi) * side + math.sin(phi) * up))
        if callable(radius):
            theta_pole = math.acos(max(-1.0, min(1.0, -d.z)))
            return tuple(d * radius(theta_pole))
        return tuple(d * radius)

    return Grid(rows, cols + 1, point, lambda j, i: (i / cols, j / (rows - 1)), slot, wrap=False)


def ring_strip(ring_a, ring_b, slot, wrap):
    """2×n strip joining two border rings (a rim wall between two surfaces)."""
    assert len(ring_a) == len(ring_b)
    return Grid(2, len(ring_a), lambda j, i: ring_a[i] if j == 0 else ring_b[i],
                lambda j, i: (i / len(ring_a), j), slot, wrap=wrap)


def flat_cap(ring, centre, slot, wrap):
    """2×n disc: perimeter ring + a centre row (identical coordinates weld to one vertex)."""
    return Grid(2, len(ring), lambda j, i: ring[i] if j == 0 else centre,
                lambda j, i: (i / len(ring), j), slot, wrap=wrap)


def revolve_grid(profile, cols, slot, radial_uv_rows=None):
    """Revolve a closed 2D (rho, z) profile about Z. rows follow the profile points in order;
    the loop closes because the last point repeats the first. radial_uv_rows=(row0, row1,
    rho0, rho1) remaps v linearly in rho over that row span (the iris painter's convention)."""
    rows = len(profile)
    total = sum(math.hypot(profile[(k + 1) % rows][0] - profile[k][0],
                           profile[(k + 1) % rows][1] - profile[k][1]) for k in range(rows))
    r0, r1, rho0, rho1 = radial_uv_rows or (None, None, None, None)

    def point(j, i):
        rho, z = profile[j]
        a = TAU * i / cols
        return (rho * math.cos(a), rho * math.sin(a), z)

    def uv(j, i):
        if r0 is not None and r0 <= j <= r1:
            rho = profile[j][0]
            return (i / cols, max(0.0, min(1.0, (rho - rho0) / (rho1 - rho0))))
        acc = 0.0
        for k in range(j):
            acc += math.hypot(profile[(k + 1) % rows][0] - profile[k][0],
                              profile[(k + 1) % rows][1] - profile[k][1])
        return (i / cols, acc / total)

    return Grid(rows, cols, point, uv, slot, wrap=True, wrap_rows=True)


class Solid:
    def __init__(self, name, parts, collection, row_slots=None):
        self.name = name
        self.parts = parts
        self.collection = collection
        self.row_slots = row_slots or {}

    def object(self):
        verts, faces, uvs = [], [], []
        slot_ids = list(dict.fromkeys(part.slot for part in self.parts))
        for part in self.parts:
            offset = len(verts)
            verts += part.verts
            uvs += part.uvs
            part_faces = part.faces(offset)
            faces += part_faces
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        uv = mesh.uv_layers.new(name="uv")
        # stamp the slot index per polygon now: mesh.update() may drop degenerate faces, so
        # positions shift, but material_index travels with each polygon
        slot_index = {s: i for i, s in enumerate(slot_ids)}
        for part in self.parts:
            pass
        polygons = mesh.polygons
        fi = 0
        for part in self.parts:
            n = len(part.faces(0))
            for k in range(n):
                if fi + k < len(polygons):
                    polygons[fi + k].material_index = slot_index[part.slot]
            fi += n
        for polygon in polygons:
            polygon.use_smooth = True
            for loop in polygon.loop_indices:
                uv.data[loop].uv = uvs[mesh.loops[loop].vertex_index]
        obj = bpy.data.objects.new(self.name, mesh)
        col(self.collection).objects.link(obj)
        obj["_slot_ids"] = " ".join(slot_ids)
        return obj

    def apply_slot_materials(self, materials):
        """Swap the material slots to match the per-polygon slot indices stamped at build."""
        obj = bpy.data.objects[self.name]
        slot_ids = obj.get("_slot_ids", "").split()
        if not slot_ids:
            return
        obj.data.materials.clear()
        for slot in slot_ids:
            obj.data.materials.append(materials[slot])


def finalize(obj, name, open_ok=False):
    """Weld, make normals consistent and outward, and validate."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-4)
    bm.faces.ensure_lookup_table()
    for v in bm.verts:
        assert all(math.isfinite(c) for c in v.co), f"{name}: non-finite vertex"
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    boundary = sum(1 for e in bm.edges if len(e.link_faces) == 1)
    if not open_ok:
        assert boundary == 0, f"{name}: {boundary} boundary edges (not watertight)"
    volume = bm.calc_volume(signed=True)
    if not open_ok:
        assert volume > 0, f"{name}: zero or negative volume ({volume:.4f})"
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return volume


# ------------------------------------------------------------------ sclera

def sclera_thickness(theta):
    """Outer-surface polar angle (0 at limbus, π at posterior pole) → wall thickness."""
    if theta < math.pi / 2:
        f = theta / (math.pi / 2)
        return T_LIM + (T_EQ - T_LIM) * f
    f = (theta - math.pi / 2) / (math.pi / 2)
    return T_EQ + (T_POST - T_EQ) * f


def build_sclera(cols=96, rows_main=56, cap_rows=10):
    theta_plug = math.pi - 0.10

    def r_in(theta):
        return R_GLOBE - sclera_thickness(theta)

    main_out = sphere_grid(LIMBUS_ANGLE, theta_plug, R_GLOBE, rows_main, cols, "sclera_outer")
    main_in = sphere_grid(LIMBUS_ANGLE, theta_plug, r_in, rows_main, cols, "sclera_inner")
    ring_out = main_out.row(rows_main - 1)
    ring_in = main_in.row(rows_main - 1)
    cap_out = polar_cap(ring_out, R_GLOBE, math.asin(CANAL_R / R_GLOBE), cap_rows, "sclera_outer")
    cap_in = polar_cap(ring_in, lambda theta_pole: r_in(math.pi - theta_pole),
                       math.asin(CANAL_R / R_SCL_IN_EQ), cap_rows, "sclera_inner")
    rim = ring_strip(main_out.row(0), main_in.row(0), "sclera_cut", wrap=False)
    canal_wall = ring_strip(cap_out.row(0), cap_in.row(0), "sclera_cut", wrap=False)
    solid = Solid("sclera", [main_out, cap_out, main_in, cap_in, rim, canal_wall], "Globe")
    volume = finalize(solid.object(), "sclera")
    print(f"sclera watertight, volume {volume / 1000:.2f} ml", flush=True)
    return solid


# ------------------------------------------------------------------ anterior

def corneal_sag(rho, R, Q):
    return rho ** 2 / (R * (1 + math.sqrt(max(1e-9, 1 - (1 + Q) * (rho / R) ** 2))))


def build_cornea(cols=80):
    R_a = EYE["cornea"]["anteriorRadius"]
    Q_a = EYE["cornea"]["Q"]
    t_c = EYE["cornea"]["centralThickness"]
    t_p = EYE["cornea"]["peripheralThickness"]
    R_p = EYE["cornea"]["posteriorRadius"]
    rho_l = R_LIMBUS

    lo, hi = -1.8, 0.0
    for _ in range(64):
        Q_p = (lo + hi) / 2
        gap = corneal_sag(rho_l, R_p, Q_p) - corneal_sag(rho_l, R_a, Q_a) + t_c
        if gap > t_p:
            hi = Q_p
        else:
            lo = Q_p
    Q_p = (lo + hi) / 2
    apex_z = math.sqrt(R_GLOBE ** 2 - rho_l ** 2) + corneal_sag(rho_l, R_a, Q_a)
    print(f"cornea: posterior conic Q={Q_p:+.3f} solved for {t_p} mm peripheral thickness", flush=True)

    steps = 40
    ant = [(rho_l * j / steps, apex_z - corneal_sag(rho_l * j / steps, R_a, Q_a)) for j in range(steps + 1)]
    post_apex = apex_z - t_c
    post = [(rho_l * j / steps, post_apex - corneal_sag(rho_l * j / steps, R_p, Q_p))
            for j in range(steps, 0, -1)]
    profile = ant + post  # ant[-1]→post[0] is the limbal wall; the loop closes
    grid = revolve_grid(profile, cols, "cornea")
    solid = Solid("cornea", [grid], "Globe")
    finalize(solid.object(), "cornea")
    return solid, apex_z


def build_iris(cols=128):
    rho_p, rho_root = 0.7, R_LIMBUS
    apex_z = math.sqrt(R_GLOBE ** 2 - rho_root ** 2)
    z_root = apex_z - EYE["cornea"]["centralThickness"] - EYE["anteriorChamber"]["depth"]
    z_limbus = apex_z - corneal_sag(rho_root, EYE["cornea"]["anteriorRadius"], EYE["cornea"]["Q"])
    th = EYE["iris"]["thickness"]
    steps = 16
    ant = [(rho_p + (rho_root - rho_p) * j / steps,
            z_root + (z_limbus - z_root) * (j / steps) ** 0.8) for j in range(steps + 1)]
    post = [(ant[j][0], ant[j][1] - th * (1 - 0.4 * j / steps)) for j in range(steps, 0, -1)]
    profile = ant + post
    grid = revolve_grid(profile, cols, "iris_front", radial_uv_rows=(0, steps, rho_p, rho_root))
    solid = Solid("iris", [grid], "Anterior")
    finalize(solid.object(), "iris")
    return solid, z_root


def build_lens(cols=64):
    d = EYE["lens"]["diameter"] / 2
    thickness = EYE["lens"]["thickness"]
    R_a = EYE["lens"]["anteriorRadius"]
    R_p = -EYE["lens"]["posteriorRadius"]

    def solve_q(R, target):
        lo, hi = -0.95, 40.0
        for _ in range(90):
            q = (lo + hi) / 2
            if corneal_sag(d, R, q) < target:
                lo = q
            else:
                hi = q
        return (lo + hi) / 2

    share_a = R_a * (1 - math.sqrt(1 - (d / R_a) ** 2))
    share_p = R_p * (1 - math.sqrt(1 - (d / R_p) ** 2))
    sag_a = thickness * share_a / (share_a + share_p)
    sag_p = thickness - sag_a
    Q_a = solve_q(R_a, sag_a)
    Q_p = solve_q(R_p, sag_p)
    print(f"lens: Q_a={Q_a:+.2f} Q_p={Q_p:+.2f} solved for Ø{d * 2} × {thickness} mm", flush=True)

    steps = 32
    ant = [(d * j / steps, sag_a - corneal_sag(d * j / steps, R_a, Q_a)) for j in range(steps + 1)]
    post = [(d * j / steps, -sag_p + corneal_sag(d * j / steps, R_p, Q_p)) for j in range(steps, 0, -1)]
    profile = ant + post
    grid = revolve_grid(profile, cols, "lens")
    solid = Solid("lens", [grid], "Anterior")
    obj = solid.object()
    return solid, obj, sag_a


def iris_plane_z():
    rho_root = R_LIMBUS
    apex_z = math.sqrt(R_GLOBE ** 2 - rho_root ** 2)
    return apex_z - EYE["cornea"]["centralThickness"] - EYE["anteriorChamber"]["depth"]


def build_ciliary(cols=72):
    r_ora = R_RET_OUT * math.sin(THETA_ORA)
    z_ora = R_RET_OUT * math.cos(THETA_ORA)
    r_root = R_LIMBUS - 0.15
    z_root = iris_plane_z() - 0.1
    # closed triangular cross-section: anterior face, inner slope to the ora, outer corner
    # against the sclera, back up the outer face
    profile = [(r_root, z_root),
               ((r_root + r_ora) / 2 + 0.4, (z_root + z_ora) / 2),
               (r_ora, z_ora),
               (r_ora + 1.3, z_ora - 0.35),
               (r_root + 0.55, z_root - 1.1),
               (r_root, z_root)]
    grid = revolve_grid(profile, cols, "ciliary_body")
    solid = Solid("ciliary_body", [grid], "Anterior")
    finalize(solid.object(), "ciliary_body")
    return solid


def build_zonules(n=36):
    r_cb = R_RET_OUT * math.sin(THETA_ORA) * 0.94
    z_cb = R_RET_OUT * math.cos(THETA_ORA) + 0.9
    lens_eq_z = iris_plane_z() - 0.12 - EYE["lens"]["thickness"] / 2
    parts = []
    for k in range(n):
        a = TAU * k / n + math.sin(k * 2.3) * 0.1
        p0 = Vector((r_cb * math.cos(a), r_cb * math.sin(a), z_cb))
        r_l = EYE["lens"]["diameter"] / 2 - 0.1
        p2 = Vector((r_l * math.cos(a), r_l * math.sin(a), lens_eq_z))
        p1 = (p0 + p2) / 2 + Vector((0, 0, -0.5))
        body, caps = open_tube([p0, p1, p2], [0.032, 0.032, 0.032], sides=5, slot="zonules")
        parts += body + caps
    solid = Solid("zonules", parts, "Anterior")
    finalize(solid.object(), "zonules", open_ok=True)
    return solid


def open_tube(path, radii, sides=12, slot="body"):
    """Tube along a polyline with flat disc caps at both ends. Returns (body_grid, caps)."""
    pts = [Vector(p) for p in path]
    n = len(pts)
    up = Vector((0, 0, 1))
    rings = []
    for j, p in enumerate(pts):
        tangent = (pts[min(j + 1, n - 1)] - pts[max(j - 1, 0)]).normalized()
        if abs(tangent.dot(up)) > 0.95:
            up = Vector((0, 1, 0))
        side = tangent.cross(up).normalized()
        up2 = side.cross(tangent).normalized()
        rings.append([tuple(p + side * (math.cos(TAU * i / sides) * radii[j]) +
                            up2 * (math.sin(TAU * i / sides) * radii[j])) for i in range(sides)])
    body = Grid(n, sides, lambda j, i: rings[j][i],
                lambda j, i: (i / sides, j / (n - 1)), slot, wrap=True)
    start_cap = flat_cap(rings[0], tuple(pts[0]), slot, wrap=True)
    end_cap = flat_cap(list(reversed(rings[-1])), tuple(pts[-1]), slot, wrap=True)
    return [body], [start_cap, end_cap]


# ------------------------------------------------------------------ posterior shells

def polar_cap(ring, radius, alpha0, rows, slot, fundus_r=None):
    """Grid from a circular hole rim (alpha0 about the disc axis) out to a shared border ring.
    Each column slerps on the sphere from its rim direction to its ring direction, so the cap
    meets the main grid exactly at the border and never sweeps across occupied surface —
    overlapping sweeps are what made the EXACT boolean collapse the shells to nothing."""
    cols = len(ring) - 1  # segments across the ring
    side = Vector((0, 0, 1)).cross(DISC_DIR).normalized()
    up = DISC_DIR.cross(side).normalized()

    def rim_dir(i):
        phi = TAU * i / cols
        return (math.cos(alpha0) * DISC_DIR +
                math.sin(alpha0) * (math.cos(phi) * side + math.sin(phi) * up)).normalized()

    def direction(j, i):
        if j == rows - 1:
            return Vector(ring[i]).normalized()
        f = j / (rows - 1)
        a, b = rim_dir(i), Vector(ring[i]).normalized()
        dot = max(-1.0, min(1.0, a.dot(b)))
        omega = math.acos(dot)
        if omega < 1e-6:
            return a
        sa = math.sin((1 - f) * omega) / math.sin(omega)
        sb = math.sin(f * omega) / math.sin(omega)
        return (a * sa + b * sb).normalized()

    def point(j, i):
        d = direction(j, i)
        if callable(radius):
            theta_pole = math.acos(max(-1.0, min(1.0, -d.z)))
            return tuple(d * radius(theta_pole))
        return tuple(d * radius)

    if fundus_r is not None:
        def uv(j, i):
            x, y, _ = point(j, i)
            return (0.5 + x / (2 * fundus_r), 0.5 + y / (2 * fundus_r))
    else:
        def uv(j, i):
            return (i / (cols + 1), j / (rows - 1))
    return Grid(rows, cols + 1, point, uv, slot, wrap=False)


def build_shell(name, r_out, r_in, hole_r, slot, fundus=False, cols=96, rows=56):
    """Double-walled bowl from the ora over the posterior pole, polar caps leaving a hole of
    hole_r at the disc. Parts: outer main+cap, inner main+cap, ora rim, hole wall."""
    theta_plug = math.pi - 0.10
    main_out = sphere_grid(THETA_ORA, theta_plug, r_out, rows, cols, "cut")
    main_in = sphere_grid(THETA_ORA, theta_plug, r_in, rows, cols, slot,
                          fundus_r=(R_RET_IN if fundus else None))
    ring_out = main_out.row(rows - 1)
    ring_in = main_in.row(rows - 1)
    a_out = max(math.acos(max(-1.0, min(1.0, Vector(v).normalized().dot(DISC_DIR)))) for v in ring_out)
    a_in = max(math.acos(max(-1.0, min(1.0, Vector(v).normalized().dot(DISC_DIR)))) for v in ring_in)
    r_out_hole = math.asin(min(1.0, hole_r / (r_out(0.0) if callable(r_out) else r_out)))
    r_in_hole = math.asin(min(1.0, hole_r / (r_in(0.0) if callable(r_in) else r_in)))
    cap_out = polar_cap(ring_out, r_out, r_out_hole, 10, "cut")
    cap_in = polar_cap(ring_in, r_in, r_in_hole, 10, slot,
                       fundus_r=(R_RET_IN if fundus else None))
    ora_rim = ring_strip(main_out.row(0), main_in.row(0), "cut", wrap=False)
    hole_wall = ring_strip(cap_out.row(0), cap_in.row(0), "cut", wrap=False)
    solid = Solid(name, [main_out, cap_out, main_in, cap_in, ora_rim, hole_wall],
                  "Retina")
    finalize(solid.object(), name)
    return solid


def build_nerve_head(rows=10, cols_n=48):
    """Shallow dome filling the retinal disc opening: rises into the vitreous with a slight
    physiological cup at its centre."""
    centre = DISC_DIR * R_RET_IN
    side = Vector((0, 0, 1)).cross(DISC_DIR).normalized()
    up = DISC_DIR.cross(side).normalized()
    R = CANAL_R + 0.12

    def point(j, i):
        f = j / (rows - 1)
        rho = R * (1 - f)
        rise = 0.25 * math.sin(f * math.pi) - 0.12 * math.exp(-(((1 - f) / 0.22) ** 2))
        a = TAU * i / cols_n
        return tuple(centre + side * (math.cos(a) * rho) + up * (math.sin(a) * rho)
                     - DISC_DIR * rise)

    grid = Grid(rows, cols_n + 1, point, lambda j, i: (i / cols_n, j / (rows - 1)),
                "nerve_head", wrap=False)
    base_ring = [point(0, i) for i in range(cols_n + 1)]
    cap = flat_cap(base_ring, tuple(centre + DISC_DIR * 0.18), "nerve_head", wrap=False)
    solid = Solid("nerve_head", [grid, cap], "Retina")
    finalize(solid.object(), "nerve_head")
    return solid


# ------------------------------------------------------------------ nerve & muscles

def build_nerve():
    r_canal = DISC.length
    apex_s = EYE["muscles"]["apexBehindCentre"] + 9.0  # the nerve continues past the annulus
    perp = Vector((0, 0, 1)).cross(DISC_DIR).normalized()
    n = 24

    def path(s0, s1):
        pts = []
        for j in range(n + 1):
            t = j / n
            s = s0 + (s1 - s0) * t
            pts.append(DISC_DIR * s + perp * (1.1 * math.sin(t * math.pi)))
        return pts

    sheath_r0 = EYE["nerve"]["sheathDiameterAtGlobe"] / 2
    sheath_r1 = EYE["nerve"]["sheathDiameterDistal"] / 2
    sheath_body, sheath_caps = open_tube(
        path(R_GLOBE + 0.3, apex_s),
        [sheath_r0 + (sheath_r1 - sheath_r0) * (j / n) for j in range(n + 1)],
        sides=24, slot="optic_nerve_sheath")
    core_r = EYE["nerve"]["coreDiameter"] / 2
    core_body, core_caps = open_tube(
        path(r_canal * 0.96, apex_s - 1.8),
        [core_r * (0.5 + 0.5 * min(1.0, j / n * 5)) for j in range(n + 1)],
        sides=20, slot="optic_nerve_core")
    sheath_solid = Solid("optic_nerve_sheath", sheath_body + sheath_caps, "Nerve")
    core_solid = Solid("optic_nerve_core", core_body + core_caps, "Nerve")
    for s in (sheath_solid, core_solid):
        finalize(s.object(), s.name)
    return sheath_solid, core_solid


MUSCLE_DIRS = {
    "medial": Vector((1, 0, 0)),
    "lateral": Vector((-1, 0, 0)),
    "superior": Vector((0, 1, 0)),
    "inferior": Vector((0, -1, 0)),
}


def build_muscles():
    ins = EYE["muscles"]["insertionBehindLimbus"]
    widths = EYE["muscles"]["bellyWidth"]
    tendons = EYE["muscles"]["tendonLength"]
    apex_c = DISC_DIR * EYE["muscles"]["apexBehindCentre"]
    ring_r = EYE["muscles"]["apexRingRadius"]
    th_full = EYE["muscles"]["bellyThickness"]
    solids = []
    for name, dvec in MUSCLE_DIRS.items():
        theta_ins = LIMBUS_ANGLE + ins[name] / R_GLOBE
        centre_ins = Vector((dvec.x * (R_GLOBE * math.sin(theta_ins) + 0.1),
                             dvec.y * (R_GLOBE * math.sin(theta_ins) + 0.1),
                             R_GLOBE * math.cos(theta_ins)))
        perp = (dvec - DISC_DIR * dvec.dot(DISC_DIR)).normalized()
        origin = apex_c + perp * ring_r
        n = 44
        length = (origin - centre_ins).length
        w = widths[name]
        tendon = tendons[name]
        pts, widths_at, thick_at = [], [], []
        for j in range(n + 1):
            t = j / n
            s = t * length
            pts.append(origin.lerp(centre_ins, t))
            if s > length - tendon:
                f = (s - (length - tendon)) / tendon
                widths_at.append(w)
                thick_at.append(th_full * (1 - 0.85 * f) + 0.3 * 0.85 * f)
            else:
                ramp = min(1.0, s / (length * 0.15))
                widths_at.append(w * (0.5 + 0.5 * ramp))
                thick_at.append(th_full)
        sides = 16
        rings = []
        for j, p in enumerate(pts):
            tangent = (pts[min(j + 1, n)] - pts[max(j - 1, 0)]).normalized()
            radial = p.normalized()
            side = radial.cross(tangent).normalized()
            up2 = tangent.cross(side).normalized()
            ring = []
            for i in range(sides):
                a = TAU * i / sides
                c, s = math.cos(a), math.sin(a)
                e = 3.2
                cs = math.copysign(abs(c) ** (2 / e), c)
                ss = math.copysign(abs(s) ** (2 / e), s)
                pos = Vector(p) + side * (cs * widths_at[j] / 2) + up2 * (ss * thick_at[j] / 2)
                t = j / n
                if t > 0.92:  # wrap the tendon foot onto the globe wall
                    f = (t - 0.92) / 0.08
                    pos = pos * (1 - f) + pos.normalized() * (R_GLOBE + 0.12) * f
                ring.append(tuple(pos))
            rings.append(ring)
        body = Grid(n + 1, sides, lambda j, i: rings[j][i],
                    lambda j, i: (i / sides, j / n), "muscle_belly", wrap=True)
        tendon_start = next(j for j in range(n + 1) if (j / n) * length > length - tendon)
        start_cap = flat_cap(rings[0], tuple(pts[0]), "muscle_belly", wrap=True)
        end_cap = flat_cap(list(reversed(rings[-1])), tuple(pts[-1]), "muscle_tendon", wrap=True)
        solid = Solid(f"muscle_{name}", [body, start_cap, end_cap], "Muscles",
                      row_slots={"muscle_tendon": (tendon_start, n)})
        finalize(solid.object(), solid.name)
        solids.append(solid)
    return solids


def build_vessels():
    """Study-only geometry from the shared tree. The browser regrows these at runtime from
    vessels.ts; this is the same data for the Blender study, never a bake of severity."""
    r_surface = VESSELS["retinaInnerRadiusMm"]
    for k, seg in enumerate(VESSELS["segments"]):
        pts = seg["points"]
        if len(pts) < 2:
            continue
        lifted = [tuple(Vector(p).normalized() * (r_surface + 0.05 + 0.04 * min(1.0, seg["depth"] / 3)))
                  for p in pts]
        w = max(0.025, seg["widthMm"] / 2)
        radii = [max(0.012, w * (1 - 0.55 * (j / (len(pts) - 1)))) for j in range(len(pts))]
        kind = seg["kind"]
        body, caps = open_tube(lifted, radii, sides=6, slot=kind)
        solid = Solid(f"vessel_{kind}_{k}", body + caps, "Vessels")
        finalize(solid.object(), solid.name, open_ok=True)


# ------------------------------------------------------------------ studio

def studio():
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Neutral studio")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.055, 0.065, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    scene.world = world

    def area(name, loc, size, power, color=(1, 1, 1), target=None):
        bpy.ops.object.light_add(type="AREA", location=loc)
        light = bpy.context.active_object
        light.name = name
        light.data.size = size
        light.data.energy = power
        light.data.color = color
        light.visible_camera = False
        direction = Vector(target) - Vector(loc) if target else -Vector(loc)
        light.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        col("Studio").objects.link(light)
        return light

    area("key", (30, 26, 44), 40, 4200, (1.0, 0.97, 0.92))
    area("fill", (-42, -16, 18), 55, 5200, (0.85, 0.9, 1.0))
    area("rim", (-16, 20, -44), 30, 1600)
    # a soft light through the anterior opening so the cut bowl and retina studies read;
    # studio apparatus, not anatomy
    area("bowl", (0, 2, 26), 30, 3600, (1.0, 0.95, 0.88), target=(0, 0, -8))

    def camera(name, loc, target, lens=60, roll=0.0):
        bpy.ops.object.camera_add(location=loc)
        cam = bpy.context.active_object
        cam.name = name
        cam.data.lens = lens
        direction = Vector(target) - Vector(loc)
        q = direction.to_track_quat("-Z", "Y")
        if roll:
            # roll about the camera's own view axis: post-multiply in local space (the
            # matrix_world route reads a stale identity in background builds)
            q = q @ Quaternion((0, 0, 1), roll)
        cam.rotation_mode = "QUATERNION"
        cam.rotation_quaternion = q
        col("Studio").objects.link(cam)

    # reference composition: temporal-side camera, cornea towards screen-right, nerve left
    camera("Cutaway", (-24, -64, 22), (0, 0, -1), lens=58, roll=0.9)
    camera("Exterior", (4, 4, 64), (0, 0, 4), lens=70)
    camera("CorneaCloseup", (-13, -8, 25), (0.5, 0, 11.6), lens=70)
    retina_target = Vector(VESSELS["disc3d"]) * 0.55 + Vector((0, 0, -1.5))
    camera("RetinaCloseup", (-2.5, 2.0, 5.5), tuple(retina_target), lens=32)


def enable_cutaway(names, plane_x=0.0):
    """Render-only boolean: remove the camera-side half space. Never exported."""
    bpy.ops.mesh.primitive_cube_add(location=(plane_x - 60, 0, 0), size=120)
    box = bpy.context.active_object
    box.name = "cutaway_box"
    box.hide_render = True  # a cutter, not scenery: it must never reach a frame
    for name in names:
        obj = bpy.data.objects.get(name)
        if not obj:
            continue
        mod = obj.modifiers.new("cutaway", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.solver = "EXACT"
        mod.object = box
    return box


def render_still(cam_name, path, samples=48):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1500
    scene.render.resolution_y = 1150
    scene.camera = bpy.data.objects[cam_name]
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print(f"RENDERED {path}", flush=True)


# ------------------------------------------------------------------ export

def export_browser_assets(solids):
    """Quantised grid vertices per part. One shared bbox per structure so coincident border
    vertices quantise identically and the runtime weld merges them."""
    import hashlib

    parts = []
    chunks = bytearray()
    for solid in solids:
        # bake the object transform (the lens is placed via obj.location) into the export:
        # the browser receives final eye-local millimetres
        obj = bpy.data.objects.get(solid.name)
        matrix = obj.matrix_world if obj else Matrix.Identity(4)
        all_verts = [tuple(matrix @ Vector(v)) for part in solid.parts for v in part.verts]
        mn = Vector((min(v[0] for v in all_verts), min(v[1] for v in all_verts), min(v[2] for v in all_verts)))
        mx = Vector((max(v[0] for v in all_verts), max(v[1] for v in all_verts), max(v[2] for v in all_verts)))
        span = Vector((max(mx.x - mn.x, 1e-4), max(mx.y - mn.y, 1e-4), max(mx.z - mn.z, 1e-4)))
        bbox_min = [round(mn.x, 4), round(mn.y, 4), round(mn.z, 4)]
        bbox_span = [round(span.x, 4), round(span.y, 4), round(span.z, 4)]
        for part in solid.parts:
            offset = len(chunks)
            chunk = bytearray()
            world_verts = [tuple(matrix @ Vector(v)) for v in part.verts]
            for (x, y, z), (u, v) in zip(world_verts, part.uvs):
                for axis, val in enumerate((x, y, z)):
                    q = max(-32767, min(32767, round((val - mn[axis]) / span[axis] * 32767)))
                    chunk += int(q).to_bytes(2, "little", signed=True)
                for val in (u, v):
                    q = max(-32767, min(32767, round(val * 32767)))
                    chunk += int(q).to_bytes(2, "little", signed=True)
            chunks += chunk
            entry = {
                "id": f"{solid.name}.{part.slot}",
                "structure": solid.name,
                "slot": part.slot,
                "rows": part.rows,
                "cols": part.cols,
                "wrap": part.wrap,
                "rowWrap": getattr(part, "wrap_rows", False),
                "byteOffset": offset,
                "vertexCount": part.rows * part.cols,
                "bboxMin": bbox_min,
                "bboxSpan": bbox_span,
            }
            if solid.row_slots:
                entry["rowSlots"] = [
                    {"slot": slot, "fromRow": rng[0], "toRow": rng[1]}
                    for slot, rng in solid.row_slots.items()
                ]
            parts.append(entry)

    manifest = {
        "generator": f"assets-src/build-anatomy.py (Blender {bpy.app.version_string})",
        "units": "millimetres; +Z anterior, +Y superior, +X nasal (right eye)",
        "decoding": ("int16 positions quantised per-structure bbox, int16 UVs; indices "
                     "regenerated from rows×cols; coincident positions welded; normals "
                     "computed at load"),
        "disc3d": list(VESSELS["disc3d"]),
        "fovea3d": list(VESSELS["fovea3d"]),
        "retinaInnerRadiusMm": VESSELS["retinaInnerRadiusMm"],
        "layerMagnification": MODEL.get("choroidMagnification", 3),
        "openStructures": ["zonules", "retinal_vessels"],
        "parts": parts,
    }
    (SRC / "anatomy.bin").write_bytes(bytes(chunks))
    (SRC / "anatomy.json").write_text(json.dumps(manifest, indent=1) + "\n")
    # the importable form: a data-URL module, so every environment loads the model without
    # asset-pipeline special cases and with no runtime fetch
    import base64 as _b64
    dataurl = "data:application/octet-stream;base64," + _b64.b64encode(bytes(chunks)).decode()
    (SRC / "anatomy-data.ts").write_text(
        "// GENERATED by assets-src/build-anatomy.py — do not edit. The Blender-authored model,\n"
        "// inlined as a data URL so every environment (vite build, vitest, node) imports it without\n"
        "// asset-pipeline special cases and with no runtime fetch.\n"
        f'export default "{dataurl}";\n'
    )

    mpath = SRC / "manifest.json"
    manifest_data = json.loads(mpath.read_text()) if mpath.exists() else {}
    for name in ("anatomy.bin", "anatomy.json", "anatomy-data.ts"):
        p = SRC / name
        manifest_data[name] = {
            "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
            "bytes": p.stat().st_size,
        }
    mpath.write_text(json.dumps(manifest_data, indent=2) + "\n")

    doc_path = ROOT / "assets-src/ASSETS.md"
    doc = doc_path.read_text()
    rows = "\n".join(
        f"| {name} | Blender BMesh/Cycles, build-anatomy.py | Afterlight project | Self-authored, project licence | {manifest_data[name]['sha256']} |"
        for name in ("anatomy.bin", "anatomy.json", "anatomy-data.ts"))
    if "| anatomy-data.ts |" not in doc:
        marker = "| iris-normal.png |"
        idx = doc.index(marker)
        doc = doc[:idx] + rows + "\n" + doc[idx:]
        doc_path.write_text(doc)
    print(f"EXPORTED anatomy.bin ({len(chunks)} bytes, {len(parts)} parts) + anatomy.json", flush=True)


# ------------------------------------------------------------------ main

def main():
    # The iris sculpt/bake pipeline runs first and untouched (it also saves the initial
    # eye.blend; the full scene is saved over it at the end).
    iris_globals = {"__name__": "iris_build", "__file__": str(ROOT / "assets-src/build-eye.py")}
    exec((ROOT / "assets-src/build-eye.py").read_text(), iris_globals)

    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 0.001

    # The iris sculpt and its bake receiver are authoring apparatus, not presentation
    # geometry: they occlude every study and must stay out of renders.
    for bake_obj in bpy.data.objects:
        if bake_obj.name.startswith("Iris "):
            bake_obj.hide_render = True
            bake_obj.hide_viewport = True

    solids = []
    solids.append(build_sclera())
    cornea, apex_z = build_cornea()
    solids.append(cornea)
    iris, z_root = build_iris()
    solids.append(iris)
    lens, lens_obj, sag_a = build_lens()
    lens_obj.location.z = (iris_plane_z() - 0.12) - sag_a
    solids.append(lens)
    solids.append(build_ciliary())
    solids.append(build_zonules())
    solids.append(build_shell("retina", lambda t: R_RET_OUT, lambda t: R_RET_IN,
                              CANAL_R - 0.05, "retina_inner", fundus=True))
    solids.append(build_shell("choroid", lambda t: R_CH_OUT, lambda t: R_CH_IN,
                              CANAL_R + 0.25, "choroid_inner"))
    solids.append(build_nerve_head())
    sheath, core = build_nerve()
    solids += [sheath, core]
    solids += build_muscles()
    build_vessels()

    # ---- study materials (the browser owns its own materials, per the contract) ----
    def mat(name, color, rough=0.5, transmission=0.0, ior=1.45):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Transmission Weight"].default_value = transmission
        bsdf.inputs["IOR"].default_value = ior
        return m

    mats = {
        "sclera": mat("sclera", (0.93, 0.91, 0.87), rough=0.5),
        "cornea": mat("cornea", (1, 1, 1), rough=0.02, transmission=1.0, ior=1.376),
        "iris_front": mat("iris", (0.26, 0.15, 0.08), rough=0.7),
        "lens": mat("lens", (0.97, 0.95, 0.88), rough=0.06, transmission=0.9, ior=1.42),
        "ciliary_body": mat("ciliary", (0.78, 0.48, 0.42), rough=0.6),
        "zonules": mat("zonules", (0.72, 0.69, 0.64), rough=0.6),
        "retina_inner": mat("retina", (0.86, 0.52, 0.32), rough=0.6),
        "choroid_inner": mat("choroid", (0.62, 0.28, 0.18), rough=0.7),
        "optic_nerve_sheath": mat("sheath", (0.93, 0.9, 0.83), rough=0.55),
        "optic_nerve_core": mat("core", (0.92, 0.84, 0.74), rough=0.6),
        "nerve_head": mat("nerve_head", (0.97, 0.82, 0.7), rough=0.6),
        "sclera_outer": mat("sclera_outer", (0.93, 0.91, 0.87), rough=0.5),
        "sclera_inner": mat("sclera_inner", (0.9, 0.88, 0.84), rough=0.6),
        "sclera_cut": mat("sclera_cut", (0.96, 0.95, 0.92), rough=0.75),
        "retina_cut": mat("retina_cut", (0.95, 0.78, 0.6), rough=0.75),
        "choroid_cut": mat("choroid_cut", (0.8, 0.58, 0.47), rough=0.75),
        "ciliary_body_cut": mat("ciliary_body_cut", (0.9, 0.72, 0.66), rough=0.75),
        "muscle_belly_cut": mat("muscle_belly_cut", (0.9, 0.68, 0.62), rough=0.75),
        "muscle_tendon": mat("muscle_tendon", (0.93, 0.9, 0.85), rough=0.5),
        "artery": mat("artery", (0.78, 0.27, 0.22), rough=0.45),
        "vein": mat("vein", (0.5, 0.15, 0.15), rough=0.5),
    }
    def mat_pair(name, tissue_color, rough=0.5):
        """Tissue slot plus a paler, desaturated cut face so a sliced wall reads as a cut."""
        cut = tuple(min(1.0, c * 0.6 + 0.35) for c in tissue_color)
        return {name: mat(name, tissue_color, rough=rough),
                name + "_cut": mat(name + "_cut", cut, rough=0.75)}

    pair_mats = {}
    for name, colour, rough in [
        ("sclera", (0.93, 0.91, 0.87), 0.5),
        ("retina", (0.86, 0.52, 0.32), 0.6),
        ("choroid", (0.5, 0.2, 0.13), 0.7),
        ("ciliary_body", (0.78, 0.48, 0.42), 0.6),
        ("muscle_belly", (0.75, 0.32, 0.26), 0.55),
    ]:
        pair_mats.update(mat_pair(name, colour, rough))
    mats.update(pair_mats)
    mats["sclera_cut"] = pair_mats["sclera_cut"]
    mats["retina_cut"] = pair_mats["retina_cut"]
    mats["choroid_cut"] = pair_mats["choroid_cut"]
    mats["ciliary_body_cut"] = pair_mats["ciliary_body_cut"]
    mats["muscle_belly_cut"] = pair_mats["muscle_belly_cut"]
    for solid in solids:
        slot_map = {}
        for part in solid.parts:
            if part.slot in mats:
                slot_map[part.slot] = mats[part.slot]
            elif part.slot.endswith("_cut") and part.slot[:-4] in mats:
                slot_map[part.slot] = mats[part.slot[:-4] + "_cut"] if (part.slot[:-4] + "_cut") in mats else mats[part.slot]
            else:
                slot_map[part.slot] = mats.get(solid.name.replace("optic_nerve_sheath", "optic_nerve_sheath").replace("optic_nerve_core", "optic_nerve_core"), mats.get("zonules"))
        solid.apply_slot_materials(slot_map)
    for obj in bpy.data.objects:
        if obj.type != "MESH" or obj.data.materials:
            continue
        slot = None
        if obj.name.startswith("vessel_artery"):
            slot = "artery"
        elif obj.name.startswith("vessel_vein"):
            slot = "vein"
        elif obj.name.startswith("muscle"):
            slot = "muscle_belly"
        if slot:
            obj.data.materials.append(mats[slot])

    studio()

    # ---- renders ------------------------------------------------------------
    RENDERS.mkdir(exist_ok=True)
    cut_names = ["sclera", "cornea", "iris", "lens", "ciliary_body", "retina", "choroid",
                 "optic_nerve_sheath", "optic_nerve_core", "nerve_head", "zonules",
                 "muscle_medial", "muscle_lateral", "muscle_superior", "muscle_inferior"]
    cut_names += [o.name for o in bpy.data.objects if o.name.startswith("vessel_")]
    box = enable_cutaway(cut_names)
    render_still("Cutaway", RENDERS / "study-cutaway.png", samples=64)
    for obj in bpy.data.objects:
        for mod in [m for m in obj.modifiers if m.name == "cutaway"]:
            obj.modifiers.remove(mod)
    bpy.data.objects.remove(box, do_unlink=True)
    render_still("Exterior", RENDERS / "study-exterior.png", samples=48)
    render_still("CorneaCloseup", RENDERS / "study-cornea.png", samples=48)
    anterior = ["cornea", "iris", "lens", "zonules", "ciliary_body"]
    hidden = [bpy.data.objects[n] for n in anterior if n in bpy.data.objects]
    for obj in hidden:
        obj.hide_render = True
    render_still("RetinaCloseup", RENDERS / "study-retina.png", samples=48)
    for obj in hidden:
        obj.hide_render = False

    # ---- browser export (pristine grids; render booleans never touched them) ----
    export_browser_assets(solids)

    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "assets-src/eye.blend"), compress=True)
    print("SAVED eye.blend", flush=True)


if __name__ == "__main__":
    main()
