import { availableSeats, hasRecentReading } from './rooms.js';

const sameRoom = (a, b) => a.room_id === b.room_id || Boolean(a.source_url && b.source_url && a.source_url.replace(/\/$/, '') === b.source_url.replace(/\/$/, ''));

// Keep catalog metadata when the API only supplies a partial location.
export function mergeDirectory(catalog, apiRooms) {
  const remaining = [...apiRooms];
  const rooms = catalog.map((listing) => {
    const index = remaining.findIndex((room) => sameRoom(listing, room));
    const api = index < 0 ? {} : remaining.splice(index, 1)[0];
    const location = Object.fromEntries(Object.entries(api.location ?? {}).filter(([, value]) => value != null && value !== ''));
    return { ...listing, ...api, catalog_id: listing.room_id, total_capacity: api.total_capacity ?? listing.total_capacity, source_url: api.source_url ?? listing.source_url, location: { building: listing.building, room_number: listing.room_number, address: listing.address, latitude: listing.latitude, longitude: listing.longitude, ...location }, latest_reading: api.latest_reading ?? null };
  });
  return [...rooms, ...remaining];
}

export function directionsUrl(room) {
  const location = room.location ?? {};
  const destination = Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    ? `${location.latitude},${location.longitude}` : location.address?.trim();
  return destination ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}` : null;
}

export function compareRooms(a, b, sort, now, staleAfter) {
  const name = a.name.localeCompare(b.name);
  if (sort === 'seats') return (availableSeats(b, now, staleAfter) ?? -1) - (availableSeats(a, now, staleAfter) ?? -1) || name;
  if (sort === 'fresh') return Number(hasRecentReading(b, now, staleAfter)) - Number(hasRecentReading(a, now, staleAfter)) || name;
  return name;
}
