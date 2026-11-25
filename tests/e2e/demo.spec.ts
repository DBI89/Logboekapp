import { test, expect, type Page } from "@playwright/test";

async function wissel(page: Page, naam: string) {
  const sel = page.getByLabel("Wissel van gebruiker");
  const waarde = await sel.locator("option", { hasText: naam }).getAttribute("value");
  await sel.selectOption(waarde!);
  await expect(sel).toHaveValue(waarde!);
  await page.waitForTimeout(1500);
}

test("demoscenario: melden, omzetten, goedkeuren, importeren en exporteren", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mijn werk" })).toBeVisible();
  const basis = page.url().replace(/\/mijn-werk$/, "");

  // (a) snel melden als teamlid
  await page.goto(`${basis}/inbox`);
  await wissel(page, "Lotte");
  await page.getByLabel("Snel melden").fill("Sparing voor kabels in landhoofd #VN-SP-1");
  await page.getByRole("button", { name: "Melden", exact: true }).click();
  await expect(page.getByText("staat in de inbox")).toBeVisible();
  await expect(page.getByRole("button", { name: "Omzetten" })).toHaveCount(0);

  // (b) als ontwerpleider omzetten naar afwijking
  await wissel(page, "Sanne");
  await page.reload();
  const kaart = page.locator("li.kaart", { hasText: "Sparing voor kabels in landhoofd" });
  await kaart.getByRole("button", { name: "Omzetten" }).click();
  await kaart.getByLabel("Afwijking").check();
  await kaart.locator("form").getByRole("button", { name: "Omzetten" }).click();
  await expect(page).toHaveURL(/registraties\/AF-0002/);

  // (c) AF-0001 staat ter goedkeuring bij Sanne en wordt goedgekeurd
  await page.goto(`${basis}/mijn-werk`);
  await expect(page.getByText("AF-0001")).toBeVisible();
  await page.goto(`${basis}/registraties/AF-0001`);
  await page.getByLabel("Nieuwe status").selectOption({ label: "Goedkeuren" });
  await page.getByRole("button", { name: "Bevestigen" }).click();
  await expect(page.locator("header").getByText("Goedgekeurd")).toBeVisible();

  // gescheiden overzicht
  await page.locator("#hoofdmenu").getByRole("link", { name: "Afwijkingen" }).click();
  await expect(page.getByRole("heading", { name: "Afwijkingen" })).toBeVisible();
  await expect(page.getByRole("link", { name: "AF-0001" })).toBeVisible();

  // voortgang bij een issue en bevriezen bij in behandeling
  await page.goto(`${basis}/registraties/IS-0001`);
  await expect(page.getByLabel("Titel")).toBeVisible();
  await page.getByLabel("Nieuwe voortgang").fill("Geotechnisch adviseur gebeld");
  await page.getByRole("button", { name: "Voortgang toevoegen" }).click();
  await expect(page.getByText("Geotechnisch adviseur gebeld")).toBeVisible();
  await page.getByLabel("Nieuwe status").selectOption({ label: "In behandeling" });
  await page.getByRole("button", { name: "Bevestigen" }).click();
  await expect(page.getByText("De tekst ligt vast.")).toBeVisible();

  // (d) DO-import levert IS-0001 op 'Te herkoppelen'
  await page.goto(`${basis}/import`);
  await page.getByRole("button", { name: "Voorbeeld DO-import laden" }).click();
  await page.getByRole("button", { name: "Controleren" }).first().click();
  await expect(page.getByText("Verdwenen (1)")).toBeVisible();
  await page.getByRole("button", { name: "Import uitvoeren" }).click();
  await expect(page.getByText("Import uitgevoerd")).toBeVisible();
  await page.reload();
  await expect(page.locator("section", { hasText: "Te herkoppelen" }).getByText("IS-0001")).toBeVisible();

  // documentenlijst importeren
  await page.goto(`${basis}/import`);
  await page.getByRole("button", { name: "Voorbeeld documentenlijst laden" }).click();
  await page.getByRole("button", { name: "Controleren" }).last().click();
  await page.getByRole("button", { name: "Documentenlijst importeren" }).click();
  await expect(page.getByText("1 nieuw, 3 bijgewerkt")).toBeVisible();

  // (e) Word-export van de VO-nota
  await page.goto(`${basis}/documenten/VN-NOT-001`);
  await expect(page.getByRole("heading", { name: "Afwijkingen" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download Word" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.docx$/);
});
