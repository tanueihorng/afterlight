import { CONDITION_PROFILES } from "../lib/conditions";
import { useStore } from "../lib/store";

/**
 * Profiles change what Afterlight asks about, and nothing else. They are not a diagnosis, they
 * never appear as one, and nothing is hidden from anyone who does not pick them — the full symptom
 * list, every metric and every check stay available regardless.
 */
export default function ConditionProfiles() {
  const store = useStore();
  const selected = store.meta?.condition_profiles ?? [];

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((p) => p !== id) : [...selected, id];
    void store.setMeta({ condition_profiles: next });
  };

  return (
    <section className="card">
      <h2 className="card-title">What are you tracking?</h2>
      <p style={{ color: "var(--text-2)", marginTop: 0 }}>
        Pick anything that applies. This only changes what Afterlight offers you first — nothing is
        hidden, nothing is assumed about you, and this is not recorded as a diagnosis. Your
        diagnoses, if you have any, live in My Eyes with the clinician who documented them.
      </p>

      <div className="profile-grid">
        {CONDITION_PROFILES.map((profile) => {
          const on = selected.includes(profile.id);
          return (
            <div key={profile.id} className={`profile-option ${on ? "selected" : ""}`}>
              <input
                id={`profile-${profile.id}`}
                type="checkbox"
                checked={on}
                onChange={() => toggle(profile.id)}
              />
              <label htmlFor={`profile-${profile.id}`}>
                <span className="profile-label">{profile.label}</span>
                <span className="profile-blurb">{profile.blurb}</span>
              </label>
            </div>
          );
        })}
      </div>

      <p className="muted" style={{ marginBottom: 0 }}>
        {selected.length === 0
          ? "Nothing selected, so Afterlight offers the general set of symptoms and checks."
          : `${selected.length} selected. You can change this at any time.`}
      </p>
    </section>
  );
}
