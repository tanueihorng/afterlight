import type { RetinaState } from "../lib/education";

/**
 * Generic cross-section of an eye, drawn to illustrate retinal states (§24, §25).
 * Deliberately schematic — it is teaching material, never a depiction of a specific patient.
 */
export default function RetinaDiagram({
  state,
  eye = "right",
  labels = true,
  width = 420,
}: {
  state: RetinaState;
  eye?: "right" | "left";
  labels?: boolean;
  width?: number;
}) {
  // The nasal/temporal flip is the only difference between the two eyes here.
  const flip = eye === "left";

  const detached =
    state === "local_detachment" || state === "large_detachment" || state === "macula_off";
  const large = state === "large_detachment" || state === "macula_off";

  return (
    <svg
      viewBox="0 0 470 330"
      width={width}
      style={{ maxWidth: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={`Schematic cross-section of a ${eye} eye showing: ${state.replace(/_/g, " ")}`}
    >
      <g transform={flip ? "translate(470,0) scale(-1,1)" : undefined}>
        <g transform="translate(35,0)">
        {/* sclera / globe */}
        <circle cx="200" cy="160" r="128" fill="var(--bg-elev)" stroke="var(--border)" strokeWidth="2" />
        <circle cx="200" cy="160" r="120" fill="none" stroke="var(--text-3)" strokeWidth="6" opacity="0.35" />

        {/* retina — the inner lining */}
        <circle
          cx="200"
          cy="160"
          r="112"
          fill="none"
          stroke="var(--accent-strong)"
          strokeWidth="4"
          opacity="0.9"
          strokeDasharray={state === "healthy" || state === "pvd" ? undefined : "0"}
        />

        {/* vitreous cavity */}
        <circle cx="200" cy="160" r="108" fill="var(--bg)" opacity="0.55" />

        {/* posterior vitreous detachment: gel pulled forward off the retinal surface */}
        {(state === "pvd" || state === "tear" || detached) && (
          <path
            d="M 108 110 Q 200 250 292 110"
            fill="none"
            stroke="var(--text-3)"
            strokeWidth="3"
            opacity="0.8"
            strokeDasharray="6 5"
          />
        )}

        {/* cornea + lens at the front (left side of the drawing) */}
        <path d="M 88 118 Q 58 160 88 202" fill="none" stroke="var(--text-2)" strokeWidth="4" opacity="0.7" />
        <ellipse cx="100" cy="160" rx="14" ry="30" fill="var(--accent-soft)" stroke="var(--text-3)" strokeWidth="2" />

        {/* optic nerve at the back */}
        <path d="M 312 148 h 34 v 24 h -34 z" fill="var(--bg-elev)" stroke="var(--border)" strokeWidth="2" />

        {/* macula marker */}
        <circle
          cx="306"
          cy="188"
          r="7"
          fill={state === "macula_off" ? "var(--diagram-alert)" : "var(--accent-strong)"}
          opacity={state === "macula_off" ? 0.9 : 0.55}
        />

        {/* retinal break */}
        {(state === "tear" || detached || state === "treated_laser" || state === "buckle") && (
          <path
            d="M 268 74 l 14 -10 l 6 14"
            fill="none"
            stroke="var(--diagram-alert)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        )}

        {/* detached retina lifting off the wall */}
        {detached && (
          <path
            d={
              large
                ? "M 272 72 Q 214 116 232 208 Q 268 236 306 196"
                : "M 272 72 Q 232 104 244 150"
            }
            fill="none"
            stroke="var(--diagram-alert)"
            strokeWidth="4"
            opacity="0.95"
            strokeLinecap="round"
          />
        )}

        {/* laser scars sealing the break */}
        {state === "treated_laser" && (
          <g fill="var(--diagram-good)" opacity="0.9">
            {[
              [258, 66], [270, 58], [284, 56], [296, 64], [300, 78], [292, 90], [276, 92], [262, 84],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="3.4" />
            ))}
          </g>
        )}

        {/* scleral buckle indenting the wall from outside */}
        {state === "buckle" && (
          <>
            <path
              d="M 250 40 Q 292 56 300 96"
              fill="none"
              stroke="var(--accent-strong)"
              strokeWidth="10"
              strokeLinecap="round"
              opacity="0.85"
            />
            <path
              d="M 258 74 Q 276 92 288 96"
              fill="none"
              stroke="var(--text-3)"
              strokeWidth="3"
              strokeDasharray="4 4"
            />
          </>
        )}

        {/* gas bubble filling the upper cavity */}
        {state === "gas" && (
          <>
            <path
              d="M 200 160 m -104 0 a 104 104 0 0 1 208 0 z"
              fill="var(--accent-soft)"
              opacity="0.85"
            />
            <line x1="96" y1="160" x2="304" y2="160" stroke="var(--accent-strong)" strokeWidth="2.5" opacity="0.9" />
          </>
        )}
        </g>
      </g>

      {labels && (
        <g
          fontSize="11"
          fill="var(--text-3)"
          fontFamily="var(--font-sans, system-ui)"
        >
          <text x="235" y="318" textAnchor="middle">
            Schematic {eye === "right" ? "right (OD)" : "left (OS)"} eye — front of the eye on the{" "}
            {flip ? "right" : "left"}
          </text>
          <text x="235" y="20" textAnchor="middle">
            retina
          </text>
          <line x1="235" y1="26" x2="235" y2="46" stroke="var(--border)" strokeWidth="1" />

          <text x={flip ? 458 : 12} y="248" textAnchor={flip ? "end" : "start"}>
            lens
          </text>
          <line
            x1={flip ? 424 : 46}
            y1="244"
            x2={flip ? 336 : 134}
            y2="186"
            stroke="var(--border)"
            strokeWidth="1"
          />

          <text x={flip ? 12 : 458} y="118" textAnchor={flip ? "start" : "end"}>
            optic nerve
          </text>
          <line
            x1={flip ? 46 : 424}
            y1="122"
            x2={flip ? 100 : 370}
            y2="152"
            stroke="var(--border)"
            strokeWidth="1"
          />

          <text x={flip ? 12 : 458} y="266" textAnchor={flip ? "start" : "end"}>
            macula
          </text>
          <line
            x1={flip ? 46 : 424}
            y1="262"
            x2={flip ? 130 : 340}
            y2="196"
            stroke="var(--border)"
            strokeWidth="1"
          />

          {state === "gas" && (
            <text x="235" y="112" textAnchor="middle" fill="var(--accent-strong)">
              gas bubble
            </text>
          )}
          {state === "buckle" && (
            <text x={flip ? 120 : 350} y="34" textAnchor="middle" fill="var(--accent-strong)">
              buckle
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
