import {Station} from "../types";

const GBFS_INFO = "https://gbfs.bcycle.com/bcycle_madison/station_information.json";
const GBFS_STATUS = "https://gbfs.bcycle.com/bcycle_madison/station_status.json";
const CACHE_TTL_MS = 15_000;

let cachedStations: Station[] | null = null;
let cacheTimestamp = 0;
let pending: Promise<Station[]> | null = null;

async function fetchJson(url: string, label: string) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to load ${label} (${res.status})`);
    }
    return res.json();
}

async function fetchStations(): Promise<Station[]> {
    const [infoRes, statusRes] = await Promise.all([
        fetchJson(GBFS_INFO, "station information"),
        fetchJson(GBFS_STATUS, "station status"),
    ]);

    const infoMap: Record<string, any> = {};
    for (const s of infoRes?.data?.stations ?? []) infoMap[s.station_id] = s;

    const stations: Station[] = [];
    for (const st of statusRes?.data?.stations ?? []) {
        const base = infoMap[st.station_id] || {};
        const lat = Number(base.lat);
        const lon = Number(base.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        const bikes = Number(st.num_bikes_available);
        const docks = Number(st.num_docks_available);

        stations.push({
            station_id: String(st.station_id),
            name: base.name ?? st.name ?? String(st.station_id),
            lat,
            lon,
            is_installed: Boolean(st.is_installed),
            is_renting: Boolean(st.is_renting),
            is_returning: Boolean(st.is_returning),
            num_bikes_available: Number.isFinite(bikes) ? bikes : 0,
            num_docks_available: Number.isFinite(docks) ? docks : 0,
        });
    }
    return stations;
}

export interface LoadStationsOptions {
    forceRefresh?: boolean;
}

export function loadStations({forceRefresh = false}: LoadStationsOptions = {}): Promise<Station[]> {
    const now = Date.now();
    if (!forceRefresh && cachedStations && now - cacheTimestamp < CACHE_TTL_MS) {
        return Promise.resolve(cachedStations);
    }

    if (!forceRefresh && pending) {
        return pending;
    }

    const request = fetchStations()
        .then((stations) => {
            cachedStations = stations;
            cacheTimestamp = Date.now();
            return stations;
        })
        .finally(() => {
            if (pending === request) {
                pending = null;
            }
        });

    pending = request;

    return request;
}
