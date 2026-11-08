import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeDirectory, directionsUrl, compareRooms } from '../src/directory.js';
const listing = { room_id: 'ubc-room', name: 'Room', building: 'Library', address: '123 Mall', total_capacity: 10, source_url: 'https://ubc.ca/room' };
test('merge keeps directory available offline and preserves partial metadata without duplicate coverage', () => {
  const api = { room_id: 'sensor-room', name: 'Room', source_url: `${listing.source_url}/`, location: { address: null }, total_capacity: null, latest_reading: { people_count: 0 } };
  const [room] = mergeDirectory([listing], [api]);
  assert.equal(mergeDirectory([listing], []).length, 1);
  assert.equal(mergeDirectory([listing], [api]).length, 1);
  assert.equal(room.room_id, 'sensor-room');
  assert.equal(room.location.address, listing.address);
  assert.equal(room.location.building, listing.building);
  assert.equal(room.total_capacity, 10);
  assert.equal(room.latest_reading.people_count, 0);
});
test('directions require an address or coordinates and accept zero coordinates', () => {
  assert.equal(directionsUrl({ location: {} }), null);
  assert.match(directionsUrl({ location: { address: '123 Mall' } }), /destination=123%20Mall/);
  assert.match(directionsUrl({ location: { latitude: 0, longitude: 0 } }), /destination=0%2C0/);
});
test('fresh ordering and seat ordering distinguish zero, stale and unknown values', () => {
  const now = Date.now();
  const fresh = { ...listing, latest_reading: { people_count: 10, measured_at: new Date(now).toISOString() } };
  const unknown = { ...listing, name: 'A unknown', total_capacity: null, latest_reading: fresh.latest_reading };
  const stale = { ...fresh, name: 'A stale', stale: true };
  assert.ok(compareRooms(fresh, unknown, 'seats', now, 60) < 0);
  assert.ok(compareRooms(fresh, stale, 'fresh', now, 60) < 0);
});
