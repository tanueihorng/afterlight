import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "./ErrorBoundary";
import * as archive from "../lib/archive";

function Boom(): never {
  throw new Error("the sky fell");
}

beforeEach(() => {
  // React logs the caught error; keep the test output readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ErrorBoundary", () => {
  it("renders its children when nothing is wrong", () => {
    render(
      <ErrorBoundary where="Today">
        <p>all fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("all fine")).toBeInTheDocument();
  });

  it("shows a calm message naming where it broke, and does not blame the data", () => {
    render(
      <ErrorBoundary where="Timeline">
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/This screen stopped working/)).toBeInTheDocument();
    expect(screen.getAllByText(/Timeline/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Your records are untouched/)).toBeInTheDocument();
  });

  it("offers an export that reads the database, not the crashed tree", async () => {
    const spy = vi
      .spyOn(archive, "downloadArchive")
      .mockResolvedValue({} as unknown as archive.Archive);
    render(
      <ErrorBoundary where="Imaging">
        <Boom />
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByRole("button", { name: /export my records/i }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Export downloaded/)).toBeInTheDocument();
  });

  it("says so plainly when the export itself fails", async () => {
    vi.spyOn(archive, "downloadArchive").mockRejectedValue(new Error("no"));
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByRole("button", { name: /export my records/i }));
    expect(await screen.findByText(/could not be created/)).toBeInTheDocument();
  });

  it("includes the failure in the copyable details", () => {
    render(
      <ErrorBoundary where="Today">
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/the sky fell/)).toBeInTheDocument();
  });
});
