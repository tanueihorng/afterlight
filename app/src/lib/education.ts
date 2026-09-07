// Educational content for the Visualize section (§24, §25).
//
// Everything here is generic anatomy teaching material. It is deliberately kept separate from
// the patient's own records: it explains what a procedure or condition generally involves, and
// never claims to depict this patient's retina.

export type RetinaState =
  | "healthy"
  | "pvd"
  | "tear"
  | "local_detachment"
  | "large_detachment"
  | "macula_off"
  | "treated_laser"
  | "buckle"
  | "gas";

export interface RetinaStateInfo {
  id: RetinaState;
  label: string;
  blurb: string;
}

export const RETINA_STATES: RetinaStateInfo[] = [
  {
    id: "healthy",
    label: "Healthy retina",
    blurb:
      "The retina lies flat against the inner wall of the eye, and the vitreous gel fills the cavity in front of it.",
  },
  {
    id: "pvd",
    label: "Posterior vitreous detachment",
    blurb:
      "The vitreous gel separates from the retinal surface. This is common with age and is often associated with new floaters, and sometimes flashes.",
  },
  {
    id: "tear",
    label: "Retinal tear",
    blurb:
      "A break forms in the retina, often where the vitreous pulled on it. Fluid can pass through a break and lift the retina.",
  },
  {
    id: "local_detachment",
    label: "Localised detachment",
    blurb:
      "Fluid collects under the retina near the break, lifting a limited area away from the wall of the eye.",
  },
  {
    id: "large_detachment",
    label: "Larger detachment",
    blurb:
      "The separated area extends further across the retina. A detached area does not send a usable image to the brain, which is often described as a shadow or curtain.",
  },
  {
    id: "macula_off",
    label: "Macula-on vs macula-off",
    blurb:
      "Whether the central macula is still attached ('macula-on') or has lifted ('macula-off') is a distinction clinicians use when discussing detachment. It is determined by examination, not by symptoms alone.",
  },
  {
    id: "treated_laser",
    label: "Treated with laser",
    blurb:
      "Laser or freezing treatment creates a scar around a break, sealing the retina to the wall of the eye so fluid cannot pass through.",
  },
  {
    id: "buckle",
    label: "Scleral buckle in place",
    blurb:
      "A silicone band placed on the outside of the eye indents the wall inward, relieving traction and bringing the wall closer to the break.",
  },
  {
    id: "gas",
    label: "Gas tamponade",
    blurb:
      "A gas bubble presses the retina against the wall of the eye while the treated break seals. The bubble is absorbed over weeks, and posture advice is often given during this period.",
  },
];

export interface ProcedureExplainer {
  /** Keys are matched loosely against the stored procedure_type. */
  match: string[];
  title: string;
  summary: string;
  steps: string[];
  afterwards: string[];
  /** Retina states worth showing alongside this procedure. */
  states: RetinaState[];
}

export const PROCEDURE_EXPLAINERS: ProcedureExplainer[] = [
  {
    match: ["vitrectomy"],
    title: "Vitrectomy",
    summary:
      "Surgery performed from inside the eye, in which the vitreous gel is removed so the retina can be treated directly.",
    steps: [
      "The vitreous gel is removed from the cavity of the eye.",
      "The retinal tear or detachment is identified and treated.",
      "The retina is repositioned against the wall of the eye.",
      "Laser or cryotherapy may be applied around the break to seal it.",
      "Gas or silicone oil may be placed inside the eye as a tamponade to hold the retina in position while it heals.",
    ],
    afterwards: [
      "Vision through a gas bubble is typically dark or blurred until the bubble absorbs.",
      "Posturing instructions, if any, come from your surgeon and are specific to your case.",
      "Air travel is usually restricted while a gas bubble is present.",
    ],
    states: ["large_detachment", "treated_laser", "gas"],
  },
  {
    match: ["scleral buckle", "buckle"],
    title: "Scleral buckle",
    summary:
      "Surgery performed from outside the eye, in which a silicone band is placed against the sclera to support the retina.",
    steps: [
      "A silicone band or sponge is positioned on the outside wall of the eye.",
      "The band indents the eye wall gently inward.",
      "The indentation reduces the pull of the vitreous on the retinal break and brings the wall closer to the retina.",
      "Cryotherapy or laser is usually applied around the break.",
      "Fluid under the retina may be drained.",
    ],
    afterwards: [
      "The buckle is generally left permanently in place.",
      "A change in the eye's shape can alter the spectacle prescription.",
    ],
    states: ["tear", "local_detachment", "buckle"],
  },
  {
    match: ["laser", "photocoagulation"],
    title: "Laser photocoagulation (retinopexy)",
    summary:
      "A laser is used to create small scars around a retinal break, welding the retina to the underlying layer.",
    steps: [
      "The break or weak area is located during examination.",
      "Laser is applied in a ring around it.",
      "Each spot forms a small scar over the following days and weeks.",
      "The scarred ring acts as a barrier, so fluid cannot pass under the retina.",
    ],
    afterwards: [
      "The barrier takes time to strengthen — follow-up timing is set by your clinician.",
      "Laser treats the specific break; it does not prevent breaks forming elsewhere.",
    ],
    states: ["tear", "treated_laser"],
  },
  {
    match: ["cryo"],
    title: "Cryotherapy (freezing treatment)",
    summary:
      "A freezing probe is applied to the outside of the eye over a retinal break to create a sealing scar.",
    steps: [
      "A probe is placed on the outer wall of the eye over the break.",
      "Controlled freezing is applied.",
      "A scar forms as the area heals, sealing the retina down.",
    ],
    afterwards: ["Redness and swelling for a period afterwards is common and expected."],
    states: ["tear", "treated_laser"],
  },
  {
    match: ["retinal tear repair", "tear repair"],
    title: "Retinal tear repair",
    summary: "Treatment of a break in the retina before fluid can lift it away from the eye wall.",
    steps: [
      "The break is located.",
      "Laser or freezing treatment is applied around it.",
      "A scar forms, sealing the edges of the break.",
    ],
    afterwards: ["New floaters or flashes after treatment are worth reporting promptly."],
    states: ["tear", "treated_laser"],
  },
  {
    match: ["gas tamponade", "gas"],
    title: "Gas tamponade",
    summary: "A gas bubble placed inside the eye to hold the retina in position while it heals.",
    steps: [
      "Gas is injected into the vitreous cavity.",
      "The bubble rises and presses the retina against the eye wall.",
      "Posturing may be advised so the bubble sits over the treated area.",
      "The gas is gradually absorbed and replaced by the eye's own fluid.",
    ],
    afterwards: [
      "Vision is typically poor while the bubble is present, often with a visible moving line as it shrinks.",
      "Flying and some anaesthetic gases are avoided until the bubble has gone.",
    ],
    states: ["gas", "treated_laser"],
  },
  {
    match: ["silicone oil"],
    title: "Silicone oil removal",
    summary:
      "A second procedure to remove silicone oil that was left in the eye as a longer-term tamponade.",
    steps: [
      "The oil is removed from the vitreous cavity.",
      "The retina is inspected to confirm it remains in position.",
      "The cavity is refilled with fluid.",
    ],
    afterwards: ["Vision often changes as the eye's optics return to normal without the oil."],
    states: ["treated_laser", "healthy"],
  },
  {
    match: ["cataract"],
    title: "Cataract surgery",
    summary:
      "The clouded natural lens is removed and replaced with a clear artificial lens implant.",
    steps: [
      "A small incision is made at the edge of the cornea.",
      "The clouded lens is broken up and removed.",
      "An intraocular lens implant is placed in its position.",
    ],
    afterwards: [
      "Cataract surgery is common after vitrectomy, as the natural lens often clouds afterwards.",
      "The spectacle prescription usually changes once the eye has settled.",
    ],
    states: ["healthy"],
  },
];

export function explainerFor(procedureType: string): ProcedureExplainer | undefined {
  const t = procedureType.toLowerCase();
  return PROCEDURE_EXPLAINERS.find((e) => e.match.some((m) => t.includes(m)));
}

export interface ConditionExplainer {
  match: string[];
  title: string;
  what: string;
  why: string;
  states: RetinaState[];
}

export const CONDITION_EXPLAINERS: ConditionExplainer[] = [
  {
    match: ["posterior vitreous detachment", "pvd"],
    title: "Posterior vitreous detachment (PVD)",
    what: "The vitreous gel separates from the retinal surface.",
    why: "Commonly noticed as new floaters, sometimes with flashes as the gel tugs on the retina.",
    states: ["healthy", "pvd"],
  },
  {
    match: ["retinal detachment", "rhegmatogenous", "tractional detachment", "macula-off", "macula off"],
    title: "Retinal detachment",
    what: "The retina separates from the wall of the eye, with fluid collecting underneath it.",
    why: "A detached area cannot send a usable image, which is often described as a shadow, curtain or missing region of vision.",
    states: ["tear", "local_detachment", "large_detachment", "macula_off"],
  },
  {
    match: ["retinal tear", "retinal hole", "horseshoe tear", "retinal break"],
    title: "Retinal tear or hole",
    what: "A break in the retina, often where the vitreous has pulled on it.",
    why: "Breaks can allow fluid under the retina. Treating a break aims to prevent that.",
    states: ["pvd", "tear", "treated_laser"],
  },
  {
    match: ["lattice"],
    title: "Lattice degeneration",
    what: "Areas where the retina is thinner than usual, often in the periphery.",
    why: "These areas are more prone to breaks, which is why they are monitored.",
    states: ["healthy", "tear"],
  },
  {
    match: ["floater", "vitreous opac"],
    title: "Vitreous floaters",
    what: "Condensations in the vitreous gel that cast shadows on the retina.",
    why: "They are perceived as drifting dots, strands or cobwebs that move with the eye.",
    states: ["healthy", "pvd"],
  },
  {
    match: ["epiretinal membrane", "erm", "macular pucker"],
    title: "Epiretinal membrane",
    what: "A thin layer of tissue forms on the retinal surface and can contract.",
    why: "Contraction can wrinkle the retina, which is often described as distortion of straight lines.",
    states: ["healthy"],
  },
  {
    match: ["macular edema", "oedema", "cystoid"],
    title: "Macular oedema",
    what: "Fluid collects within the layers of the central retina.",
    why: "Central vision may be blurred or distorted while the fluid is present.",
    states: ["healthy"],
  },
  {
    match: ["scar", "laser scar", "photocoagulation"],
    title: "Retinal scarring and laser scars",
    what: "Areas of healed tissue where the retina is bonded to the layer beneath it.",
    why: "Laser scars are created deliberately to seal breaks; other scarring can follow inflammation or surgery.",
    states: ["treated_laser"],
  },
];

export function conditionFor(name: string): ConditionExplainer | undefined {
  const t = name.toLowerCase();
  return CONDITION_EXPLAINERS.find((c) => c.match.some((m) => t.includes(m)));
}
