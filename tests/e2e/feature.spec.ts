import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

/**
 * Load-bearing cross-peer assertion for the advertised core action:
 * "type up to 3 ideas privately on a synced timer, release into a shuffled
 * anonymous pool, dot-vote for the top 3."
 *
 * Concretely (tap mode — the default, no camera needed):
 *  - phase is a shared Y.Map: when peer A advances the phase, peer B follows;
 *  - an idea released on peer A lands in the shared Y.Array("ideas") and shows
 *    up in peer B's pool;
 *  - a dot vote cast on peer A increments the count peer B reads from the
 *    nested Y.Map("votes").
 *
 * This drives the genuine CRDT path (publishMyIdeas + toggleVote), not a stub.
 */
test("an idea released and voted on peer A propagates to peer B", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    // Both phones join the brainstorm (arms the Yjs room on each side).
    await a.getByRole("button", { name: /join the brainstorm/i }).click();
    await b.getByRole("button", { name: /join the brainstorm/i }).click();

    // Both start in the shared "write" phase.
    await expect(a.locator(".brain-hud")).toContainText("write");
    await expect(b.locator(".brain-hud")).toContainText("write");

    // Peer A privately types an idea, then advances the shared phase.
    const ideaText = "ship the cross-peer test";
    await a.locator("textarea.brain-textarea").first().fill(ideaText);
    await a.getByRole("button", { name: /i'm done — go to release/i }).click();

    // Phase is shared state: peer B must follow A into "release".
    await expect(b.locator(".brain-hud")).toContainText("release");

    // Peer A releases the idea into the shared anonymous pool.
    await a.getByRole("button", { name: /release my .* idea/i }).click();

    // Peer B must see the released idea — proves Y.Array("ideas") crossed mesh.
    await expect(b.locator('[data-testid="brain-pool"]')).toHaveAttribute("data-idea-count", "1");
    await expect(b.getByText(ideaText)).toBeVisible();

    // Capture the idea id from peer B's pool, then move both peers to vote.
    const ideaId = await b
      .locator('[data-testid="brain-idea"]')
      .first()
      .getAttribute("data-idea-id");
    expect(ideaId).toBeTruthy();

    await a.getByRole("button", { name: "vote", exact: true }).click();
    await expect(b.locator(".brain-hud")).toContainText("vote");

    // Peer A casts a dot vote.
    await a.locator(`[data-testid="brain-vote-card"][data-idea-id="${ideaId}"]`).click();

    // Peer B must read the incremented vote count from the nested Y.Map.
    await expect(
      b.locator(`[data-testid="brain-vote-card"][data-idea-id="${ideaId}"]`),
    ).toHaveAttribute("data-vote-count", "1");
  } finally {
    await cleanup();
  }
});
