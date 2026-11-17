import { StrictMode, useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal, useNativeDialog } from "./ui";
import { Popover } from "./Chrome";

function Opener({ nested }: { nested?: boolean }) {
  const [outer, setOuter] = useState(false);
  const [inner, setInner] = useState(false);
  return (
    <>
      <button onClick={() => setOuter(true)}>Open</button>
      {outer && (
        <Modal title="Outer" onClose={() => setOuter(false)}>
          <input aria-label="First field" />
          {nested && <button onClick={() => setInner(true)}>Open inner</button>}
          {inner && (
            <Modal title="Inner" onClose={() => setInner(false)}>
              <p>Inner body</p>
            </Modal>
          )}
        </Modal>
      )}
    </>
  );
}

describe("Modal on the native <dialog>", () => {
  it("opens modally, is named by its heading, and carries no hand-written dialog ARIA", async () => {
    const user = userEvent.setup();
    render(<Opener />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog", { name: "Outer" });
    expect(dialog.tagName).toBe("DIALOG");
    expect((dialog as HTMLDialogElement).open).toBe(true);
    expect(dialog).not.toHaveAttribute("role");
    expect(dialog).not.toHaveAttribute("aria-modal");
    // The first field, not the close button.
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "First field" }));
  });

  it("stays open under StrictMode's mount, unmount and remount", async () => {
    // The first close() queues a `close` event that lands after the remount reopened the
    // dialog; it must not be read as the person dismissing it.
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Opener />
      </StrictMode>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByRole("dialog", { name: "Outer" })).toBeInTheDocument();
  });

  it("closes on Escape and hands focus back to the opener", async () => {
    const user = userEvent.setup();
    render(<Opener />);
    const opener = screen.getByRole("button", { name: "Open" });
    await user.click(opener);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("closes only the innermost of two stacked dialogs on one Escape", async () => {
    const user = userEvent.setup();
    render(<Opener nested />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.click(screen.getByRole("button", { name: "Open inner" }));
    expect(screen.getByRole("dialog", { name: "Inner" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Inner" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Outer" })).toBeInTheDocument();
  });

  it("closes on a press and release outside its box, not on one inside", async () => {
    const user = userEvent.setup();
    render(<Opener />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog", { name: "Outer" });
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 100, 300, 200));

    // On the dialog's own padding: the target is the dialog, but the point is inside its box.
    fireEvent.pointerDown(dialog, { clientX: 150, clientY: 150 });
    fireEvent.pointerUp(dialog, { clientX: 150, clientY: 150 });
    expect(screen.getByRole("dialog", { name: "Outer" })).toBeInTheDocument();

    // A text selection that starts inside and ends on the backdrop does not dismiss.
    fireEvent.pointerDown(dialog, { clientX: 150, clientY: 150 });
    fireEvent.pointerUp(dialog, { clientX: 20, clientY: 20 });
    expect(screen.getByRole("dialog", { name: "Outer" })).toBeInTheDocument();

    // On the backdrop: ::backdrop events target the dialog, outside its box.
    fireEvent.pointerDown(dialog, { clientX: 20, clientY: 20 });
    fireEvent.pointerUp(dialog, { clientX: 20, clientY: 20 });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

function Locked({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useNativeDialog(ref, onClose, { escape: false, lightDismiss: false });
  return (
    <dialog ref={ref} aria-label="Locked">
      <button>Only way out</button>
    </dialog>
  );
}

describe("where focus starts", () => {
  it("starts on the heading, never on a button, when there is no field", async () => {
    const user = userEvent.setup();
    function Detail() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>View</button>
          {open && (
            <Modal title="Drawing" onClose={() => setOpen(false)}>
              <button>Delete drawing</button>
            </Modal>
          )}
        </>
      );
    }
    render(<Detail />);
    await user.click(screen.getByRole("button", { name: "View" }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Drawing" }));
  });
});

describe("an Escape the browser would not let the page cancel", () => {
  it("runs onClose once, not again on the close that follows", async () => {
    const onClose = vi.fn();
    function Kept() {
      const ref = useRef<HTMLDialogElement>(null);
      useNativeDialog(ref, onClose);
      return <dialog ref={ref} aria-label="Kept" />;
    }
    render(<Kept />);
    const dialog = screen.getByRole("dialog", { name: "Kept" }) as HTMLDialogElement;
    // Chromium's close watcher: with no user activation, cancel is not cancelable and the
    // dialog closes regardless.
    act(() => {
      dialog.dispatchEvent(new Event("cancel", { cancelable: false }));
      dialog.close();
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("a dialog that must not be dismissed (onboarding)", () => {
  it("tells the browser so with closedby=none", () => {
    render(<Locked onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Locked" })).toHaveAttribute("closedby", "none");
  });

  it("ignores Escape and clicks outside", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Locked onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "Locked" }) as HTMLDialogElement;
    await user.keyboard("{Escape}");
    fireEvent.pointerDown(dialog, { clientX: 5000, clientY: 5000 });
    fireEvent.pointerUp(dialog, { clientX: 5000, clientY: 5000 });
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.open).toBe(true);
  });

  it("reopens if the browser closes it anyway, with focus where it was", async () => {
    render(<Locked onClose={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "Locked" }) as HTMLDialogElement;
    const button = screen.getByRole("button", { name: "Only way out" });
    act(() => button.focus());
    act(() => {
      dialog.close();
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await waitFor(() => expect(dialog.open).toBe(true));
    await waitFor(() => expect(document.activeElement).toBe(button));
  });
});

describe("Popover on the native popover API", () => {
  it("is invoked declaratively, opens, and closes from its content", async () => {
    const user = userEvent.setup();
    render(
      <Popover label="Appearance" icon="palette" buttonClass="icon-btn">
        {(close) => <button onClick={close}>Done</button>}
      </Popover>,
    );
    const button = screen.getByRole("button", { name: "Appearance" });
    const panel = document.getElementById(button.getAttribute("popovertarget")!)!;
    expect(panel).toHaveAttribute("popover", "auto");
    expect(button).toHaveAttribute("aria-expanded", "false");

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(panel).toHaveAttribute("data-popover-open");
    // jsdom's stylesheet hides every [popover] (it has no :popover-open), so the open panel
    // reads as hidden here; the real browser check is in the Playwright suite.
    await user.click(screen.getByRole("button", { name: "Done", hidden: true }));
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(panel).not.toHaveAttribute("data-popover-open");
  });

  it("hands focus back to the menu's button when a menu item opened a dialog", async () => {
    function Menu() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Popover label="More" icon="palette" buttonClass="icon-btn">
            {(close) => (
              <button
                onClick={() => {
                  close();
                  setOpen(true);
                }}
              >
                Export
              </button>
            )}
          </Popover>
          {open && (
            <Modal title="Export" onClose={() => setOpen(false)}>
              <p>Body</p>
            </Modal>
          )}
        </>
      );
    }
    const user = userEvent.setup();
    render(<Menu />);
    const button = screen.getByRole("button", { name: "More" });
    await user.click(button);
    const item = screen.getByRole("button", { name: "Export", hidden: true });
    // The item keeps focus while the panel closes, as it does when picked from the keyboard.
    item.focus();
    fireEvent.click(item);
    expect(screen.getByRole("dialog", { name: "Export" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});
