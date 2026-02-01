import {Station} from "../types";

const GBFS_INFO = "https://gbfs.bcycle.com/bcycle_madison/station_information.json";
const GBFS_STATUS = "https://gbfs.bcycle.com/bcycle_madison/station_status.json";
const CACHE_TTL_MS = 15_000;
const CLOSED_RATIO_THRESHOLD = 0.9;

type CacheEntry = {
    stations: Station[] | null;
    timestamp: number;
    pending: Promise<Station[]> | null;
};

const strictCache: CacheEntry = {stations: null, timestamp: 0, pending: null};
const relaxedCache: CacheEntry = {stations: null, timestamp: 0, pending: null};

let showcaseMode = false;

export class SeasonClosedError extends Error {
    constructor() {
        super("Madison BCycle is closed for the season.");
        this.name = "SeasonClosedError";
    }
}

export function setShowcaseMode(enabled: boolean) {
    showcaseMode = enabled;
    strictCache.stations = null;
    strictCache.timestamp = 0;
    strictCache.pending = null;
    relaxedCache.stations = null;
    relaxedCache.timestamp = 0;
    relaxedCache.pending = null;
}

async function fetchJson(url: string, label: string) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to load ${label} (${res.status})`);
    }
    return res.json();
}

async function fetchStations({allowClosed = false}: {allowClosed?: boolean} = {}): Promise<Station[]> {
    const [infoRes, statusRes] = await Promise.all([
        fetchJson(GBFS_INFO, "station information"),
        fetchJson(GBFS_STATUS, "station status"),
    ]);

    const infoStations = infoRes?.data?.stations;
    const statusStations = statusRes?.data?.stations;

    if (!Array.isArray(infoStations) || !Array.isArray(statusStations)) {
        throw new SeasonClosedError();
    }

    const infoMap: Record<string, any> = {};
    for (const s of infoStations) infoMap[s.station_id] = s;

    const stations: Station[] = [];
    for (const st of statusStations) {
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

    if (showcaseMode) {
        return stations.map((station) => ({
            ...station,
            is_renting: true,
            is_returning: true,
            num_bikes_available: Math.max(station.num_bikes_available, 12),
            num_docks_available: Math.max(station.num_docks_available, 12),
        }));
    }

    const closedStations = stations.filter((station) => !station.is_renting && !station.is_returning).length;
    const closedRatio = stations.length === 0 ? 1 : closedStations / stations.length;

    const totalBikesAvailable = stations.reduce(
        (sum, station) => sum + station.num_bikes_available,
        0
    );

    if (!allowClosed && (closedRatio >= CLOSED_RATIO_THRESHOLD || totalBikesAvailable === 0)) {
        throw new SeasonClosedError();
    }
    return stations;
}

export interface LoadStationsOptions {
    forceRefresh?: boolean;
    allowClosed?: boolean;
}

function getCache(allowClosed: boolean) {
    return allowClosed ? relaxedCache : strictCache;
}

export function loadStations({forceRefresh = false, allowClosed = false}: LoadStationsOptions = {}): Promise<Station[]> {
    const now = Date.now();
    const cache = getCache(allowClosed);

    if (!forceRefresh && cache.stations && now - cache.timestamp < CACHE_TTL_MS) {
        return Promise.resolve(cache.stations);
    }

    if (!forceRefresh && cache.pending) {
        return cache.pending;
    }

    const request = fetchStations({allowClosed})
        .then((stations) => {
            cache.stations = stations;
            cache.timestamp = Date.now();
            return stations;
        })
        .finally(() => {
            if (cache.pending === request) {
                cache.pending = null;
            }
        });

    cache.pending = request;

    return request;
}
