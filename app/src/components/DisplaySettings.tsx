import { THEMES, TYPE_SCALES, prefsFromMeta, type ThemeId, type TypeScale } from "../lib/prefs";
import { useStore } from "../lib/store";

/**
 * Display preferences, first in Settings rather than buried at the bottom: for a lot of the people
 * using this, these controls are the difference between a usable app and an unusable one.
 */
export default function DisplaySettings() {
  const store = useStore();
  const prefs = prefsFromMeta(store.meta);

  return (
    <section className="card">
      <h2 className="card-title">Display</h2>

      <fieldset className="pref-group">
        <legend className="field-label">Contrast and colour</legend>
        <div className="btn-row">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`btn ${prefs.theme === t.id ? "primary" : ""}`}
              aria-pressed={prefs.theme === t.id}
              onClick={() => store.setMeta({ theme: t.id as ThemeId })}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="muted pref-hint">
          {THEMES.find((t) => t.id === prefs.theme)?.description}
        </p>
      </fieldset>

      <fieldset className="pref-group">
        <legend className="field-label">Text size</legend>
        <div className="btn-row">
          {TYPE_SCALES.map((s) => (
            <button
              key={s.value}
              className={`btn ${prefs.typeScale === s.value ? "primary" : ""}`}
              aria-pressed={prefs.typeScale === s.value}
              onClick={() => store.setMeta({ type_scale: s.value as TypeScale })}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="muted pref-hint">
          This scales everything in Afterlight. Your browser's own zoom works on top of it.
        </p>
      </fieldset>

      <fieldset className="pref-group">
        <legend className="field-label">Comfort</legend>
        <div className="check-row">
          <input
            id="pref-motion"
            type="checkbox"
            checked={prefs.reducedMotion}
            onChange={(e) => store.setMeta({ reduced_motion: e.target.checked })}
          />
          <label htmlFor="pref-motion">Reduce movement and transitions</label>
        </div>
        <div className="check-row">
          <input
            id="pref-glare"
            type="checkbox"
            checked={prefs.glareComfort}
            onChange={(e) => store.setMeta({ glare_comfort: e.target.checked })}
          />
          <label htmlFor="pref-glare">
            Lower brightness for glare comfort
          </label>
        </div>
        <div className="check-row">
          <input
            id="pref-imagery"
            type="checkbox"
            checked={prefs.dimImagery}
            onChange={(e) => store.setMeta({ dim_imagery: e.target.checked })}
          />
          <label htmlFor="pref-imagery">Dim scans, drawings and illustrations</label>
        </div>
        <p className="muted pref-hint">
          If your system already asks for reduced motion, Afterlight follows it without this setting.
        </p>
      </fieldset>
    </section>
  );
}
