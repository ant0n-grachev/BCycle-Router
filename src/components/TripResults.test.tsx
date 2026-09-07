import { render, screen } from '@testing-library/react';
import type { Station } from '../types';
import { createTripPlan } from '../lib/tripPlanner';
import TripResults from './TripResults';

function station(id: string, name: string, lat: number, lon: number): Station {
  return {
    station_id: id,
    name,
    lat,
    lon,
    is_installed: true,
    is_renting: true,
    is_returning: true,
    num_bikes_available: 4,
    num_docks_available: 5,
  };
}

describe('TripResults', () => {
  it('renders three descriptive route legs with the correct travel modes', () => {
    const plan = createTripPlan(
      { lat: 43.0731, lon: -89.4012 },
      { lat: 43.081, lon: -89.39, label: 'Destination address' },
      station('pickup', 'Capitol Square', 43.074, -89.4),
      station('dropoff', 'Library Mall', 43.08, -89.391),
    );

    render(<TripResults plan={plan} />);

    expect(screen.getByRole('heading', { name: 'Your three-leg itinerary' })).toBeVisible();
    expect(screen.getByText('1. Walk to pickup')).toBeVisible();
    expect(screen.getByText('2. Ride to drop-off')).toBeVisible();
    expect(screen.getByText('3. Walk to destination')).toBeVisible();
    expect(screen.getAllByText(/mi straight-line estimate$/)).toHaveLength(3);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAccessibleName(
      'Open walking directions from Starting location to Capitol Square in Google Maps',
    );
    expect(links[1]).toHaveAccessibleName(
      'Open bicycling directions from Capitol Square to Library Mall in Google Maps',
    );
    expect(links[2]).toHaveAccessibleName(
      'Open walking directions from Library Mall to Destination address in Google Maps',
    );
    expect(new URL(links[0].getAttribute('href') ?? '').searchParams.get('travelmode')).toBe(
      'walking',
    );
    expect(new URL(links[1].getAttribute('href') ?? '').searchParams.get('travelmode')).toBe(
      'bicycling',
    );
    expect(new URL(links[2].getAttribute('href') ?? '').searchParams.get('travelmode')).toBe(
      'walking',
    );
  });

  it('omits approximately-zero walking legs and explains the skipped endpoints', () => {
    const plan = createTripPlan(
      { lat: 43.0731, lon: -89.4012 },
      { lat: 43.08, lon: -89.391, label: 'Destination address' },
      station('pickup', 'Capitol Square', 43.0731, -89.4012),
      station('dropoff', 'Library Mall', 43.08, -89.391),
    );

    render(<TripResults plan={plan} />);

    expect(screen.getByRole('heading', { name: 'Your itinerary' })).toBeVisible();
    expect(screen.queryByText('Walk to pickup')).not.toBeInTheDocument();
    expect(screen.queryByText('Walk to destination')).not.toBeInTheDocument();
    expect(screen.getByText('You’re already at the pickup station.')).toBeVisible();
    expect(screen.getByText('Your destination is at the drop-off station.')).toBeVisible();
    expect(screen.getByText('1. Ride to drop-off')).toBeVisible();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(
      screen.getByRole('link', {
        name: 'Open bicycling directions from Capitol Square to Library Mall in Google Maps',
      }),
    ).toBeVisible();
  });

  it('keeps a walking leg at or above the approximately-zero threshold', () => {
    const plan = createTripPlan(
      { lat: 43.0731, lon: -89.4012 },
      { lat: 43.081, lon: -89.39, label: 'Destination address' },
      station('pickup', 'Capitol Square', 43.07318, -89.4012),
      station('dropoff', 'Library Mall', 43.08, -89.391),
    );

    render(<TripResults plan={plan} />);

    expect(plan.legs[0].distanceMi).toBeGreaterThanOrEqual(0.005);
    expect(screen.getByRole('heading', { name: 'Your three-leg itinerary' })).toBeVisible();
    expect(screen.getByText('1. Walk to pickup')).toBeVisible();
    expect(screen.getByText('2. Ride to drop-off')).toBeVisible();
    expect(screen.getByText('3. Walk to destination')).toBeVisible();
    expect(screen.queryByText('You’re already at the pickup station.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('updates station descriptions when a different candidate is selected', () => {
    const origin = { lat: 43.0731, lon: -89.4012 };
    const destination = { lat: 43.081, lon: -89.39, label: 'Destination address' };
    const dropoff = station('dropoff', 'Library Mall', 43.08, -89.391);
    const { rerender } = render(
      <TripResults
        plan={createTripPlan(
          origin,
          destination,
          station('pickup', 'Capitol Square', 43.074, -89.4),
          dropoff,
        )}
      />,
    );

    rerender(
      <TripResults
        plan={createTripPlan(
          origin,
          destination,
          station('alternative', 'State Street', 43.075, -89.399),
          dropoff,
        )}
      />,
    );

    expect(
      screen.getByRole('link', {
        name: 'Open walking directions from Starting location to State Street in Google Maps',
      }),
    ).toBeVisible();
    expect(screen.queryByText('Capitol Square')).not.toBeInTheDocument();
  });
});
