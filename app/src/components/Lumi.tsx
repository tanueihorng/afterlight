import mascot from "../assets/mascot.webp";

/**
 * A small companion on the Today screen. Pure decoration: hidden from assistive tech, it floats
 * and sways slowly, and once today has been written down a soft glow settles behind it. It never
 * reacts to *what* was recorded, so it can never read as a verdict. It is a cartoon, not an eye.
 */
export default function Lumi({ resting }: { resting: boolean }) {
  return (
    <div className={`lumi ${resting ? "resting" : ""}`} aria-hidden="true">
      <span className="lumi-halo" />
      <img className="lumi-float" src={mascot} alt="" width={160} height={160} draggable={false} />
      <span className="lumi-shadow" />
    </div>
  );
}
