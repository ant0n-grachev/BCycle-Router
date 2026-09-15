import LocationSearch from '../../components/LocationSearch';
import StationChoice from '../../components/StationChoice';
import TripResults from '../../components/TripResults';
import type { TripPlan } from '../../lib/tripPlanner';
import type { LatLon, Station } from '../../types';
import type { useTripPlanner } from './useTripPlanner';

export interface TripPlannerProps {
  controller: ReturnType<typeof useTripPlanner>;
  onStartNavigation?: (plan: TripPlan) => void;
  onStartPickupNavigation?: (origin: LatLon, pickup: Station) => void;
}

export default function TripPlanner({
  controller,
  onStartNavigation,
  onStartPickupNavigation,
}: TripPlannerProps) {
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
  return (
    <section className="trip-planner" aria-labelledby="trip-planner-title">
      <div className="section-heading">
        <h2 id="trip-planner-title">Where are you going?</h2>
      </div>

      <div className="trip-planner__locations">
        <fieldset className="origin-mode">
          <legend className="visually-hidden">Starting location method</legend>
          <label>
            <input
              type="radio"
              name="origin-mode"
              value="manual"
              checked={originMode === 'manual'}
              onChange={() => setOriginMode('manual')}
            />
            Enter address
          </label>
          <label>
            <input
              type="radio"
              name="origin-mode"
              value="device"
              checked={originMode === 'device'}
              onChange={() => setOriginMode('device')}
            />
            My location
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
              <p className="visually-hidden" role="status">
                Finding your location.
              </p>
            ) : null}
            {deviceLocation.error ? (
              <div className="device-location__error">
                <p className="field-error" role="alert">
                  Couldn’t find your location. Enter an address or try again.
                </p>
              </div>
            ) : null}
            {!deviceLocation.loading && deviceLocation.error !== null ? (
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
      {origin !== null && selectedPickup !== null && plan === null && onStartPickupNavigation ? (
        <section
          className="pickup-shortcut"
          aria-label="Navigate to your pickup"
          aria-live="polite"
          aria-atomic="true"
        >
          <button
            className="button button--primary"
            type="button"
            onClick={() => onStartPickupNavigation(origin, selectedPickup.station)}
          >
            Navigate to pickup
          </button>
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

      {plan ? <TripResults plan={plan} onStartNavigation={onStartNavigation} /> : null}
    </section>
  );
}
