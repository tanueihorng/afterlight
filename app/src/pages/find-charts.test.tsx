import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithStore } from "../test/renderWithStore";
import { aMeasurement, aPrescription } from "../test/factories";
import { shortcutsFor } from "../components/CommandPalette";
import MyEyes from "./MyEyes";
import Visualize from "./Visualize";

// People looked for pictures of their own record under "Visualize", which only holds generic
// anatomy. Every route to the charts is tested so that path does not quietly close again.

afterEach(() => {
  window.location.hash = "";
});

describe("finding the charts of your own record", () => {
  it("My Eyes shows where the charts will be even before anything is measured", async () => {
    await renderWithStore(<MyEyes />, {});
    const section = await screen.findByRole("region", { name: /recorded numbers over time/i });
    expect(section).toHaveTextContent(/no measurements or prescriptions are recorded yet/i);
  });

  it("My Eyes links straight to the charts and moves focus there", async () => {
    await renderWithStore(<MyEyes />, { measurements: [aMeasurement()] });
    const link = await screen.findByRole("link", { name: /charts of my recorded numbers/i });
    expect(link).toHaveAttribute("href", "#/my-eyes/trends");
    fireEvent.click(link);
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: /recorded numbers over time/i }),
    );
  });

  it("arriving at #/my-eyes/trends lands on the charts", async () => {
    window.location.hash = "#/my-eyes/trends";
    await renderWithStore(<MyEyes />, { measurements: [aMeasurement()] });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("region", { name: /recorded numbers over time/i }),
      ),
    );
  });

  it("Visualize says it is not your eye and points to your charts", async () => {
    await renderWithStore(<Visualize />, {});
    expect(await screen.findByText(/charts of the numbers in your own record/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /charts of my recorded numbers/i }));
    expect(window.location.hash).toBe("#/my-eyes/trends");
  });

  it("search offers the charts for the words people use for them", () => {
    for (const q of ["chart", "graph", "trends", "plot"]) {
      expect(shortcutsFor(q).map((s) => s.params)).toContainEqual(["trends"]);
    }
    expect(shortcutsFor("floaters")).toEqual([]);
    expect(shortcutsFor("g")).toEqual([]);
  });
});

describe("editing a prescription moves its chart", () => {
  it("changes the charted value in place, without adding a second record", async () => {
    const rx = aPrescription({
      date: "2024-03-01",
      right_eye: { sphere: -1.5, cylinder: -0.5, axis: 175 },
      left_eye: { sphere: -1.25 },
      notes: "kept through an edit",
    });
    await renderWithStore(<MyEyes />, { prescriptions: [rx] });
    expect(await screen.findByText(/sphere: one reading, -1\.50 D/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /edit the prescription from/i }));
    const dialog = await screen.findByRole("dialog", { name: /edit glasses/i });
    const spheres = within(dialog).getAllByLabelText(/^sphere$/i);
    fireEvent.change(spheres[0], { target: { value: "-2.25" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /save prescription/i }));

    expect(await screen.findByText(/sphere: one reading, -2\.25 D/i)).toBeInTheDocument();
    expect(screen.queryByText(/-1\.50 D/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /edit the prescription from/i })).toHaveLength(1);
  });
});
