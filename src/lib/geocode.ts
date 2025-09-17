import {LatLon} from "../types";

function parseLatLon(text: string): LatLon | null {
    const parts = text.split(",");
    if (parts.length !== 2) return null;
    const lat = Number(parts[0].trim());
    const lon = Number(parts[1].trim());
    if (Number.isFinite(lat) && Number.isFinite(lon)) return {lat, lon};
    return null;
}


export async function geocodeNominatim(q: string): Promise<LatLon & { label: string }> {
    const maybe = parseLatLon(q);
    if (maybe) {
        return {...maybe, label: `${maybe.lat.toFixed(5)},${maybe.lon.toFixed(5)}`};
    }

    const biasedQuery = `${q} Madison`;

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", biasedQuery);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString(), {headers: {Accept: "application/json"}});
    if (!res.ok) throw new Error("Geocoding request failed.");
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("Destination not found.");
    const item = data[0];
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error("Geocoding returned invalid coordinates.");
    }
    return {lat, lon, label: item.display_name as string};
}
