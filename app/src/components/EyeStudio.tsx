import { useMemo, useState } from "react";
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
import { Field } from "./ui";

/**
 * The 3D eye, plus the controls that tune it to resemble the person looking at it.
 *
 * Personalisation here is cosmetic and nothing more: iris colour, limbal ring, scleral vessels,
 * fundus pigmentation. It makes the model recognisable rather than generic, which helps people
 * follow what a clinician is describing — but it is not built from anyone's scans, and every view
 * says so.
 */
export default function EyeStudio() {
  const store = useStore();
  const saved = store.meta?.eye_appearance;

  const [iris, setIris] = useState<IrisParams>({ ...DEFAULT_IRIS, ...saved?.iris });
  const [fundusPigment, setFundusPigment] = useState(saved?.fundusPigmentation ?? 0.55);
  const [scleraVessels, setScleraVessels] = useState(saved?.scleraVessels ?? 0.45);
  const [eye, setEye] = useState<"right" | "left">("right");
  const [light, setLight] = useState(0.5);

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

  return (
    <>
      <div className="card">
        <EyeCanvas
          options={{ eye, iris: { ...iris, pupilMm: 8 - 6 * light ** 0.55 }, fundus, scleraVessels, light }}
          height={440}
        />
      </div>

      <div className="grid-2">
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

        <section className="card">
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
        </section>
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
