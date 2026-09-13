import { useCallback, useMemo, useState } from "react";
import EyeCanvas from "./EyeCanvas";
import {
  DEFAULT_FUNDUS,
  DEFAULT_IRIS,
  IRIS_PRESETS,
  paintFundus,
  type FundusParams,
  type IrisParams,
} from "../engine";
import { useStore } from "../lib/store";
import { t } from "../lib/i18n";
import type { ViewMode } from "../engine";
import { Field } from "./ui";

/**
 * The 3D eye, plus the controls that tune it to resemble the person looking at it.
 *
 * Personalisation here is cosmetic and nothing more: iris colour, limbal ring, scleral vessels,
 * fundus pigmentation. It makes the model recognisable rather than generic, which helps people
 * follow what a clinician is describing — but it is not built from anyone's scans, and every view
 * says so.
 */

// The inspection list, in walking order from the front of the eye backwards. Descriptions are
// plain descriptive anatomy, one sentence each — registered in docs/atlas-review.md for human
// clinical sign-off before release.
const STRUCTURES: { id: string; name: string; description: string }[] = [
  {
    id: "cornea",
    name: "Cornea",
    description:
      "The clear front window. It does most of the eye's focusing and is packed with nerve endings.",
  },
  {
    id: "iris",
    name: "Iris",
    description:
      "The coloured ring. Its muscles change the pupil's size to control how much light gets in.",
  },
  {
    id: "lens",
    name: "Lens",
    description:
      "A clear, flexible oval behind the iris. It changes shape to focus near and far, and stiffens with age.",
  },
  {
    id: "ciliary_body",
    name: "Ciliary body",
    description:
      "The ring of muscle behind the iris. It focuses the lens and makes the fluid that nourishes the front of the eye.",
  },
  {
    id: "zonules",
    name: "Zonules",
    description: "Fine fibres holding the lens in place, from the ciliary ring to the lens's edge.",
  },
  {
    id: "sclera",
    name: "Sclera",
    description:
      "The tough white wall of the eye. It holds the eye's shape and gives the eye muscles something to pull on.",
  },
  {
    id: "choroid",
    name: "Choroid",
    description:
      "The dark, blood-rich layer between the white of the eye and the retina. It nourishes the outer retina.",
  },
  {
    id: "retina",
    name: "Retina",
    description:
      "The light-sensing lining at the back of the eye. It turns light into signals that leave through the optic nerve.",
  },
  {
    id: "nerve_head",
    name: "Optic disc",
    description: "The spot where the optic nerve leaves the eye, visible as the optic disc.",
  },
  {
    id: "optic_nerve_sheath",
    name: "Optic nerve sheath",
    description:
      "The protective wrapping around the optic nerve, continuous with the coverings of the brain.",
  },
  {
    id: "optic_nerve_core",
    name: "Optic nerve",
    description:
      "The bundle of fibres carrying what the retina sees towards the brain. Damaged fibres do not grow back.",
  },
  {
    id: "muscle_superior",
    name: "Superior rectus muscle",
    description:
      "One of six strap-like muscles that turn the eye, pulling on the white of the eye from inside the orbit.",
  },
  {
    id: "muscle_inferior",
    name: "Inferior rectus muscle",
    description:
      "One of six strap-like muscles that turn the eye, pulling on the white of the eye from inside the orbit.",
  },
  {
    id: "muscle_medial",
    name: "Medial rectus muscle",
    description:
      "One of six strap-like muscles that turn the eye, pulling on the white of the eye from inside the orbit.",
  },
  {
    id: "muscle_lateral",
    name: "Lateral rectus muscle",
    description:
      "One of six strap-like muscles that turn the eye, pulling on the white of the eye from inside the orbit.",
  },
];

const DEFAULT_VIEW: ViewMode = "cross_section";

export default function EyeStudio() {
  const store = useStore();
  const saved = store.meta?.eye_appearance;

  const [iris, setIris] = useState<IrisParams>({ ...DEFAULT_IRIS, ...saved?.iris });
  const [fundusPigment, setFundusPigment] = useState(saved?.fundusPigmentation ?? 0.55);
  const [scleraVessels, setScleraVessels] = useState(saved?.scleraVessels ?? 0.45);
  const [eye, setEye] = useState<"right" | "left">("right");
  const [view, setView] = useState<ViewMode>(DEFAULT_VIEW);
  const [slice, setSlice] = useState(0.5);
  const [separation, setSeparation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [light, setLight] = useState(0.5);
  const [selected, setSelected] = useState<string | null>(null);
  const [magnification, setMagnification] = useState(3);
  const [resetKey, setResetKey] = useState(0);
  const [focusRequest, setFocusRequest] = useState<{ id: string; nonce: number } | null>(null);

  const fundus: FundusParams = useMemo(
    () => ({ ...DEFAULT_FUNDUS, pigmentation: fundusPigment, eye }),
    [fundusPigment, eye],
  );

  const save = () =>
    store.setMeta({
      eye_appearance: {
        iris,
        fundusPigmentation: fundusPigment,
        scleraVessels,
      },
    });

  const pick = useCallback((id: string | null) => {
    setSelected(id);
  }, []);

  const selectFromList = (id: string) => {
    setSelected((current) => (current === id ? null : id));
  };

  const reset = () => {
    setView(DEFAULT_VIEW);
    setSlice(0.5);
    setSeparation(0);
    setZoom(1);
    setSelected(null);
    setMagnification(3);
    setResetKey((k) => k + 1);
  };

  const selectedStructure = STRUCTURES.find((s) => s.id === selected);

  return (
    <>
      <div className="card">
        <div className="btn-row" style={{ flexWrap: "wrap", marginBottom: 12 }}>
          {(["exterior", "cross_section", "cornea", "fundus"] as const).map((mode) => (
            <button
              key={mode}
              className={`btn ${view === mode ? "primary" : "subtle"}`}
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
            >
              {t(`eye.view.${mode}`)}
            </button>
          ))}
          <button className="btn subtle" onClick={reset}>
            {t("eye.reset")}
          </button>
        </div>
        <EyeCanvas
          resetSignal={resetKey}
          options={{
            view,
            slice,
            separation,
            zoom,
            eye,
            iris: { ...iris, pupilMm: 8 - 6 * light ** 0.55 },
            fundus,
            scleraVessels,
            light,
            layerMagnification: magnification,
          }}
          height={500}
          onPick={pick}
          focusRequest={focusRequest ?? undefined}
        />
        <p className="muted" aria-live="polite">
          {selectedStructure
            ? `${selectedStructure.name}: ${selectedStructure.description}`
            : t("eye.selection.empty")}
        </p>
        <p className="muted" style={{ marginTop: 4 }}>
          {t("eye.status", {
            slice: view === "cross_section" ? `${Math.round(slice * 100)}%` : "—",
            magnification: `×${magnification}`,
          })}
        </p>
        <p className="muted">{t("eye.controls")}</p>
        {view === "cross_section" && (
          <>
            <Slider label={t("eye.slice")} value={slice} onChange={setSlice} />
            <Slider
              label={t("eye.magnification")}
              value={(magnification - 1) / 3}
              onChange={(v) => {
                const next = 1 + Math.round(v * 3);
                setMagnification(next);
              }}
            />
          </>
        )}
        {(view === "cross_section" || view === "cornea") && (
          <Slider label={t("eye.separation")} value={separation} onChange={setSeparation} />
        )}
        <Slider
          label={t("eye.zoom")}
          value={(zoom - 0.7) / 0.9}
          onChange={(v) => setZoom(0.7 + v * 0.9)}
        />
      </div>

      <div className="grid-2">
        <section className="card">
          <h2 className="card-title">{t("eye.structures.title")}</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {t("eye.structures.hint")}
          </p>
          <ul
            aria-label={t("eye.structures.title")}
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {STRUCTURES.map((structure) => {
              const isSelected = selected === structure.id;
              return (
                <li
                  key={structure.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minHeight: 44,
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <button
                    className={`btn ${isSelected ? "primary" : "subtle"}`}
                    style={{ flex: 1, justifyContent: "flex-start", textAlign: "left" }}
                    aria-pressed={isSelected}
                    onClick={() => selectFromList(structure.id)}
                  >
                    {structure.name}
                  </button>
                  <button
                    className="btn subtle"
                    aria-label={t("eye.structures.focus", { name: structure.name })}
                    onClick={() => {
                      setSelected(structure.id);
                      setFocusRequest({ id: structure.id, nonce: Date.now() });
                    }}
                  >
                    {t("eye.structures.focusShort")}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <h2 className="card-title">Make it look like your eyes</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            These change the model's appearance only. They are not recorded as anything about your
            eyes clinically, and they change nothing in your record.
          </p>

          <fieldset className="pref-group">
            <legend className="field-label">Eye colour</legend>
            <div className="btn-row" style={{ flexWrap: "wrap" }}>
              {IRIS_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className="btn subtle"
                  onClick={() => setIris({ ...iris, ...preset.params })}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </fieldset>

          <Slider
            label="Pigment"
            value={iris.melanin}
            onChange={(melanin) => setIris({ ...iris, melanin })}
          />
          <Slider
            label="Warmth"
            value={iris.warmth}
            onChange={(warmth) => setIris({ ...iris, warmth })}
          />
          <Slider
            label="Limbal ring"
            value={iris.limbalRing}
            onChange={(limbalRing) => setIris({ ...iris, limbalRing })}
          />
          <Slider
            label="Detail in the iris"
            value={iris.fibreDensity}
            onChange={(fibreDensity) => setIris({ ...iris, fibreDensity })}
          />
          <Slider label="Redness of the white" value={scleraVessels} onChange={setScleraVessels} />

          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={save}>
              Remember this appearance
            </button>
            <button
              className="btn subtle"
              onClick={() => {
                setIris(DEFAULT_IRIS);
                setScleraVessels(0.45);
                setFundusPigment(0.55);
              }}
            >
              Reset
            </button>
          </div>
        </section>
      </div>

      <div className="card">
        <h2 className="card-title">View</h2>

        <fieldset className="pref-group">
          <legend className="field-label">Which eye</legend>
          <div className="btn-row">
            {(["right", "left"] as const).map((e) => (
              <button
                key={e}
                className={`btn ${eye === e ? "primary" : "subtle"}`}
                aria-pressed={eye === e}
                onClick={() => setEye(e)}
              >
                {e === "right" ? "Right (OD)" : "Left (OS)"}
              </button>
            ))}
          </div>
        </fieldset>

        <Slider label="Light in the room" value={light} onChange={setLight} />
        <p className="muted">
          The pupil responds the way a real one does — most of the change happens as the light
          first comes up.
        </p>

        <h3 className="card-title" style={{ marginTop: 18 }}>
          Inside the eye
        </h3>
        <FundusView params={fundus} />
        <Slider
          label="Background pigmentation"
          value={fundusPigment}
          onChange={setFundusPigment}
        />
      </div>
    </>
  );
}


function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}

/** The fundus as an ophthalmoscope sees it — the same painter the 3D texture uses. */
function FundusView({ params }: { params: FundusParams }) {
  const dataUrl = useMemo(() => {
    if (typeof document === "undefined") return "";
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    paintFundus(ctx, 512, params);
    return canvas.toDataURL("image/png");
  }, [params]);

  if (!dataUrl) return null;
  return (
    <img
      src={dataUrl}
      alt={`Generic illustration of the inside of a ${params.eye === "right" ? "right" : "left"} eye: optic disc, macula and the four vascular arcades. Not anyone's retina.`}
      style={{ width: "100%", borderRadius: "50%", border: "1px solid var(--border)" }}
    />
  );
}
