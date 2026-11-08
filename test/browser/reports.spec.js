import { test, expect } from '@playwright/test';

test('optional fullness and noise report refreshes estimates and retains raw sensor history', async ({ page }) => {
  let submitted;
  const room = { room_id: 'reporting-room', name: 'Reporting Room', total_capacity: 20, stale: false,
    location: { building: 'Test Building' }, latest_reading: { device_id: 'pi', measured_at: new Date().toISOString(), people_count: 5, noise_level: 0.2, noise_unit: 'relative' } };
  await page.route('**/api/rooms*', route => route.fulfill({ json: { rooms: [{ ...room, ...(submitted ? { estimate: {
    occupancy: { people_count: 6, fraction: 0.3, source: 'sensor + community', report_count: 1, measured_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60000).toISOString() },
    reports: { recent: 1 },
  } } : {}) }], stale_after_seconds: 60 } }));
  await page.route('**/api/readings?*', route => route.fulfill({ json: { readings: [] } }));
  await page.route('**/api/reports', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { saved: true, message: 'Thanks! Your observation was received.' } });
  });
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search by building or room' }).fill('Reporting Room');
  await page.getByRole('button', { name: 'View Reporting Room', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reporting Room' });
  await expect(dialog.getByRole('button', { name: 'Share observation', exact: true })).toBeDisabled();
  await dialog.getByRole('group', { name: 'Approximate fullness (%)', exact: true }).getByRole('button', { name: '50%', exact: true }).click();
  await dialog.getByRole('group', { name: 'Noise level', exact: true }).getByRole('button', { name: 'Moderate', exact: true }).click();
  await dialog.getByRole('button', { name: 'Share observation', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Thanks! Your observation was received.');
  expect(submitted).toEqual({ room_id: 'reporting-room', occupancy_percent: 50, noise_band: 'moderate' });
  await expect(dialog.getByText('Occupancy: sensor + community · 1 contributing report', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Observation received' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('headcount zero is submitted and rate-limit errors preserve the observation', async ({ page }) => {
  let submitted;
  await page.route('**/api/rooms*', route => route.fulfill({ json: { rooms: [{ room_id: 'reporting', name: 'Reporting Room', total_capacity: null, latest_reading: null, location: {} }], stale_after_seconds: 60 } }));
  await page.route('**/api/readings?*', route => route.fulfill({ json: { readings: [] } }));
  await page.route('**/api/reports', route => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 429, json: { error: 'Please wait before reporting again.' } });
  });
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search by building or room' }).fill('Reporting Room');
  await page.getByRole('button', { name: 'View Reporting Room', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reporting Room' });
  await dialog.getByRole('group', { name: 'Occupancy format', exact: true }).getByRole('button', { name: 'Number of people', exact: true }).click();
  await dialog.getByLabel('People counted', { exact: true }).fill('0');
  await dialog.getByRole('button', { name: 'Share observation', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Please wait before reporting again.');
  await expect(dialog.getByLabel('People counted', { exact: true })).toHaveValue('0');
  expect(submitted).toEqual({ room_id: 'reporting', people_count: 0 });
});

test('a noise-only observation ranks as current without reviving stale occupancy', async ({ page }) => {
  const now = Date.now();
  const room = { room_id: 'noise-report', name: 'Zebra Reading Room', total_capacity: 20,
    stale: true, location: {}, latest_reading: { device_id: 'pi', measured_at: new Date(now - 3600000).toISOString(), people_count: 5, noise_level: 0.8, noise_unit: 'relative' },
    estimate: { noise: { noise_band: 'quiet', source: 'community', report_count: 1, measured_at: new Date(now).toISOString(), expires_at: new Date(now + 60000).toISOString() }, reports: { recent: 1 } } };
  await page.route('**/api/rooms*', route => route.fulfill({ json: { rooms: [room], stale_after_seconds: 60 } }));
  await page.route('**/api/readings?*', route => route.fulfill({ json: { readings: [] } }));
  await page.goto('/');
  const card = page.getByRole('article').first();
  await expect(card).toContainText('Zebra Reading Room');
  await expect(card).toContainText('Community noise estimate');
  await expect(card).toContainText('Quiet');
  await expect(card).toContainText('Seats unknown');
  await expect(page.getByText('1 of 69 spaces have recent readings')).toBeVisible();
  await page.getByRole('button', { name: 'View Zebra Reading Room', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Community noise estimate');
  await expect(dialog.getByText('Noise: community · 1 contributing report', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Estimated available seats').locator('..')).toContainText('—');
});


test('static demo and confidence stay labelled while expired reports reveal no live seats', async ({ page }) => {
  await page.clock.install();
  const now = Date.now();
  const demo = { room_id: 'static', name: 'Static Demo Room', total_capacity: 10, stale: true, location: {}, latest_reading: { device_id: 'demo-static', people_count: 3, noise_level: 0.2, noise_unit: 'relative', average_confidence: 0.8, measured_at: new Date(now - 3600000).toISOString() } };
  const reported = { room_id: 'percent', name: 'Unknown Capacity Room', total_capacity: null, latest_reading: null, location: {}, estimate: { occupancy: { fraction: 0.5, source: 'community', report_count: 1, measured_at: new Date(now).toISOString(), expires_at: new Date(now + 10000).toISOString() }, reports: { recent: 1 } } };
  await page.route('**/api/rooms*', route => route.fulfill({ json: { rooms: [demo, reported], stale_after_seconds: 60 } }));
  await page.route('**/api/readings?*', route => route.fulfill({ json: { readings: [demo.latest_reading] } }));
  await page.goto('/');
  const card = page.getByRole('article').filter({ hasText: 'Unknown Capacity Room' });
  await expect(card).toContainText('~50% full');
  await expect(card).toContainText('Capacity unknown');
  await expect(page.getByLabel('Live coverage')).toContainText('1 of 70');
  await page.clock.fastForward(11000);
  await expect(card).toContainText('Seats unknown');
  const staticCard = page.getByRole('article').filter({ hasText: 'Static Demo Room' });
  await expect(staticCard).toContainText('7 seats');
  await expect(staticCard).toContainText('Static demo data');
  await expect(page.getByLabel('Live coverage')).toContainText('0 of 70');
  await staticCard.getByRole('button', { name: 'View Static Demo Room', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Detection confidence: 80%');
  await expect(page.getByRole('dialog')).toContainText('not count accuracy');
});

test('sample saves stay separate from live favourites', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.route('**/api/rooms*', route => route.fulfill({ json: { rooms: [], stale_after_seconds: 60 } }));
  await page.addInitScript(() => localStorage.setItem('room.saved', JSON.stringify(['ubc-alrd-1st-floor'])));
  await page.goto('/');
  await page.getByRole('button', { name: 'Try sample preview', exact: true }).click();
  await page.getByRole('article').first().getByRole('button', { name: /^Save / }).click();
  const saved = await page.evaluate(() => ({ live: JSON.parse(localStorage.getItem('room.saved')), demo: JSON.parse(localStorage.getItem('room.saved.demo')) }));
  expect(saved.live).toEqual(['ubc-alrd-1st-floor']);
  expect(saved.demo).toHaveLength(1);
  expect(saved.demo[0]).toMatch(/^sample-/);
  await page.getByRole('button', { name: /Back to monitored rooms/ }).click();
  await expect(page.getByRole('button', { name: 'Share observation', exact: true })).toHaveCount(0);
});
