import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { Station } from '../../types';
import TripPlanner from './TripPlanner';
import { useTripPlanner } from './useTripPlanner';

const stations: Station[] = [
  {
    station_id: 'pickup',
    name: 'Capitol Square',
    lat: 43.0735,
    lon: -89.401,
    is_installed: true,
    is_renting: true,
    is_returning: false,
    num_bikes_available: 4,
    num_docks_available: 0,
  },
  {
    station_id: 'dropoff',
    name: 'Library Mall',
    lat: 43.0755,
    lon: -89.398,
    is_installed: true,
    is_renting: false,
    is_returning: true,
    num_bikes_available: 0,
    num_docks_available: 5,
  },
];

const stationsWithAlternativePickup: Station[] = [
  ...stations,
  {
    station_id: 'pickup-alternative',
    name: 'West Washington & Bedford',
    lat: 43.074,
    lon: -89.3997,
    is_installed: true,
    is_renting: true,
    is_returning: false,
    num_bikes_available: 2,
    num_docks_available: 0,
  },
];

function Harness() {
  const controller = useTripPlanner(stations);
  return <TripPlanner controller={controller} stationDataAvailable />;
}

function EmptyHarness() {
  const controller = useTripPlanner([]);
  return <TripPlanner controller={controller} stationDataAvailable={false} />;
}

function AlternativePickupHarness() {
  const controller = useTripPlanner(stationsWithAlternativePickup);
  return <TripPlanner controller={controller} stationDataAvailable />;
}

function RefreshingHarness({ currentStations }: { currentStations: Station[] }) {
  const controller = useTripPlanner(currentStations);
  return <TripPlanner controller={controller} stationDataAvailable />;
}

describe('TripPlanner', () => {
  it('resolves coordinate searches and renders candidate choices and three route legs', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(
      screen.getByRole('combobox', { name: 'Starting location' }),
      '43.07310, -89.40120{Enter}',
    );
    await user.type(
      screen.getByRole('combobox', { name: 'Destination' }),
      '43.07520, -89.39820{Enter}',
    );

    expect(await screen.findByRole('group', { name: 'Pickup station' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Drop-off station' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Your three-leg itinerary' })).toBeVisible();
    expect(screen.getAllByRole('link', { name: /in Google Maps/ })).toHaveLength(3);
    expect(screen.queryByRole('link', { name: 'Walk to Capitol Square' })).not.toBeInTheDocument();
  });

  it('automatically resolves a manual origin on field exit without a search button', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(
      screen.queryByRole('button', { name: /Search (starting location|destination)/ }),
    ).not.toBeInTheDocument();
    const origin = screen.getByRole('combobox', { name: 'Starting location' });
    await user.type(origin, '43.07310, -89.40120');
    await user.click(screen.getByRole('combobox', { name: 'Destination' }));

    expect(await screen.findByRole('group', { name: 'Pickup station' })).toBeVisible();
  });

  it('offers walking directions to the selected pickup before a destination is resolved', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(
      screen.getByRole('combobox', { name: 'Starting location' }),
      '43.07310, -89.40120{Enter}',
    );

    const walkLink = await screen.findByRole('link', { name: 'Walk to Capitol Square' });
    expect(screen.getByRole('region', { name: 'Walk to your pickup' })).toContainElement(walkLink);
    const directions = new URL(walkLink.getAttribute('href') ?? '');
    expect(directions.origin + directions.pathname).toBe('https://www.google.com/maps/dir/');
    expect(directions.searchParams.get('origin')).toBe('43.0731,-89.4012');
    expect(directions.searchParams.get('destination')).toBe('43.0735,-89.401');
    expect(directions.searchParams.get('travelmode')).toBe('walking');
    expect(
      screen.queryByRole('heading', { name: 'Your three-leg itinerary' }),
    ).not.toBeInTheDocument();
  });

  it('updates the walking shortcut when another pickup station is selected', async () => {
    const user = userEvent.setup();
    render(<AlternativePickupHarness />);

    await user.type(
      screen.getByRole('combobox', { name: 'Starting location' }),
      '43.07310, -89.40120{Enter}',
    );
    await user.click(await screen.findByRole('radio', { name: /West Washington & Bedford/ }));

    const walkLink = screen.getByRole('link', { name: 'Walk to West Washington & Bedford' });
    const directions = new URL(walkLink.getAttribute('href') ?? '');
    expect(directions.searchParams.get('destination')).toBe('43.074,-89.3997');
    expect(directions.searchParams.get('travelmode')).toBe('walking');
  });

  it('keeps manual entry available after a device-location error and provides retry', async () => {
    const user = userEvent.setup();
    const originalGeolocation = navigator.geolocation;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    });

    render(<Harness />);
    await user.click(screen.getByRole('radio', { name: 'Use my device location' }));

    expect(await screen.findByText('Location is not supported by this browser.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry device location' })).toBeVisible();
    await user.click(screen.getByRole('radio', { name: 'Enter a starting location' }));
    expect(screen.getByRole('combobox', { name: 'Starting location' })).toBeVisible();

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    });
  });

  it('switches to manual origin entry when device location is outside station coverage', async () => {
    const user = userEvent.setup();
    const originalGeolocation = navigator.geolocation;
    const position: GeolocationPosition = {
      coords: {
        accuracy: 5,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        latitude: 44,
        longitude: -89,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    };
    const getCurrentPosition = vi.fn((success: PositionCallback) => success(position));
    const geolocation: Geolocation = {
      getCurrentPosition,
      watchPosition: () => 1,
      clearWatch: () => undefined,
    };
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: geolocation,
    });

    render(<Harness />);
    await user.click(screen.getByRole('radio', { name: 'Use my device location' }));

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Enter a starting location' })).toBeChecked(),
    );
    expect(screen.getByRole('combobox', { name: 'Starting location' })).toBeVisible();
    expect(
      screen.getByText(
        'Your device location is outside the current BCycle service area. Enter a starting location instead.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Retry device location' })).not.toBeInTheDocument();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    });
  });

  it('switches to manual origin entry when the service area is not available yet', async () => {
    const user = userEvent.setup();
    const originalGeolocation = navigator.geolocation;
    const position: GeolocationPosition = {
      coords: {
        accuracy: 5,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        latitude: 43.0731,
        longitude: -89.4012,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    };
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => success(position),
        watchPosition: () => 1,
        clearWatch: () => undefined,
      } satisfies Geolocation,
    });

    render(<EmptyHarness />);
    await user.click(screen.getByRole('radio', { name: 'Use my device location' }));

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Enter a starting location' })).toBeChecked(),
    );
    expect(
      screen.getByText(
        'Live station data is not available to validate your device location. Enter a starting location instead.',
      ),
    ).toBeVisible();

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    });
  });

  it('switches to manual origin when refreshed station coverage excludes the device location', async () => {
    const user = userEvent.setup();
    const originalGeolocation = navigator.geolocation;
    const position: GeolocationPosition = {
      coords: {
        accuracy: 5,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        latitude: 43.0731,
        longitude: -89.4012,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    };
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => success(position),
        watchPosition: () => 1,
        clearWatch: () => undefined,
      } satisfies Geolocation,
    });
    const { rerender } = render(<RefreshingHarness currentStations={stations} />);

    await user.click(screen.getByRole('radio', { name: 'Use my device location' }));
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Use my device location' })).toBeChecked(),
    );

    const distantStations = stations.map((currentStation, index) => ({
      ...currentStation,
      lat: 44 + index * 0.001,
      lon: -89,
    }));
    rerender(<RefreshingHarness currentStations={distantStations} />);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Enter a starting location' })).toBeChecked(),
    );
    expect(
      screen.getByText(
        'Your device location is outside the current BCycle service area. Enter a starting location instead.',
      ),
    ).toBeVisible();

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    });
  });
});
