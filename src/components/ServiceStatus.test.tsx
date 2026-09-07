import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { StationSnapshot, SystemAvailability } from '../types';
import ServiceStatus from './ServiceStatus';

const snapshot: StationSnapshot = {
  stations: [],
  fetchedAt: Date.UTC(2026, 7, 30, 17, 30),
  feedUpdatedAt: Date.UTC(2026, 7, 30, 17, 29),
  ttlSeconds: 60,
  isStale: false,
};

function renderStatus(
  availability: SystemAvailability,
  overrides: Partial<React.ComponentProps<typeof ServiceStatus>> = {},
) {
  const onRefresh = vi.fn();
  const onToggleMap = vi.fn();
  const user = userEvent.setup();
  render(
    <ServiceStatus
      snapshot={snapshot}
      availability={availability}
      error={null}
      refreshing={false}
      mapAvailable
      mapExpanded={false}
      onRefresh={onRefresh}
      onToggleMap={onToggleMap}
      {...overrides}
    />,
  );
  return { onRefresh, onToggleMap, user };
}

describe('ServiceStatus', () => {
  it('does not render a visible status summary for normal operational availability', () => {
    renderStatus('operational');

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each([
    ['no-bikes', 'No rentable bikes are currently reported.'],
    ['no-docks', 'No return docks are currently reported.'],
    ['service-disabled', 'Station feeds currently report rental and return service disabled.'],
    ['stale', 'Station data may be out of date.'],
    ['unavailable', 'Live station data is unavailable.'],
  ] satisfies readonly (readonly [SystemAvailability, string])[])(
    'renders a visible status summary for %s availability',
    (availability, message) => {
      renderStatus(availability);

      expect(screen.getByRole('status')).toHaveTextContent(message);
    },
  );

  it('does not describe zero bikes as a seasonal closure', () => {
    renderStatus('no-bikes');

    expect(screen.queryByText(/season|closed/i)).not.toBeInTheDocument();
  });

  it('labels retained data after a failed refresh', () => {
    renderStatus('stale', {
      snapshot: { ...snapshot, isStale: true },
      error: 'Unable to refresh station data.',
    });

    expect(
      screen.getByText('Refresh failed. Showing the last successful station snapshot.'),
    ).toBeVisible();
    expect(screen.getByText(/Last successful refresh:/)).toBeVisible();
  });

  it('shows concise map-toggle text while retaining descriptive accessible labels', async () => {
    const user = userEvent.setup();

    function ToggleHarness() {
      const [mapExpanded, setMapExpanded] = useState(false);

      return (
        <ServiceStatus
          snapshot={snapshot}
          availability="operational"
          error={null}
          refreshing={false}
          mapAvailable
          mapExpanded={mapExpanded}
          onRefresh={vi.fn()}
          onToggleMap={() => setMapExpanded((expanded) => !expanded)}
        />
      );
    }

    render(<ToggleHarness />);

    const showButton = screen.getByRole('button', { name: 'Show station map' });
    expect(showButton).toHaveTextContent(/^Show$/);

    await user.click(showButton);

    expect(screen.getByRole('button', { name: 'Hide station map' })).toHaveTextContent(/^Hide$/);
  });

  it('invokes refresh and announces refresh progress', async () => {
    const { onRefresh, user } = renderStatus('operational');

    await user.click(screen.getByRole('button', { name: 'Refresh station data' }));

    expect(onRefresh).toHaveBeenCalledOnce();

    renderStatus('operational', { refreshing: true });
    const statuses = screen.getAllByRole('status');
    expect(statuses[statuses.length - 1]).toHaveTextContent('Refreshing station data');
  });
});
