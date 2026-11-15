import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import EyeCanvas from "./EyeCanvas";

const pick = vi.hoisted(() => vi.fn(() => "cornea"));
vi.mock("../engine", () => ({
  GENERIC_MODEL_BOUNDARY: "Generic educational model, not your eye.",
  probeCapability: () => ({ webgl2: true }),
  EyeScene: class {
    pick = pick;
    ready = Promise.resolve();
    onContextLoss() {}
    resize() {}
    renderOnce() {}
    rotate() {}
    start() {}
    dispose() {}
    setAppearance() {}
  },
}));

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("PointerEvent", MouseEvent);
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  pick.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

it("selects on a click, but not after dragging or cancelling", () => {
  const onPick = vi.fn();
  render(<EyeCanvas options={{}} onPick={onPick} />);
  const canvas = screen.getByRole("img");
  fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20 });
  fireEvent.pointerUp(canvas, { clientX: 20, clientY: 20 });
  expect(onPick).toHaveBeenCalledWith("cornea");
  onPick.mockClear();
  fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20 });
  fireEvent.pointerMove(canvas, { clientX: 80, clientY: 20 });
  fireEvent.pointerUp(canvas, { clientX: 80, clientY: 20 });
  expect(onPick).not.toHaveBeenCalled();
  fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20 });
  fireEvent.pointerCancel(canvas, { clientX: 20, clientY: 20 });
  expect(onPick).not.toHaveBeenCalled();
});

it("uses the latest selection callback", () => {
  const first = vi.fn();
  const next = vi.fn();
  const { rerender } = render(<EyeCanvas options={{}} onPick={first} />);
  rerender(<EyeCanvas options={{}} onPick={next} />);
  const canvas = screen.getByRole("img");
  fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20 });
  fireEvent.pointerUp(canvas, { clientX: 20, clientY: 20 });
  expect(first).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalledWith("cornea");
});

it("does not offer a fullscreen button when the browser cannot enter fullscreen", () => {
  render(<EyeCanvas options={{}} />);
  expect(screen.queryByRole("button", { name: "Fullscreen" })).not.toBeInTheDocument();
});

it("says the 3D view is being prepared, then gets out of the way", async () => {
  render(<EyeCanvas options={{}} />);
  await waitFor(() =>
    expect(screen.queryByText(/preparing the 3d view/i)).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("img")).toBeInTheDocument();
});
