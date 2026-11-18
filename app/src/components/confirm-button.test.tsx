import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { CONFIRM_ARMED_MS, ConfirmButton } from "./ui";

function setup() {
  const onConfirm = vi.fn();
  render(
    <>
      <ConfirmButton label="Delete" confirmLabel="Delete this drawing?" onConfirm={onConfirm} />
      <button>Elsewhere</button>
    </>,
  );
  return { onConfirm, button: () => screen.getByRole("button", { name: /^delete/i }) };
}

describe("a two-step delete", () => {
  afterEach(() => vi.useRealTimers());

  it("asks on the first press and acts only on the second", () => {
    const { onConfirm, button } = setup();
    fireEvent.click(button());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(button()).toHaveTextContent("Delete this drawing?");
    fireEvent.click(button());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(button()).toHaveTextContent(/^Delete$/);
  });

  it("tells a screen reader what changed", () => {
    const { button } = setup();
    const live = document.querySelector('[aria-live="polite"]');
    expect(live).toHaveTextContent("");
    fireEvent.click(button());
    expect(live).toHaveTextContent("Delete this drawing? Press again to confirm.");
  });

  it("stays armed long enough to find and press again, then cancels", () => {
    vi.useFakeTimers();
    const { onConfirm, button } = setup();
    fireEvent.click(button());
    // The old button gave up after 2.6s, before someone using a magnifier could press it again.
    act(() => vi.advanceTimersByTime(5_000));
    expect(button()).toHaveTextContent("Delete this drawing?");
    act(() => vi.advanceTimersByTime(CONFIRM_ARMED_MS - 5_000));
    expect(button()).toHaveTextContent(/^Delete$/);
    fireEvent.click(button());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cancels when focus moves away, so a later press never deletes", () => {
    const { onConfirm, button } = setup();
    button().focus();
    fireEvent.click(button());
    fireEvent.blur(button());
    expect(button()).toHaveTextContent(/^Delete$/);
    fireEvent.click(button());
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
