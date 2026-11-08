import { expect } from '@playwright/test';
export function rooms() {
  const reading = { device_id: 'fixture', measured_at: new Date().toISOString(), people_count: 3, noise_level: .12, noise_unit: 'relative' };
  return [
    { room_id: 'reading', name: 'Reading Room', total_capacity: 12, location: { building: 'Test Learning Centre', room_number: '201', address: '123 East Mall' }, latest_reading: reading },
    { room_id: 'studio', name: 'Group Studio', total_capacity: 10, location: { building: 'Test Student Hub', room_number: '101' }, latest_reading: { ...reading, people_count: 10, noise_level: .8 } },
    { room_id: 'pending', name: 'Pending Room', total_capacity: null, location: {}, latest_reading: null },
  ];
}
export async function mockRooms(page, data = rooms()) {
  await page.route('**/api/rooms*', route => route.fulfill({ json: { rooms: data, stale_after_seconds: 60 } }));
  await page.route('**/api/readings?*', route => route.fulfill({ json: { readings: [{ people_count: 0, measured_at: new Date(Date.now() - 60000).toISOString() }, { people_count: 3, measured_at: new Date().toISOString() }] } }));
}
export const card = (page, name) => page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
export async function noOverflow(page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
export async function setFilters(page, testInfo, { building, sort }) {
  const mobile = testInfo.project.name === 'mobile';
  if (mobile) await page.getByRole('button', { name: /Filters and sort/ }).click();
  if (building) await page.getByRole('combobox', { name: 'Building', exact: true }).selectOption(building);
  if (sort) await page.getByRole('combobox', { name: 'Sort spaces' }).selectOption(sort);
  if (mobile) await page.getByRole('button', { name: 'Apply filters' }).click();
}
