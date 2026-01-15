import {LatLon} from "../types";
import type {Bounds} from "./bounds";
import {contains} from "./bounds";

function parseLatLon(text: string): LatLon | null {
    const parts = text.split(",");
    if (parts.length !== 2) return null;
    const lat = Number(parts[0].trim());
    const lon = Number(parts[1].trim());
    if (Number.isFinite(lat) && Number.isFinite(lon)) return {lat, lon};
    return null;
}

export interface GeocodeSuggestion extends LatLon {
    label: string;
}


export async function geocodeNominatim(q: string): Promise<GeocodeSuggestion> {
    const maybe = parseLatLon(q);
    if (maybe) {
        return {...maybe, label: `${maybe.lat.toFixed(5)}, ${maybe.lon.toFixed(5)}`};
    }

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
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

interface SuggestOptions {
    limit?: number;
    bounds?: Bounds | null;
}

export async function suggestNominatim(
    q: string,
    {limit = 5, bounds}: SuggestOptions = {}
): Promise<GeocodeSuggestion[]> {
    const trimmed = q.trim();
    if (!trimmed) return [];

    const maybe = parseLatLon(trimmed);
    if (maybe) {
        if (bounds && !contains(bounds, maybe.lat, maybe.lon)) {
            return [];
        }
        return [{...maybe, label: `${maybe.lat.toFixed(5)}, ${maybe.lon.toFixed(5)}`}];
    }

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", trimmed);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(Math.max(1, Math.min(10, Math.floor(limit)))));
    if (bounds) {
        url.searchParams.set(
            "viewbox",
            `${bounds.west},${bounds.north},${bounds.east},${bounds.south}`
        );
        url.searchParams.set("bounded", "1");
    }

    const res = await fetch(url.toString(), {headers: {Accept: "application/json"}});
    if (!res.ok) throw new Error("Geocoding request failed.");
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const suggestions: GeocodeSuggestion[] = [];
    for (const item of data) {
        const lat = Number(item.lat);
        const lon = Number(item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        if (bounds && !contains(bounds, lat, lon)) continue;
        const label = typeof item.display_name === "string"
            ? (item.display_name as string)
            : `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        suggestions.push({lat, lon, label});
    }
    return suggestions;
}
