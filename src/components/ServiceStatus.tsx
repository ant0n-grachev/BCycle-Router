import type { StationSnapshot, SystemAvailability } from '../types';

interface ServiceStatusProps {
  snapshot: StationSnapshot | null;
  availability: SystemAvailability;
  error: string | null;
  refreshing: boolean;
  mapAvailable: boolean;
  mapExpanded: boolean;
  onRefresh: () => void;
  onToggleMap: () => void;
}

function availabilityMessage(availability: SystemAvailability): string {
  switch (availability) {
    case 'operational':
      return '';
    case 'no-bikes':
      return 'No rentable bikes are currently reported.';
    case 'no-docks':
      return 'No return docks are currently reported.';
    case 'service-disabled':
      return 'Station feeds currently report rental and return service disabled.';
    case 'stale':
      return 'Station data may be out of date.';
    case 'unavailable':
      return 'Live station data is unavailable.';
  }
}

function timestamp(snapshot: StationSnapshot): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(snapshot.fetchedAt);
}

export default function ServiceStatus({
  snapshot,
  availability,
  error,
  refreshing,
  mapAvailable,
  mapExpanded,
  onRefresh,
  onToggleMap,
}: ServiceStatusProps) {
  return (
    <section className="service-status" aria-labelledby="service-status-title">
      <div className="service-status__header">
        <div>
          <h2 id="service-status-title">Service Area Map</h2>
        </div>
        <div className="service-status__actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh station data"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            className="button button--secondary"
            type="button"
            onClick={onToggleMap}
            disabled={!mapAvailable}
            aria-label={mapExpanded ? 'Hide station map' : 'Show station map'}
            aria-expanded={mapExpanded}
          >
            {mapExpanded ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {refreshing || availability !== 'operational' ? (
        <div
          className={`service-status__summary service-status__summary--${availability}`}
          role="status"
          aria-live="polite"
        >
          <span>{refreshing ? 'Refreshing station data… ' : ''}</span>
          <span>{availabilityMessage(availability)}</span>
        </div>
      ) : null}

      {snapshot ? (
        <p className="service-status__timestamp">
          Last successful refresh:{' '}
          <time dateTime={new Date(snapshot.fetchedAt).toISOString()}>{timestamp(snapshot)}</time>
          {snapshot.isStale ? ' · Marked stale by feed freshness metadata.' : ''}
        </p>
      ) : null}

      {error && snapshot ? (
        <p className="service-status__warning">
          Refresh failed. Showing the last successful station snapshot.
        </p>
      ) : null}
      {error && !snapshot ? <p className="field-error">{error}</p> : null}
    </section>
  );
}
