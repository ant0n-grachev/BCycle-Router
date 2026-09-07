import type { TripLeg, TripPlan } from '../lib/tripPlanner';

const MIN_VISIBLE_WALKING_DISTANCE_MI = 0.005;

function visibleTitle(leg: TripLeg): string {
  return leg.title === 'Ride to dropoff' ? 'Ride to drop-off' : leg.title;
}

function originDescription(leg: TripLeg): string {
  return leg.title === 'Walk to pickup' ? 'Starting location' : leg.fromDescription;
}

function modeLabel(mode: TripLeg['mode']): string {
  return mode === 'walking' ? 'Walk' : 'Ride';
}

export default function TripResults({ plan }: { plan: TripPlan }) {
  const visibleLegs = plan.legs.filter(
    (leg) => leg.mode !== 'walking' || leg.distanceMi >= MIN_VISIBLE_WALKING_DISTANCE_MI,
  );
  const omittedFirstWalk = !visibleLegs.includes(plan.legs[0]);
  const omittedLastWalk = !visibleLegs.includes(plan.legs[2]);
  const hasOmittedLeg = visibleLegs.length !== plan.legs.length;

  return (
    <section className="trip-results" aria-live="polite" aria-atomic="true">
      <h3>{hasOmittedLeg ? 'Your itinerary' : 'Your three-leg itinerary'}</h3>
      <p className="trip-results__note">
        Distances are straight-line estimates. Google Maps calculates the actual route for each
        separate leg.
      </p>
      {omittedFirstWalk ? <p>You’re already at the pickup station.</p> : null}
      {omittedLastWalk ? <p>Your destination is at the drop-off station.</p> : null}
      <ol className="trip-results__legs">
        {visibleLegs.map((leg, index) => {
          const from = originDescription(leg);
          const title = visibleTitle(leg);
          return (
            <li className="trip-results__leg" key={leg.title}>
              <h4>
                {index + 1}. {title}
              </h4>
              <p className="trip-results__route">
                <span>{from}</span>
                <span aria-hidden="true"> → </span>
                <span className="visually-hidden"> to </span>
                <span>{leg.toDescription}</span>
              </p>
              <p className="trip-results__distance">
                {modeLabel(leg.mode)} · {leg.distanceMi.toFixed(2)} mi straight-line estimate
              </p>
              <a
                className="button button--primary trip-results__link"
                href={leg.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${leg.mode} directions from ${from} to ${leg.toDescription} in Google Maps`}
              >
                Open {leg.mode === 'walking' ? 'walking' : 'cycling'} leg in Google Maps
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
