import { describe, expect, it } from "vitest";
import { mulberry32, seededShuffle } from "../../src/features/brain/shuffle";

describe("anonymous idea ordering", () => {
  it("gives every peer the same deterministic release order without mutating input", () => {
    const ideas = ["first", "second", "third", "fourth", "fifth"];

    const onWriterA = seededShuffle(ideas, 1_725_000_123);
    const onWriterB = seededShuffle(ideas, 1_725_000_123);

    expect(onWriterA).toEqual(onWriterB);
    expect(onWriterA).toHaveLength(ideas.length);
    expect([...onWriterA].sort()).toEqual([...ideas].sort());
    expect(ideas).toEqual(["first", "second", "third", "fourth", "fifth"]);
  });

  it("keeps its seed stream stable for a shared release timestamp", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);

    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
