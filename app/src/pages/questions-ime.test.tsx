import { expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithStore } from "../test/renderWithStore";
import { loadAllData } from "../lib/db";
import { useStore } from "../lib/store";
import Appointments from "./Appointments";

function Ready() {
  return useStore().ready ? <Appointments /> : <p>Loading</p>;
}

async function openQuestions() {
  await renderWithStore(<Ready />, {});
  await userEvent.click((await screen.findAllByRole("button", { name: /questions for my doctor/i }))[0]);
  return screen.findByRole("textbox", { name: /new question/i });
}

it("does not save a question on the Enter that confirms IME composition", async () => {
  const input = await openQuestions();
  fireEvent.change(input, { target: { value: "網膜" } });
  // The confirming Enter of a CJK input method: composing, keyCode 229. Nothing may handle it.
  fireEvent.keyDown(input, { key: "Enter", keyCode: 229, isComposing: true });
  await new Promise((r) => setTimeout(r, 20));
  expect((await loadAllData()).questions).toHaveLength(0);
  expect(input).toHaveValue("網膜");
});

it("saves a question when the form is submitted", async () => {
  const input = await openQuestions();
  await userEvent.type(input, "Is the retina fully attached?{Enter}");
  await waitFor(async () => expect((await loadAllData()).questions).toHaveLength(1));
  expect(input).toHaveValue("");
});
