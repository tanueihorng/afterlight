import { useMemo } from "react";
import { TooMuchData, encodeQrText, qrToSvgPath } from "../lib/qr";

/**
 * A QR symbol as an SVG.
 *
 * Always black on white regardless of theme: a scanner needs the contrast, and a dark-theme QR
 * inverted is a QR most phone cameras will not read. It carries the text it encodes as its
 * accessible name, so the content is available to someone who cannot point a camera at it.
 */
export function QrCode({
  text,
  size = 240,
  label,
}: {
  text: string;
  size?: number;
  label: string;
}) {
  const rendered = useMemo(() => {
    try {
      const code = encodeQrText(text, "M");
      return { ...qrToSvgPath(code), version: code.version, error: null as string | null };
    } catch (e) {
      return {
        path: "",
        side: 0,
        version: 0,
        error: e instanceof TooMuchData ? e.message : "This could not be made into a QR code.",
      };
    }
  }, [text]);

  if (rendered.error) {
    return (
      <p role="alert" className="save-error">
        {rendered.error}
      </p>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${rendered.side} ${rendered.side}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      style={{ background: "#fff", borderRadius: 6, display: "block" }}
      shapeRendering="crispEdges"
    >
      <rect width={rendered.side} height={rendered.side} fill="#fff" />
      <path d={rendered.path} fill="#000" />
    </svg>
  );
}
