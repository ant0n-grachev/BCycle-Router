import {Station} from "../types";

const GBFS_INFO = "https://gbfs.bcycle.com/bcycle_madison/station_information.json";
const GBFS_STATUS = "https://gbfs.bcycle.com/bcycle_madison/station_status.json";

export async function loadStations(): Promise<Station[]> {
    const [infoRes, statusRes] = await Promise.all([
        fetch(GBFS_INFO).then((r) => r.json()),
        fetch(GBFS_STATUS).then((r) => r.json()),
    ]);

    const infoMap: Record<string, any> = {};
    for (const s of infoRes?.data?.stations ?? []) infoMap[s.station_id] = s;

    const stations: Station[] = [];
    for (const st of statusRes?.data?.stations ?? []) {
        const base = infoMap[st.station_id] || {};
        if (base.lat == null || base.lon == null) continue;
        stations.push({
            station_id: st.station_id,
            name: base.name,
            lat: base.lat,
            lon: base.lon,
            is_installed: st.is_installed === 1,
            is_renting: st.is_renting === 1,
            is_returning: st.is_returning === 1,
            num_bikes_available: st.num_bikes_available ?? 0,
            num_docks_available: st.num_docks_available ?? 0,
        });
    }
    return stations;
}
