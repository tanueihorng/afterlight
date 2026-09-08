# Condition atlas — clinical copy awaiting review

**Status: NOT REVIEWED. Nothing in this document has been checked by a clinician.**

Fifty atlas entries written during Phase 07, listed in full so a qualified ophthalmologist or
optometrist can read exactly what a patient would see. Per `AGENTS.md` §5 an agent must not approve
any of it; this is the gate on releasing the phase.

When it has been reviewed, record the outcome, the reviewer's role and the date in
`docs/clinical-review.md` and note the result here. Phase 05's copy is in
`docs/clinical-copy-review.md` and needs the same treatment.

---

## What kind of copy this is

Each entry carries four things, with different risk:

| Field | What it is | Risk |
|---|---|---|
| **Description** | What the condition is, in plain language | Moderate — a wrong description misleads quietly |
| **What people notice** | How the experience is commonly described | **Highest** — this is what a patient will match themselves against |
| **What a clinician is looking at** | The findings, so a patient can follow the conversation | Moderate — wrong terms make the patient sound confused in clinic |
| **Imaging** | Which test shows it | Low |

There is deliberately **no** management advice, no thresholds, no prognosis, and no instruction to
seek care in any entry. The only urgent-assessment wording in the whole app remains the existing
symptom notice, which this phase did not touch.

## The specific questions

1. **Is any "what people notice" description wrong or misleading?** This is the field a patient
   will read and compare against themselves.
2. **Is any condition described in a way that would make someone think they have it?** The atlas is
   a reference a person navigates deliberately — it is never surfaced from their symptoms and never
   ranked against their record — but the prose still has to avoid inviting self-diagnosis.
3. **Are the severity progressions defensible?** A slider shows how a condition is described as it
   advances. It is framed as description, never prediction, but the endpoints should be plausible.
4. **Is anything missing that a patient would look for?** Fifty entries is not everything.
5. **Are the vocabulary lists right?** They exist so a patient can search their own clinic letters.

## Illustrations, separately

Every fundus in the atlas is generated from parameters, not from anyone's imaging. A reviewer
should judge whether each rendering is *recognisable and not misleading* — not whether it is
photorealistic, which it is not and does not claim to be.

Two geometric properties are asserted by tests and are worth confirming by eye:

- The optic disc sits nasal to the fovea and mirrors correctly between right and left eyes.
- **The vision simulator inverts retina to field.** A superior retinal detachment is shown as a
  shadow rising from *below*. Getting this backwards would teach a patient the opposite of what to
  report, so it is worth checking directly.

The simulator also refuses hard-edged black field loss — the tunnel-with-black-walls picture that
appears in most patient literature and is wrong. Scotomas fade; they are not holes. A test fails
the build if any simulation paints black.

## Phase 07 deviation from the plan, for the record

The plan called for procedure animations authored in Blender. Blender is not installed on the
machine where this was built, so procedures remain the staged schematic explainers from Phase 05,
now scrubbable. The clinical copy for them is unchanged from Phase 05 and was already listed for
review there.

---

## The entries

### Ocular surface (11)

#### Dry eye disease

**Description shown:** The tear film breaks up too quickly or is of poor quality, leaving the surface of the eye exposed.

**What people notice:** Grittiness, burning, watering, and vision that blurs between blinks and clears when you blink.

**What a clinician is looking at:** Reduced tear break-up time, surface staining, meibomian gland dysfunction.

#### Corneal abrasion

**Description shown:** A scratch through the surface layer of the cornea.

**What people notice:** Sharp pain, watering, light sensitivity and a feeling that something is in the eye.

**What a clinician is looking at:** An epithelial defect that stains with fluorescein.

#### Corneal ulcer

**Description shown:** An infected or inflamed defect that extends into the deeper corneal tissue.

**What people notice:** Pain, redness, marked light sensitivity and blurred vision.

**What a clinician is looking at:** A stromal infiltrate with an overlying epithelial defect.

#### Keratoconus

**Description shown:** The cornea thins and bulges forward into a cone shape.

**What people notice:** Vision that distorts and ghosts, glare and starbursts at night, and a spectacle prescription that keeps changing.

**What a clinician is looking at:** Corneal steepening and thinning on topography and pachymetry.

#### Corneal oedema

**Description shown:** Fluid builds up in the cornea when its inner pumping layer is not keeping up.

**What people notice:** Misty vision, worst on waking and clearing through the day, with halos around lights.

**What a clinician is looking at:** Corneal thickening with stromal haze or microcystic epithelial change.

#### Fuchs' endothelial dystrophy

**Description shown:** The cells that keep the cornea clear gradually reduce in number.

**What people notice:** Vision that is misty in the morning and improves during the day, over years.

**What a clinician is looking at:** Guttae on specular examination, with corneal thickening over time.

#### Pterygium

**Description shown:** A wedge of conjunctival tissue grows onto the cornea, usually from the nasal side.

**What people notice:** Often cosmetic and irritating; vision changes only if it reaches the visual axis.

**What a clinician is looking at:** A fibrovascular growth crossing the limbus.

#### Conjunctivitis

**Description shown:** Inflammation of the membrane covering the white of the eye and inner eyelids.

**What people notice:** Redness, discharge, grittiness; vision itself is usually unaffected.

**What a clinician is looking at:** Conjunctival injection with discharge; the cornea is clear.

#### Subconjunctival haemorrhage

**Description shown:** A small vessel under the conjunctiva bleeds, producing a flat red patch.

**What people notice:** It looks alarming and feels like nothing. Vision is not affected.

**What a clinician is looking at:** A well-defined flat area of blood with a clear cornea and normal pupil.

#### Episcleritis and scleritis

**Description shown:** Inflammation of the layers beneath the conjunctiva, mild in one form and deep in the other.

**What people notice:** Episcleritis is uncomfortable and localised; scleritis is a deep, boring ache that can wake you at night.

**What a clinician is looking at:** Sectoral injection; deep vascular plexus involvement distinguishes scleritis.

#### Blepharitis

**Description shown:** Inflammation of the eyelid margins and the glands within them.

**What people notice:** Crusting, sore lid margins, and dryness that comes and goes.

**What a clinician is looking at:** Lid margin debris, telangiectasia and meibomian gland dysfunction.

### Anterior segment, lens and pressure (8)

#### Anterior uveitis

**Description shown:** Inflammation inside the front chamber of the eye.

**What people notice:** Aching, redness around the coloured part, light sensitivity and blurring.

**What a clinician is looking at:** Cells and flare in the anterior chamber, keratic precipitates, sometimes synechiae.

#### Hyphaema

**Description shown:** Blood collects in the front chamber of the eye, usually after an injury.

**What people notice:** Blurring, and a visible level of blood in the eye.

**What a clinician is looking at:** A layered red level in the anterior chamber; pressure needs watching.

#### Cataract

**Description shown:** The eye's natural lens becomes cloudy, scattering light on its way through.

**What people notice:** Glare and starbursts at night, colours looking duller, and vision that dims gradually over years.

**What a clinician is looking at:** Lens opacity graded by type — nuclear, cortical or posterior subcapsular.

#### Posterior capsule opacification

**Description shown:** The membrane behind a lens implant becomes cloudy months or years after cataract surgery.

**What people notice:** Vision gradually dimming again, with glare — often described as the cataract coming back.

**What a clinician is looking at:** Opacification of the posterior capsule behind the intraocular lens.

#### After cataract surgery

**Description shown:** The natural lens has been replaced with a clear artificial implant.

**What people notice:** Brighter, often bluer-looking vision. Some people notice reflections or a temporary crescent of light at the edge.

**What a clinician is looking at:** A well-centred intraocular lens in the capsular bag.

#### Primary open-angle glaucoma

**Description shown:** Damage to the optic nerve, usually in the context of eye pressure that is too high for that nerve.

**What people notice:** Nothing for a long time. Field loss starts away from the centre and is not noticed until it is substantial, which is why monitoring matters.

**What a clinician is looking at:** Increasing cup-to-disc ratio, rim thinning, and matching field defects.

**Imaging:** OCT of the nerve fibre layer, and visual fields.

#### Acute angle closure

**Description shown:** The drainage angle closes suddenly and the pressure inside the eye rises quickly.

**What people notice:** A painful, red eye with blurred vision, haloes around lights, headache and often nausea. This is one of the situations that needs assessment straight away.

**What a clinician is looking at:** A shallow chamber, hazy cornea, and a fixed mid-dilated pupil with high pressure.

#### Ocular hypertension

**Description shown:** Eye pressure above the usual range, without damage to the optic nerve.

**What people notice:** Nothing. It is found on examination and monitored.

**What a clinician is looking at:** Raised IOP with a healthy disc and normal fields.

### Vitreous and retina (26)

#### Vitreous floaters

**Description shown:** Condensations in the vitreous gel that cast shadows on the retina as light passes through.

**What people notice:** Drifting dots, threads or cobwebs that move when the eye moves and settle a moment later. Usually clearer against a bright, plain background.

**What a clinician is looking at:** Vitreous opacities, seen on examination of the vitreous cavity.

#### Posterior vitreous detachment

**Description shown:** The vitreous gel separates from the surface of the retina. It is common with age and is often the reason new floaters appear.

**What people notice:** New floaters, sometimes a ring-shaped one, and sometimes brief arcs of light in the periphery as the gel tugs on the retina.

**What a clinician is looking at:** A Weiss ring and a detached posterior hyaloid face on examination.

#### Retinal tear

**Description shown:** A break in the retina, often where the vitreous has pulled on it. Fluid can pass through a break and lift the retina away.

**What people notice:** Often a sudden increase in floaters, or flashes of light, though a tear can also be found without any symptoms at all.

**What a clinician is looking at:** A horseshoe or operculated break, usually in the peripheral retina.

**Imaging:** Seen on dilated examination; wide-field imaging can document it.

#### Retinal hole

**Description shown:** A round break in the retina without traction pulling on its edge.

**What people notice:** Often nothing at all; holes are frequently found during a routine examination.

**What a clinician is looking at:** A round, full-thickness break, sometimes within an area of lattice.

#### Lattice degeneration

**Description shown:** Areas where the retina is thinner than usual, most often in the periphery.

**What people notice:** Nothing. Lattice is found on examination and is monitored rather than felt.

**What a clinician is looking at:** Circumferential areas of thinning with overlying vitreous liquefaction.

#### Rhegmatogenous retinal detachment

**Description shown:** Fluid passes through a break and separates the retina from the wall of the eye. The separated area cannot send a usable image.

**What people notice:** A shadow or curtain that comes across part of the vision, often after a period of new floaters or flashes. The shadow appears on the opposite side from the affected retina.

**What a clinician is looking at:** An elevated, mobile retina with a causative break; whether the macula is still attached is a key distinction.

**Imaging:** Documented on examination and wide-field imaging; ultrasound if the view is obscured.

#### Tractional retinal detachment

**Description shown:** Scar tissue on the retinal surface contracts and pulls the retina away, without a break.

**What people notice:** Vision changes gradually rather than suddenly, and may distort before it dims.

**What a clinician is looking at:** A taut, immobile retina with fibrovascular proliferation, most often in diabetes.

#### Epiretinal membrane

**Description shown:** A thin sheet of tissue forms on the retinal surface and can contract.

**What people notice:** Straight lines looking bent or wavy, and objects sometimes appearing a different size in one eye.

**What a clinician is looking at:** A glinting membrane with retinal striae; contraction distorts the macula.

**Imaging:** OCT shows the membrane and the wrinkling beneath it.

#### Macular hole

**Description shown:** A full-thickness opening at the very centre of the macula.

**What people notice:** A missing or distorted patch right in the middle of vision, in that eye alone.

**What a clinician is looking at:** A round full-thickness defect at the fovea, staged by size and by traction.

**Imaging:** OCT shows the stage and the size.

#### Vitreomacular traction

**Description shown:** The vitreous stays attached at the macula and pulls on it as it separates elsewhere.

**What people notice:** Distortion, and sometimes a change in the size things appear.

**What a clinician is looking at:** Persistent attachment at the fovea with distortion of the foveal contour.

**Imaging:** OCT.

#### Central serous chorioretinopathy

**Description shown:** Fluid collects under the central retina, lifting a small blister of it.

**What people notice:** A dim or smudged patch in the centre, things looking smaller or further away, and colours looking washed out.

**What a clinician is looking at:** A serous detachment of the neurosensory retina at the macula.

**Imaging:** OCT shows the subretinal fluid.

#### Dry age-related macular degeneration

**Description shown:** Deposits called drusen build up at the macula, and over time areas of the pigment layer can be lost.

**What people notice:** Central vision becoming less sharp, needing more light to read, and — where atrophy develops — a missing patch in the middle.

**What a clinician is looking at:** Drusen, pigmentary change, and geographic atrophy in advanced disease.

**Imaging:** OCT and autofluorescence map the atrophy.

#### Neovascular (wet) age-related macular degeneration

**Description shown:** New, fragile vessels grow beneath the macula and leak fluid or blood, which distorts and obscures central vision.

**What people notice:** Straight lines bending, a dark or empty patch appearing in the centre, and change that can happen over days rather than years.

**What a clinician is looking at:** Choroidal neovascularisation with subretinal fluid, haemorrhage or exudate.

**Imaging:** OCT, and angiography where the membrane needs to be located.

#### Non-proliferative diabetic retinopathy

**Description shown:** Damage to the small retinal vessels causes them to leak and to close off, producing haemorrhages and deposits.

**What people notice:** Often nothing at all in the early stages, which is why screening exists. Blurring appears if the macula is affected.

**What a clinician is looking at:** Microaneurysms, dot-and-blot haemorrhages, hard exudates, cotton-wool spots and venous changes, graded mild to severe.

**Imaging:** Retinal photography for screening; OCT for the macula.

#### Proliferative diabetic retinopathy

**Description shown:** New vessels grow in response to areas of retina that have lost their blood supply. They are fragile and can bleed.

**What people notice:** A sudden shower of floaters or a red haze if a vessel bleeds; otherwise it can be silent until it is advanced.

**What a clinician is looking at:** Neovascularisation at the disc or elsewhere, with or without vitreous haemorrhage.

**Imaging:** Wide-field imaging and angiography show the non-perfused retina.

#### Diabetic macular oedema

**Description shown:** Fluid collects within the layers of the central retina.

**What people notice:** Central blurring and distortion, which can fluctuate.

**What a clinician is looking at:** Retinal thickening at the macula, with or without exudate.

**Imaging:** OCT central subfield thickness is the number that is tracked.

#### After panretinal laser

**Description shown:** Laser is applied across the peripheral retina to reduce the drive for new vessels to grow.

**What people notice:** Peripheral and night vision are often reduced afterwards; this is the trade the treatment makes.

**What a clinician is looking at:** Scattered chorioretinal scars sparing the macula.

#### Branch retinal vein occlusion

**Description shown:** One branch of the retinal vein is blocked, and the area it drains becomes congested.

**What people notice:** A blurred or missing area in part of the field, often noticed on waking, affecting one eye.

**What a clinician is looking at:** Flame haemorrhages in the distribution of the affected vein, respecting the horizontal midline.

**Imaging:** OCT for oedema; angiography for non-perfusion.

#### Central retinal vein occlusion

**Description shown:** The main vein draining the retina is blocked, congesting the whole retina.

**What people notice:** Blurring across the vision of one eye, usually painless and often sudden.

**What a clinician is looking at:** Haemorrhages in all four quadrants with dilated, tortuous veins.

**Imaging:** OCT, and angiography to assess perfusion.

#### Central retinal artery occlusion

**Description shown:** The main artery supplying the retina is blocked, and the retina loses its blood supply.

**What people notice:** Sudden, painless and profound loss of vision in one eye.

**What a clinician is looking at:** A pale retina with a cherry-red spot at the fovea and attenuated arterioles.

#### Retinitis pigmentosa

**Description shown:** An inherited condition in which the light-sensing cells gradually stop working, usually from the periphery inwards.

**What people notice:** Difficulty seeing in dim light, and a field that narrows over years. Central vision is often preserved until late.

**What a clinician is looking at:** Bone-spicule pigmentation, attenuated arterioles and a waxy pale disc.

**Imaging:** Field testing, autofluorescence and electrophysiology.

#### Myopic degeneration

**Description shown:** In a long, highly short-sighted eye the retina and its underlying layers are stretched thin.

**What people notice:** Reduced central sharpness, and sometimes distortion if the macula is involved.

**What a clinician is looking at:** A tilted disc, peripapillary atrophy and a tessellated fundus.

#### Retinoschisis

**Description shown:** The retina splits within its own layers, rather than lifting away from the wall.

**What people notice:** Usually nothing; it is generally found on examination.

**What a clinician is looking at:** A smooth, immobile elevation, most often inferotemporal.

#### Commotio retinae

**Description shown:** Bruising of the retina after a blunt injury to the eye.

**What people notice:** Blurring after an injury, which often settles over days to weeks.

**What a clinician is looking at:** Retinal whitening in the area of impact.

#### Vitreous haemorrhage

**Description shown:** Blood in the vitreous cavity, which blocks light on its way to the retina.

**What people notice:** A sudden shower of floaters, a red or dark haze, or loss of vision if the bleed is dense.

**What a clinician is looking at:** Reduced or absent view of the fundus; ultrasound if the retina cannot be seen.

#### After laser retinopexy

**Description shown:** Laser applied around a break creates a scar that seals the retina down.

**What people notice:** Usually nothing at the treated spot; new floaters or flashes are worth reporting.

**What a clinician is looking at:** A confluent ring of chorioretinal scarring around the break.

### Optic nerve (5)

#### Optic neuritis

**Description shown:** Inflammation of the optic nerve.

**What people notice:** Vision dimming in one eye over hours to days, ache on moving the eye, and colours — especially red — looking washed out.

**What a clinician is looking at:** Reduced acuity with a relative afferent pupillary defect; the disc may look normal.

**Imaging:** MRI where indicated; fields and OCT for follow-up.

#### Papilloedema

**Description shown:** Swelling of the optic disc caused by raised pressure inside the head.

**What people notice:** Brief greying of vision on standing, headaches, and sometimes double vision. Central vision is often normal at first.

**What a clinician is looking at:** A swollen disc with blurred margins, often with haemorrhages at the rim.

**Imaging:** OCT of the disc; neuroimaging to find the cause.

#### Non-arteritic anterior ischaemic optic neuropathy

**Description shown:** The blood supply to the front of the optic nerve is interrupted.

**What people notice:** Painless loss of part of the vision in one eye, often noticed on waking and typically the upper or lower half.

**What a clinician is looking at:** A swollen, often segmentally pale disc with an altitudinal field defect.

#### Optic atrophy

**Description shown:** Loss of nerve fibres, whatever the original cause, leaving the disc pale.

**What people notice:** Reduced vision and washed-out colour in the affected eye, usually stable rather than changing.

**What a clinician is looking at:** A pale disc with loss of the nerve fibre layer.

#### Glaucomatous rim loss

**Description shown:** The rim of nerve tissue around the optic cup thins, most often at the upper and lower poles first.

**What people notice:** Nothing directly. It is what the field test and the OCT are measuring between appointments.

**What a clinician is looking at:** Notching and rim thinning with a corresponding field defect.
