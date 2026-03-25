import { supabase } from './supabase';

// ─── REVERSE GEOCODE (OpenStreetMap Nominatim - 100% free, no API key) ───
export async function reverseGeocode(lat: number, lon: number): Promise<{
  city: string;
  state: string;
  country: string;
  display: string;
}> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`,
    { headers: { 'User-Agent': 'MalluCupid/1.0' } }
  );
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  const addr = data.address || {};
  const city = addr.city || addr.town || addr.village || addr.county || '';
  const state = addr.state || '';
  const country = addr.country || '';
  const parts = [city, state, country].filter(Boolean);
  return { city, state, country, display: parts.join(', ') };
}

// ─── SEARCH PLACES (Nominatim forward search) ───
export async function searchPlaces(query: string): Promise<Array<{
  display: string;
  city: string;
  state: string;
  country: string;
}>> {
  if (query.length < 2) return [];
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6&accept-language=en`,
    { headers: { 'User-Agent': 'MalluCupid/1.0' } }
  );
  if (!res.ok) return [];
  const results = await res.json();
  return results.map((r: any) => {
    const addr = r.address || {};
    const city = addr.city || addr.town || addr.village || addr.county || '';
    const state = addr.state || '';
    const country = addr.country || '';
    const parts = [city, state, country].filter(Boolean);
    return { display: parts.join(', ') || r.display_name, city, state, country };
  });
}

// ─── GET CURRENT LOCATION via browser Geolocation API ───
export function getCurrentPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// ─── FETCH ALL COUNTRIES (from Supabase) ───
export async function fetchCountries(): Promise<Array<{ id: number; name: string; code: string }>> {
  const { data, error } = await supabase
    .from('countries')
    .select('id, name, code')
    .order('name');
  if (error) throw new Error(error.message);
  return data || [];
}
