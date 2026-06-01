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
 * This is the full headline loop across two real peers (tap mode — the
 * default, no camera needed), and it exercises every shared CRDT key:
 *  - phase is a shared Y.Map: when peer A advances the phase, peer B follows;
 *  - BOTH peers contribute their own idea privately, then release — so the
 *    pool is genuinely multi-author and each peer must see the other's idea
 *    in the shared Y.Array("ideas");
 *  - voting is collaborative: A and B both dot-vote the SAME idea, and the
 *    count must aggregate to 2 on both sides (nested Y.Map("votes") merges).
 *
 * This drives the genuine CRDT path (publishMyIdeas + toggleVote), not a stub.
 */
test("two peers each contribute an idea, then collaboratively vote", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    // Both phones join the brainstorm (arms the Yjs room on each side).
    await a.getByRole("button", { name: /join the brainstorm/i }).click();
    await b.getByRole("button", { name: /join the brainstorm/i }).click();

    // Both start in the shared "write" phase.
    await expect(a.locator(".brain-hud")).toContainText("write");
    await expect(b.locator(".brain-hud")).toContainText("write");

    // Each peer privately types its own idea — nothing is shared yet.
    const ideaA = "idea from peer A";
    const ideaB = "idea from peer B";
    await a.locator("textarea.brain-textarea").first().fill(ideaA);
    await b.locator("textarea.brain-textarea").first().fill(ideaB);

    // Peer A advances the shared phase; B must follow into "release".
    await a.getByRole("button", { name: /i'm done — go to release/i }).click();
    await expect(b.locator(".brain-hud")).toContainText("release");

    // Both peers release their idea into the shared anonymous pool.
    await a.getByRole("button", { name: /release my .* idea/i }).click();
    await b.getByRole("button", { name: /release my .* idea/i }).click();

    // The pool is multi-author: every peer must see BOTH ideas, proving the
    // Y.Array("ideas") merged writes from two independent peers.
    await expect(a.locator('[data-testid="brain-pool"]')).toHaveAttribute("data-idea-count", "2");
    await expect(b.locator('[data-testid="brain-pool"]')).toHaveAttribute("data-idea-count", "2");
    await expect(a.getByText(ideaB)).toBeVisible();
    await expect(b.getByText(ideaA)).toBeVisible();

    // Capture a shared idea id (peer A's idea, as seen in B's pool) to vote on.
    const ideaId = await b
      .locator('[data-testid="brain-idea"]', { hasText: ideaA })
      .getAttribute("data-idea-id");
    expect(ideaId).toBeTruthy();

    // Move both peers to the vote phase via shared session state.
    await a.getByRole("button", { name: "vote", exact: true }).click();
    await expect(b.locator(".brain-hud")).toContainText("vote");

    // Collaborative voting: A and B both dot-vote the same idea.
    await a.locator(`[data-testid="brain-vote-card"][data-idea-id="${ideaId}"]`).click();
    await b.locator(`[data-testid="brain-vote-card"][data-idea-id="${ideaId}"]`).click();

    // The nested Y.Map("votes") must aggregate both dots to 2 on BOTH peers.
    await expect(
      a.locator(`[data-testid="brain-vote-card"][data-idea-id="${ideaId}"]`),
    ).toHaveAttribute("data-vote-count", "2");
    await expect(
      b.locator(`[data-testid="brain-vote-card"][data-idea-id="${ideaId}"]`),
    ).toHaveAttribute("data-vote-count", "2");
  } finally {
    await cleanup();
  }
});
