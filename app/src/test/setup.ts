import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);

// jsdom has no canvas backend; the drawing renderer only needs the calls not to throw.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: { ...globalThis.crypto, randomUUID: () => `test-${Math.random().toString(36).slice(2)}` },
  });
}

// jsdom implements neither showModal() nor the popover API. These shims mirror only the parts of
// the browser contract the app relies on — open state, Escape as a cancellable `cancel` on the
// topmost modal, `close`, and popover toggling — so components can be exercised here. Real
// browsers (top layer, inertness, focus containment) are proven by the Playwright suite.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  const modals: HTMLDialogElement[] = [];
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    if (this.open) throw new DOMException("already open", "InvalidStateError");
    this.setAttribute("open", "");
    modals.push(this);
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute("open");
    modals.splice(modals.indexOf(this), 1);
    // Browsers queue `close` as a task rather than firing it inside close().
    setTimeout(() => this.dispatchEvent(new Event("close")));
  };
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    const open = modals.filter((d) => d.isConnected);
    const top = open[open.length - 1];
    if (top && top.dispatchEvent(new Event("cancel", { cancelable: true }))) top.close();
  });
}

if (!Object.prototype.hasOwnProperty.call(HTMLElement.prototype, "popover")) {
  const toggle = (el: HTMLElement, open: boolean) => {
    if (el.hasAttribute("data-popover-open") === open) return;
    const state = { oldState: open ? "closed" : "open", newState: open ? "open" : "closed" };
    el.dispatchEvent(Object.assign(new Event("beforetoggle"), state));
    el.toggleAttribute("data-popover-open", open);
    el.dispatchEvent(Object.assign(new Event("toggle"), state));
  };
  HTMLElement.prototype.showPopover = function (this: HTMLElement) {
    toggle(this, true);
  };
  HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
    toggle(this, false);
  };
  document.addEventListener("click", (e) => {
    const invoker = (e.target as Element | null)?.closest?.("[popovertarget]");
    const target = invoker && document.getElementById(invoker.getAttribute("popovertarget")!);
    if (target) toggle(target, !target.hasAttribute("data-popover-open"));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.querySelectorAll<HTMLElement>("[data-popover-open]").forEach((p) => toggle(p, false));
  });
}
