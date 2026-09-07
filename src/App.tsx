import { useMemo, useState } from 'react';
import ServiceStatus from './components/ServiceStatus';
import StationMap from './components/StationMap';
import TripPlanner from './features/trip-planner/TripPlanner';
import { useTripPlanner } from './features/trip-planner/useTripPlanner';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useServiceAreaData } from './hooks/useServiceAreaData';
import { useStandaloneMode } from './hooks/useStandaloneMode';
import { computeStationCoverageHull } from './lib/coverage';

export default function App() {
  const [mapExpanded, setMapExpanded] = useState(false);
  const online = useOnlineStatus();
  const standalone = useStandaloneMode();
  const { data, availability, error, refresh, refreshing } = useServiceAreaData();
  const stations = useMemo(() => data?.stations ?? [], [data]);
  const planner = useTripPlanner(stations);
  const coverage = useMemo(() => computeStationCoverageHull(stations), [stations]);

  return (
    <div className="app-shell">
      <main className="app-card">
        <header className="app-header">
          <div>
            <p className="eyebrow">Live Madison bikeshare helper</p>
            <div className="app-title-row">
              <h1 className="app-title">
                <span aria-hidden="true">🚲</span> Madison&apos;s BRouter
              </h1>
              <a
                className="app-byline"
                href="https://anton.grachev.us"
                target="_blank"
                rel="noopener noreferrer"
              >
                by Anton
              </a>
            </div>
            <p className="app-subtitle">
              Find nearby BCycle pickup and drop-off options, then open each trip leg in Google
              Maps.
            </p>
          </div>
        </header>

        {!online ? (
          <div className="offline-banner" role="status" aria-live="polite">
            You are offline. The app shell is available, but live station planning and address
            search require a connection.
          </div>
        ) : null}

        <ServiceStatus
          snapshot={data?.snapshot ?? null}
          availability={availability}
          error={error}
          refreshing={refreshing}
          mapAvailable={stations.length > 0}
          mapExpanded={mapExpanded}
          onRefresh={refresh}
          onToggleMap={() => setMapExpanded((expanded) => !expanded)}
        />

        {mapExpanded && data ? (
          <StationMap
            stations={stations}
            coverage={coverage}
            origin={planner.origin}
            destination={planner.destination}
            selectedPickupId={planner.selectedPickup?.station.station_id ?? null}
            selectedDropoffId={planner.selectedDropoff?.station.station_id ?? null}
            pickupCandidateIds={planner.pickupCandidates.map(
              (candidate) => candidate.station.station_id,
            )}
            dropoffCandidateIds={planner.dropoffCandidates.map(
              (candidate) => candidate.station.station_id,
            )}
            onSelectPickup={planner.selectPickup}
            onSelectDropoff={planner.selectDropoff}
          />
        ) : null}

        <TripPlanner controller={planner} stationDataAvailable={data !== null} />

        <footer className="app-footer">
          <p>
            Independent community tool using public data. Not affiliated with, endorsed by, or
            operated by Madison BCycle.
          </p>
          {!standalone ? (
            <details className="app-install">
              <summary>How to install this app</summary>
              <div className="app-install__instructions">
                <p>
                  <strong>iPhone/iPad:</strong> Open in Safari, tap Share, choose Add to Home
                  Screen, keep Open as Web App on, then tap Add.
                </p>
                <p>
                  <strong>Android:</strong> Open in Chrome, tap the three-dot menu, choose Install
                  app or Add to Home screen, then follow the prompts.
                </p>
              </div>
            </details>
          ) : null}
        </footer>
      </main>
    </div>
  );
}
