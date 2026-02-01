import {useCallback, useEffect, useState} from "react";
import type {Bounds} from "../lib/bounds";
import {computeBounds, expandBounds} from "../lib/bounds";
import type {Station} from "../types";
import {loadStations, SeasonClosedError} from "../lib/gbfs";

interface ServiceAreaData {
    bounds: Bounds;
    stations: Station[];
}

export function useServiceAreaData() {
    const [data, setData] = useState<ServiceAreaData | null>(null);
    const [seasonClosed, setSeasonClosed] = useState(false);
    const [refreshToken, setRefreshToken] = useState(0);
    const [refreshing, setRefreshing] = useState(true);

    const refresh = useCallback(() => {
        setRefreshing(true);
        setRefreshToken((token) => token + 1);
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function fetchData() {
            try {
                const stations = await loadStations();
                if (cancelled) return;
                setSeasonClosed(false);
                update(stations);
            } catch (err) {
                if (cancelled) return;
                if (err instanceof SeasonClosedError) {
                    setSeasonClosed(true);
                    try {
                        const stations = await loadStations({allowClosed: true});
                        if (cancelled) return;
                        update(stations);
                    } catch (innerErr) {
                        if (!cancelled) {
                            console.error(innerErr);
                            setData(null);
                        }
                    }
                } else {
                    console.error(err);
                }
            }
            if (!cancelled) {
                setRefreshing(false);
            }
        }

        function update(stations: Station[]) {
            const raw = computeBounds(stations);
            if (!raw) {
                setData(null);
                return;
            }
            setData({bounds: expandBounds(raw, 1), stations});
        }

        fetchData();
        const interval = window.setInterval(fetchData, 60_000);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [refreshToken]);

    return {data, seasonClosed, refresh, refreshing};
}
