import type {Station} from "../types";

export interface Bounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

const milesToLatDeg = (miles: number) => miles / 69.0;
const milesToLonDeg = (miles: number, atLatDeg: number) =>
    miles / (69.0 * Math.cos((Math.PI / 180) * atLatDeg));

export function computeBounds(stations: Station[]): Bounds | null {
    const usable = stations.filter(
        (s) => s.is_installed && s.is_returning && Number.isFinite(s.lat) && Number.isFinite(s.lon)
    );
    if (usable.length === 0) return null;

    let north = -90, south = 90, east = -180, west = 180;
    for (const s of usable) {
        if (s.lat > north) north = s.lat;
        if (s.lat < south) south = s.lat;
        if (s.lon > east) east = s.lon;
        if (s.lon < west) west = s.lon;
    }
    return {north, south, east, west};
}

export function expandBounds(b: Bounds, paddingMiles = 1): Bounds {
    const midLat = (b.north + b.south) / 2;
    const dLat = milesToLatDeg(paddingMiles);
    const dLon = milesToLonDeg(paddingMiles, midLat);
    return {
        north: b.north + dLat,
        south: b.south - dLat,
        east: b.east + dLon,
        west: b.west - dLon,
    };
}

export function contains(b: Bounds, lat: number, lon: number): boolean {
    return lat <= b.north && lat >= b.south && lon <= b.east && lon >= b.west;
}
