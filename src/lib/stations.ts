import type {LatLon, Station} from "../types";
import {haversineKm} from "./distance";

interface NearestOptions {
    requireRenting?: boolean;
    requireReturning?: boolean;
}

export function pickNearestStation(
    stations: Station[],
    origin: LatLon,
    predicate: (station: Station) => boolean,
    options: NearestOptions = {}
): Station | null {
    const {requireRenting = true, requireReturning = true} = options;
    let nearestStation: Station | null = null;
    let nearestDistanceKm = Number.POSITIVE_INFINITY;

    for (const station of stations) {
        if (!station.is_installed) continue;
        if (requireRenting && !station.is_renting) continue;
        if (requireReturning && !station.is_returning) continue;
        if (!predicate(station)) continue;
        if (!Number.isFinite(station.lat) || !Number.isFinite(station.lon)) continue;

        const distanceKm = haversineKm(origin, {lat: station.lat, lon: station.lon});
        if (distanceKm < nearestDistanceKm) {
            nearestDistanceKm = distanceKm;
            nearestStation = station;
        }
    }

    return nearestStation;
}

export function pickNearestPickupStation(stations: Station[], origin: LatLon): Station | null {
    return pickNearestStation(
        stations,
        origin,
        (station) => station.num_bikes_available > 0,
        {requireReturning: false}
    );
}

export function pickNearestRentalStation(stations: Station[], origin: LatLon): Station | null {
    return pickNearestStation(
        stations,
        origin,
        () => true,
        {requireReturning: false}
    );
}
