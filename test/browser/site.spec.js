import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockRooms, rooms, card, noOverflow, setFilters } from './fixtures.js';

test('directory opens with fresh rooms first and usable independent metrics', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await mockRooms(page); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Find your space.' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(71);
  await expect(card(page, 'Reading Room')).toContainText('9 seats');
  await expect(card(page, 'Reading Room')).toContainText('Quiet');
  await expect(card(page, 'Pending Room')).toContainText('No live readings');
  await expect(card(page, 'Pending Room')).toContainText('Capacity unknown');
  await expect(page.getByLabel('Live coverage')).toContainText('2 of 71');
  await expect(page.getByRole('article').first()).toContainText('Group Studio');
  await noOverflow(page); expect(errors).toEqual([]);
});

test('search, quick filters, building selection and reset compose', async ({ page }, info) => {
  await mockRooms(page); await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search by building or room' });
  await expect(search).not.toBeFocused(); await search.fill('studio');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear search' }).click();
  const filters = page.getByRole('group', { name: 'Filter spaces' });
  await filters.getByRole('button', { name: 'Seats available' }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await filters.getByRole('button', { name: 'Quiet', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await setFilters(page, info, { building: 'Test Student Hub' });
  await expect(page.getByRole('heading', { name: 'No spaces match just yet.' })).toBeVisible();
  await expect(search).toBeVisible();
  await page.getByRole('button', { name: 'Show all spaces' }).click();
  await expect(page.getByRole('article')).toHaveCount(71); await noOverflow(page);
});

test('saved rooms persist without readings and details restore search, focus and Back', async ({ page }) => {
  await mockRooms(page); await page.goto('/');
  const search = page.getByRole('searchbox'); await search.fill('ALRD');
  const first = page.getByRole('article').first();
  await first.getByRole('button', { name: /^Save / }).click();
  const open = first.getByRole('button', { name: /^View / }); await open.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog'); await expect(dialog).toContainText('Recent occupancy');
  await expect(dialog.getByRole('link', { name: /Directions/ })).toHaveAttribute('href', /destination=/);
  await expect(dialog.getByRole('link', { name: 'View on UBC' })).toHaveAttribute('href', /learningspaces.ubc.ca/);
  await expect(page).toHaveURL(/room=/); await page.goBack();
  await expect(dialog).toHaveCount(0); await expect(search).toHaveValue('ALRD'); await expect(open).toBeFocused();
  await page.reload(); await page.getByRole('button', { name: 'Saved spaces (1)', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(1); await expect(page.getByRole('article')).toContainText('No live readings');
});

test('deep links, history and local chart recovery leave directions usable', async ({ page }) => {
  await mockRooms(page); let failed = true;
  await page.route('**/api/readings?*', route => route.fulfill(failed ? { status: 503, json: {} } : { json: { readings: [{ people_count: 0, measured_at: new Date().toISOString() }] } }));
  await page.goto('/?room=reading'); const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Occupancy history couldn’t be loaded.');
  await expect(dialog.getByRole('link', { name: /Directions/ })).toBeVisible();
  failed = false; await dialog.getByRole('button', { name: /Try again/ }).click();
  await expect(dialog.getByRole('img', { name: /People count over time, 1 readings/ })).toBeVisible();
  await expect(dialog).toContainText('Latest count: 0 people');
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(page).not.toHaveURL(/room=/);
});

test('first failure, retained refresh data and stale readings recover without samples', async ({ page }) => {
  await page.clock.install(); let healthy = false; const data = [rooms()[0]];
  await page.route('**/api/rooms*', route => route.fulfill(healthy ? { json: { rooms: data, stale_after_seconds: 60 } } : { status: 503, json: {} }));
  await page.goto('/'); await expect(page.getByRole('alert')).toContainText("Couldn't load study spaces");
  await expect(page.getByRole('article')).toHaveCount(68);
  healthy = true; await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(card(page, 'Reading Room')).toContainText('9 seats');
  healthy = false; await page.clock.fastForward(11000);
  await expect(page.getByRole('alert')).toContainText('Last successful check:');
  await page.clock.fastForward(60000); await expect(card(page, 'Reading Room')).toContainText('Reading delayed');
  await expect(card(page, 'Reading Room')).not.toContainText('9 seats');
  await expect(page.getByLabel('Live coverage')).toContainText('0 of 69');
  healthy = true; data[0].latest_reading.measured_at = await page.evaluate(() => new Date().toISOString());
  await page.getByRole('button', { name: 'Retry', exact: true }).click(); await expect(card(page, 'Reading Room')).toContainText('9 seats');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('zero counts, full quiet rooms, unknown capacity and seat sort are distinct', async ({ page }, info) => {
  const [base] = rooms();
  await mockRooms(page, [
    { ...base, name: 'Zero Room', room_id: 'zero', latest_reading: { ...base.latest_reading, people_count: 0, noise_level: 0 } },
    { ...base, name: 'Unknown Room', room_id: 'unknown', total_capacity: null },
    { ...base, name: 'Full Room', room_id: 'full', latest_reading: { ...base.latest_reading, people_count: 15, noise_level: 42, noise_unit: 'dBA' } },
  ]); await page.goto('/');
  await expect(card(page, 'Zero Room')).toContainText('12 seats');
  await expect(card(page, 'Zero Room')).toContainText('No people detected');
  await expect(card(page, 'Unknown Room')).toContainText('3 people');
  await expect(card(page, 'Full Room')).toContainText('0 estimated seats available');
  await expect(card(page, 'Full Room')).toContainText('Quiet'); await expect(card(page, 'Full Room')).toContainText('42 dBA');
  await setFilters(page, info, { sort: 'seats' });
  await expect(page.getByRole('article').first()).toContainText('Zero Room');
  await expect(page.getByRole('article').nth(1)).toContainText('Full Room');
});

test('polling changes values without reordering cards', async ({ page }, info) => {
  await page.clock.install(); const data = rooms(); await mockRooms(page, data); await page.goto('/');
  await setFilters(page, info, { sort: 'seats' });
  await expect(page.getByRole('article').first()).toContainText('Reading Room');
  data[0].latest_reading.people_count = 12; data[1].latest_reading.people_count = 0;
  await page.clock.fastForward(11000);
  await expect(card(page, 'Group Studio')).toContainText('10 seats');
  await expect(page.getByRole('article').first()).toContainText('Reading Room');
});

test('directory and detail screens pass automated accessibility', async ({ page }) => {
  await mockRooms(page); await page.goto('/'); await expect(card(page, 'Reading Room')).toBeVisible();
  const check = async () => expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  await check(); await card(page, 'Reading Room').getByRole('button', { name: 'View Reading Room', exact: true }).click(); await check();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'How it works', exact: true }).click(); await check();
});

test('mobile dimensions, larger text, filter sheet and old demo links remain usable', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  await mockRooms(page);
  for (const width of [320,375,430]) {
    await page.setViewportSize({ width, height: 844 }); await page.goto('/?demo=true#demo');
    await expect(page).not.toHaveURL(/demo/); await expect(page.getByRole('button', { name: /sample/i })).toHaveCount(0);
    await expect(page.getByRole('article').first()).toBeInViewport(); await noOverflow(page);
    await page.getByRole('button', { name: /Filters and sort/ }).click();
    const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
    await dialog.getByRole('combobox', { name: 'Building', exact: true }).selectOption('Allard Hall');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /Filters and sort/ })).toBeFocused();
    await expect(page.getByRole('article')).toHaveCount(71);
    await page.evaluate(() => document.documentElement.style.fontSize = '125%'); await noOverflow(page);
    await page.getByRole('button', { name: /Filters and sort/ }).click();
    await dialog.getByRole('button', { name: 'Reset', exact: true }).click(); await dialog.getByRole('button', { name: 'Apply filters' }).click();
    await card(page, 'Reading Room').getByRole('button', { name: 'View Reading Room', exact: true }).click(); await noOverflow(page);
    await expect(page.getByRole('dialog').getByRole('link', { name: /Directions/ })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`mobile-${width}.png`) });
  }
});

test('desktop explanation and explicit sample preview remain available', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop'); await mockRooms(page); await page.goto('/');
  await expect(page.getByRole('link', { name: 'Explore study spaces' })).toHaveAttribute('href', '#spaces');
  await page.getByRole('button', { name: 'Try sample preview' }).click();
  await expect(page.getByRole('article')).toHaveCount(6); await expect(page.getByText('These rooms and readings are fictional examples.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /Back to monitored rooms/ }).click(); await expect(page.getByRole('article')).toHaveCount(71);
});
