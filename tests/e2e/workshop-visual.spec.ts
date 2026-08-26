import { expect, test } from "@playwright/test";

const APP_PATH = "/mesh-brain-write/";

type Viewport = {
  name: string;
  width: number;
  height: number;
};

const FIRST_VIEWPORTS: Viewport[] = [
  { name: "phone", width: 390, height: 844 },
  { name: "shared-display", width: 1141, height: 602 },
];

test("the writing invitation and first draft stay visible at phone and display sizes", async ({
  page,
}, testInfo) => {
  for (const viewport of FIRST_VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto(APP_PATH, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Quiet Draft" })).toBeVisible();
    const start = page.getByRole("button", { name: /start a private draft/i });
    await expect(start).toBeVisible();
    const startBox = await start.boundingBox();
    expect(startBox, `${viewport.name} start action has a box`).not.toBeNull();
    expect(
      (startBox?.y ?? viewport.height) + (startBox?.height ?? 0),
      `${viewport.name} start action remains in the first viewport`,
    ).toBeLessThanOrEqual(viewport.height);

    await page.screenshot({
      path: testInfo.outputPath(`quiet-draft-${viewport.name}-landing.png`),
      fullPage: false,
    });

    await start.click();
    const firstDraft = page.getByRole("textbox", { name: "Idea 1" });
    await expect(firstDraft).toBeVisible();
    const draftBox = await firstDraft.boundingBox();
    expect(draftBox, `${viewport.name} first writing field has a box`).not.toBeNull();
    expect(
      (draftBox?.y ?? viewport.height) + Math.min(draftBox?.height ?? 0, 44),
      `${viewport.name} first writing field remains immediately usable`,
    ).toBeLessThanOrEqual(viewport.height);

    await page.screenshot({
      path: testInfo.outputPath(`quiet-draft-${viewport.name}-workspace.png`),
      fullPage: false,
    });
  }
});

test("the workshop keeps its primary flow and settings reachable by keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(APP_PATH, { waitUntil: "domcontentloaded" });

  const start = page.getByRole("button", { name: /start a private draft/i });
  await start.focus();
  await expect(start).toBeFocused();
  await page.keyboard.press("Enter");

  const firstDraft = page.getByRole("textbox", { name: "Idea 1" });
  await expect(firstDraft).toBeVisible();
  await firstDraft.focus();
  await page.keyboard.type("A quieter way to welcome new contributors");
  await expect(firstDraft).toHaveValue(/quieter way/i);

  const settings = page.getByLabel("Open settings");
  await settings.click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Room ID" })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Prompt" })).toBeVisible();
});
