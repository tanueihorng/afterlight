import type { TestConditions } from "../../lib/models";
import { Field } from "../ui";

/**
 * A result without its conditions is not comparable with anything, so this is required rather
 * than optional. It is short deliberately: four answers, all of them things the person can see.
 */
export default function TestConditionsForm({
  value,
  onChange,
}: {
  value: TestConditions;
  onChange: (next: TestConditions) => void;
}) {
  return (
    <fieldset className="pref-group">
      <legend className="field-label">How are you doing this check?</legend>
      <p className="muted" style={{ marginTop: 0 }}>
        These have to match next time, or the two attempts cannot be compared with each other.
      </p>

      <div className="grid-2">
        <Field label="Distance from the screen (cm)">
          <input
            type="number"
            min={20}
            max={200}
            value={value.distance_cm ?? ""}
            onChange={(e) =>
              onChange({ ...value, distance_cm: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </Field>
        <Field label="Wearing">
          <select
            value={value.correction}
            onChange={(e) => onChange({ ...value, correction: e.target.value as TestConditions["correction"] })}
          >
            <option value="glasses">Glasses</option>
            <option value="contacts">Contact lenses</option>
            <option value="none">Nothing</option>
          </select>
        </Field>
      </div>

      <div className="grid-2">
        <Field label="Screen brightness">
          <select
            value={value.brightness ?? ""}
            onChange={(e) =>
              onChange({ ...value, brightness: (e.target.value || undefined) as TestConditions["brightness"] })
            }
          >
            <option value="">Not recorded</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </Field>
        <Field label="Room lighting">
          <select
            value={value.ambient ?? ""}
            onChange={(e) =>
              onChange({ ...value, ambient: (e.target.value || undefined) as TestConditions["ambient"] })
            }
          >
            <option value="">Not recorded</option>
            <option value="dark">Dark</option>
            <option value="dim">Dim</option>
            <option value="normal">Normal</option>
            <option value="bright">Bright</option>
          </select>
        </Field>
      </div>
    </fieldset>
  );
}
