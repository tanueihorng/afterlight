// Optic nerve.
//
// Clinical wording is textbook-level and awaiting review — see docs/atlas-review.md.

import type { ConditionEntry } from "./types";

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));

export const OPTIC_NERVE: ConditionEntry[] = [
  {
    id: "optic_neuritis",
    name: "Optic neuritis",
    region: "optic_nerve",
    view: "fundus",
    description: "Inflammation of the optic nerve.",
    experience:
      "Vision dimming in one eye over hours to days, ache on moving the eye, and colours — especially red — looking washed out.",
    clinical: "Reduced acuity with a relative afferent pupillary defect; the disc may look normal.",
    imaging: "MRI where indicated; fields and OCT for follow-up.",
    profiles: ["optic_nerve"],
    vocabulary: ["optic neuritis", "RAPD", "colour desaturation", "retrobulbar"],
    at: (s) => ({ delta: { cupDisc: 0.25, macularPigment: 0.5 }, lesions: { haze: 0.1 * s } }),
    simulation: { kind: "colour_desaturation" },
    gradable: true,
  },
  {
    id: "papilloedema",
    name: "Papilloedema",
    region: "optic_nerve",
    view: "fundus",
    description: "Swelling of the optic disc caused by raised pressure inside the head.",
    experience:
      "Brief greying of vision on standing, headaches, and sometimes double vision. Central vision is often normal at first.",
    clinical: "A swollen disc with blurred margins, often with haemorrhages at the rim.",
    imaging: "OCT of the disc; neuroimaging to find the cause.",
    profiles: ["optic_nerve"],
    vocabulary: ["papilloedema", "disc swelling", "IIH"],
    at: (s) => ({
      lesions: { flame: 0.3 * s, cottonWool: 0.2 * s },
      delta: { cupDisc: Math.max(0.05, 0.3 - 0.25 * s) },
    }),
    annotations: [{ x: 0.68, y: 0.485, text: "The disc, swollen with indistinct margins" }],
    simulation: { kind: "blur" },
    gradable: true,
  },
  {
    id: "naion",
    name: "Non-arteritic anterior ischaemic optic neuropathy",
    region: "optic_nerve",
    view: "fundus",
    description: "The blood supply to the front of the optic nerve is interrupted.",
    experience:
      "Painless loss of part of the vision in one eye, often noticed on waking and typically the upper or lower half.",
    clinical: "A swollen, often segmentally pale disc with an altitudinal field defect.",
    profiles: ["optic_nerve"],
    vocabulary: ["NAION", "altitudinal", "disc at risk"],
    at: (s) => ({ lesions: { flame: 0.25 * s }, delta: { cupDisc: 0.12 } }),
    simulation: { kind: "curtain", retinalQuadrant: "superior" },
    gradable: true,
  },
  {
    id: "optic_atrophy",
    name: "Optic atrophy",
    region: "optic_nerve",
    view: "fundus",
    description: "Loss of nerve fibres, whatever the original cause, leaving the disc pale.",
    experience: "Reduced vision and washed-out colour in the affected eye, usually stable rather than changing.",
    clinical: "A pale disc with loss of the nerve fibre layer.",
    profiles: ["optic_nerve"],
    vocabulary: ["optic atrophy", "disc pallor", "RNFL loss"],
    at: (s) => ({ delta: { cupDisc: lerp(0.35, 0.6, s), pigmentation: 0.45 } }),
    simulation: { kind: "contrast_loss" },
    gradable: true,
  },
  {
    id: "glaucomatous_rim_loss",
    name: "Glaucomatous rim loss",
    region: "optic_nerve",
    view: "fundus",
    description:
      "The rim of nerve tissue around the optic cup thins, most often at the upper and lower poles first.",
    experience:
      "Nothing directly. It is what the field test and the OCT are measuring between appointments.",
    clinical: "Notching and rim thinning with a corresponding field defect.",
    profiles: ["glaucoma"],
    vocabulary: ["rim thinning", "notch", "ISNT rule", "RNFL"],
    at: (s) => ({ delta: { cupDisc: lerp(0.4, 0.92, s) } }),
    simulation: { kind: "arcuate_loss" },
    gradable: true,
  },
];
