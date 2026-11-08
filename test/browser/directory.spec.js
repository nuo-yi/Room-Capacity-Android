import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mockRooms, noOverflow, setFilters } from './fixtures.js';
const catalog = JSON.parse(await readFile(new URL('../../data/rooms.json', import.meta.url), 'utf8'));

test('offline catalog supports aliases, fuzzy search and building selection', async ({ page }, info) => {
  await mockRooms(page, []); await page.goto('/');
  const search = page.getByRole('searchbox');
  await expect(page.getByRole('article')).toHaveCount(68);
  for (const query of ['sauder', 'saudre', 'business sauder']) {
    await search.fill(query); await expect(page.getByRole('article')).toHaveCount(2);
    for (const item of await page.getByRole('article').all()) await expect(item).toContainText('ANGU');
  }
  await setFilters(page, info, { building: 'Allard Hall' }); await expect(page.getByRole('article')).toHaveCount(0);
  await setFilters(page, info, { building: 'all' });
  for (const query of ['atrium','atrim']) { await search.fill(query); await expect(page.getByRole('article')).toHaveCount(7); }
  await search.fill('cafe'); await expect(page.getByRole('article')).toHaveCount(catalog.filter(room => /café/i.test(room.name)).length);
  await noOverflow(page);
});

test('partial API records reuse catalog metadata and count coverage once', async ({ page }) => {
  const listing = catalog[0];
  await mockRooms(page, [{ room_id: 'existing-room', name: listing.name, source_url: `${listing.source_url}/`, location: {}, latest_reading: { measured_at: new Date().toISOString(), people_count: 0, noise_level: .1, noise_unit: 'relative' } }]);
  await page.goto('/'); await expect(page.getByRole('article')).toHaveCount(68);
  await expect(page.getByLabel('Live coverage')).toContainText('1 of 68');
  await page.getByRole('searchbox').fill(listing.name); await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('100 seats');
  await page.getByRole('button', { name: `View ${listing.name}`, exact: true }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('link', { name: /Directions/ })).toHaveAttribute('href', /1822/);
  const photo = dialog.getByRole('img', { name: /study area/ }); await expect(photo).toHaveAttribute('src', /^\/images\/study-spaces\//);
  await expect.poll(() => photo.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await expect(dialog).toContainText('Photo: UBC Learning Spaces'); await noOverflow(page);
});
