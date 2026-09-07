import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSystemAvailability, loadStationSnapshot } from '../lib/gbfs';
import type { Station, StationSnapshot } from '../types';

export interface ServiceAreaData {
  stations: Station[];
  snapshot: StationSnapshot;
}

const LOAD_ERROR_MESSAGE = 'Unable to load station data right now. Please try again.';

export function useServiceAreaData() {
  const [data, setData] = useState<ServiceAreaData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(true);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
    setRefreshToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchData(forceRefresh: boolean) {
      try {
        const snapshot = await loadStationSnapshot({ forceRefresh });
        if (cancelled) return;
        setData({
          stations: snapshot.stations,
          snapshot,
        });
        setError(null);
      } catch (failure) {
        console.error('Station data refresh failed.', failure);
        if (!cancelled) setError(LOAD_ERROR_MESSAGE);
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    }

    void fetchData(refreshToken > 0);
    const interval = window.setInterval(() => {
      void fetchData(false);
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [refreshToken]);

  const availability = useMemo(() => getSystemAvailability(data?.snapshot ?? null), [data]);

  return { data, availability, error, refresh, refreshing };
}
