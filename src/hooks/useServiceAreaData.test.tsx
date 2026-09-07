import { act, renderHook, waitFor } from '@testing-library/react';
import type { StationSnapshot, SystemAvailability } from '../types';
import { getSystemAvailability, loadStationSnapshot } from '../lib/gbfs';
import { useServiceAreaData } from './useServiceAreaData';

vi.mock('../lib/gbfs', () => ({
  loadStationSnapshot: vi.fn(),
  getSystemAvailability: vi.fn((snapshot: StationSnapshot | null): SystemAvailability =>
    snapshot?.isStale ? 'stale' : snapshot ? 'operational' : 'unavailable',
  ),
}));

const mockedLoadStationSnapshot = vi.mocked(loadStationSnapshot);
const mockedGetSystemAvailability = vi.mocked(getSystemAvailability);

function snapshot(overrides: Partial<StationSnapshot> = {}): StationSnapshot {
  return {
    stations: [
      {
        station_id: 'a',
        name: 'Station A',
        lat: 43.0731,
        lon: -89.4012,
        is_installed: true,
        is_renting: true,
        is_returning: true,
        num_bikes_available: 3,
        num_docks_available: 4,
      },
    ],
    fetchedAt: 1_700_000_000_000,
    feedUpdatedAt: 1_700_000_000_000,
    ttlSeconds: 60,
    isStale: false,
    ...overrides,
  };
}

describe('useServiceAreaData', () => {
  beforeEach(() => {
    mockedLoadStationSnapshot.mockReset();
    mockedGetSystemAvailability.mockClear();
  });

  it('keeps the last valid snapshot and availability visible when a forced refresh fails', async () => {
    const first = snapshot();
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockedLoadStationSnapshot
      .mockResolvedValueOnce(first)
      .mockRejectedValueOnce(new Error('network unavailable'));

    const { result } = renderHook(() => useServiceAreaData());
    await waitFor(() => expect(result.current.data?.snapshot).toEqual(first));
    expect(result.current.availability).toBe('operational');

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.refreshing).toBe(false));

    expect(result.current.data?.snapshot).toEqual(first);
    expect(result.current.availability).toBe('operational');
    expect(result.current.error).toBe('Unable to load station data right now. Please try again.');
    expect(mockedLoadStationSnapshot).toHaveBeenLastCalledWith({ forceRefresh: true });
    expect(diagnostic).toHaveBeenCalledWith('Station data refresh failed.', expect.any(Error));
  });

  it('surfaces metadata-derived stale availability without treating it as a failed request', async () => {
    mockedLoadStationSnapshot.mockResolvedValueOnce(snapshot({ isStale: true }));

    const { result } = renderHook(() => useServiceAreaData());
    await waitFor(() => expect(result.current.availability).toBe('stale'));

    expect(result.current.error).toBeNull();
    expect(result.current.data?.stations).toHaveLength(1);
  });
});
