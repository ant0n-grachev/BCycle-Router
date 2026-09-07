import LocationSearch from '../../components/LocationSearch';
import StationChoice from '../../components/StationChoice';
import TripResults from '../../components/TripResults';
import { buildGMapsWalking } from '../../lib/maps';
import type { useTripPlanner } from './useTripPlanner';

export interface TripPlannerProps {
  controller: ReturnType<typeof useTripPlanner>;
  stationDataAvailable: boolean;
}

export default function TripPlanner({ controller, stationDataAvailable }: TripPlannerProps) {
  const {
    originMode,
    setOriginMode,
    originModeNotice,
    serviceArea,
    setManualOrigin,
    setDestination,
    origin,
    deviceLocation,
    pickupCandidates,
    dropoffCandidates,
    selectedPickup,
    selectedDropoff,
    selectPickup,
    selectDropoff,
    pickupIssue,
    dropoffIssue,
    plan,
  } = controller;
  const pickupWalkUrl =
    origin !== null && selectedPickup !== null
      ? buildGMapsWalking(origin, {
          lat: selectedPickup.station.lat,
          lon: selectedPickup.station.lon,
        })
      : null;

  return (
    <section className="trip-planner" aria-labelledby="trip-planner-title">
      <div className="section-heading">
        <p className="eyebrow">Plan a station-to-station trip</p>
        <h2 id="trip-planner-title">Where are you going?</h2>
        <p>
          Choose a starting location to find a nearby bike. Add a destination for the full three-leg
          trip.
        </p>
      </div>

      <div className="trip-planner__locations">
        <fieldset className="origin-mode">
          <legend>Starting location method</legend>
          <label>
            <input
              type="radio"
              name="origin-mode"
              value="manual"
              checked={originMode === 'manual'}
              onChange={() => setOriginMode('manual')}
            />
            Enter a starting location
          </label>
          <label>
            <input
              type="radio"
              name="origin-mode"
              value="device"
              checked={originMode === 'device'}
              onChange={() => setOriginMode('device')}
            />
            Use my device location
          </label>
        </fieldset>

        <div hidden={originMode !== 'manual'}>
          <LocationSearch
            label="Starting location"
            onSelectionChange={(selection) => setManualOrigin(selection)}
            searchAfterPause
            serviceArea={serviceArea}
          />
        </div>

        {originModeNotice ? (
          <p className="planner-message" role="status">
            {originModeNotice}
          </p>
        ) : null}

        {originMode === 'device' ? (
          <div className="device-location" aria-live="polite" aria-atomic="true">
            {deviceLocation.loading ? (
              <p className="field-status" role="status">
                Requesting your current location…
              </p>
            ) : null}
            {deviceLocation.location ? (
              <p className="field-success" role="status">
                Device location received: {deviceLocation.location.lat.toFixed(5)},{' '}
                {deviceLocation.location.lon.toFixed(5)}.
              </p>
            ) : null}
            {deviceLocation.error ? (
              <div className="device-location__error">
                <p className="field-error" role="alert">
                  {deviceLocation.error.message}
                </p>
              </div>
            ) : null}
            {!deviceLocation.loading &&
            (deviceLocation.location !== null || deviceLocation.error !== null) ? (
              <button
                className="button button--secondary"
                type="button"
                onClick={deviceLocation.retry}
                aria-label="Retry device location"
              >
                Retry location
              </button>
            ) : null}
          </div>
        ) : null}

        <LocationSearch
          label="Destination"
          onSelectionChange={(selection) => setDestination(selection)}
          searchAfterPause
          serviceArea={serviceArea}
        />
      </div>

      {!stationDataAvailable ? (
        <p className="planner-message" role="status">
          Live station data is required before station choices can be calculated. You can still
          enter locations while the feed reconnects.
        </p>
      ) : null}

      {pickupIssue ? (
        <p className="planner-message" role="status">
          {pickupIssue}
        </p>
      ) : null}
      {selectedPickup ? (
        <StationChoice
          kind="pickup"
          candidates={pickupCandidates}
          selectedId={selectedPickup.station.station_id}
          onSelect={selectPickup}
        />
      ) : null}
      {pickupWalkUrl !== null && selectedPickup !== null && plan === null ? (
        <section
          className="pickup-shortcut"
          aria-label="Walk to your pickup"
          aria-live="polite"
          aria-atomic="true"
        >
          <a
            className="button button--primary"
            href={pickupWalkUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Walk to {selectedPickup.station.name}
          </a>
        </section>
      ) : null}

      {dropoffIssue ? (
        <p className="planner-message" role="status">
          {dropoffIssue}
        </p>
      ) : null}
      {selectedDropoff ? (
        <StationChoice
          kind="dropoff"
          candidates={dropoffCandidates}
          selectedId={selectedDropoff.station.station_id}
          onSelect={selectDropoff}
        />
      ) : null}

      {plan ? <TripResults plan={plan} /> : null}
    </section>
  );
}
