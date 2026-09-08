import axe from "axe-core";
import { expect } from "vitest";

/**
 * Run axe over a rendered container and fail with something a person can act on.
 * No exceptions list: a violation is either fixed or the rule is wrong and removed deliberately.
 */
export async function expectNoA11yViolations(container: HTMLElement): Promise<void> {
  const results = await axe.run(container, {
    resultTypes: ["violations"],
    // The 3D explorer is an iframe; jsdom cannot host a real one, and its contents are audited
    // in their own right rather than through the host page.
    iframes: false,
    rules: {
      // Landmark and page-level rules need a whole document; pages are rendered in isolation here
      // and the shell's landmarks are covered by the App-level test.
      region: { enabled: false },
      "page-has-heading-one": { enabled: false },
    },
  });

  if (results.violations.length > 0) {
    const detail = results.violations
      .map((v) => {
        const nodes = v.nodes.slice(0, 3).map((n) => `      ${n.html}`).join("\n");
        return `  [${v.impact ?? "unknown"}] ${v.id}: ${v.help}\n${nodes}`;
      })
      .join("\n");
    expect.fail(`${results.violations.length} accessibility violation(s):\n${detail}`);
  }
}
