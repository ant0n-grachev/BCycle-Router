import { useId } from 'react';
import type { RankedStation, StationRankKind } from '../lib/stations';

interface StationChoiceProps {
  kind: StationRankKind;
  candidates: readonly RankedStation[];
  selectedId: string;
  onSelect: (stationId: string) => void;
}

function availabilityText(candidate: RankedStation, kind: StationRankKind): string {
  const count =
    kind === 'pickup'
      ? candidate.station.num_bikes_available
      : candidate.station.num_docks_available;
  const noun = kind === 'pickup' ? 'bike' : 'dock';
  return `${count} ${noun}${count === 1 ? '' : 's'} available`;
}

function lowAvailabilityText(candidate: RankedStation, kind: StationRankKind): string | null {
  const count =
    kind === 'pickup'
      ? candidate.station.num_bikes_available
      : candidate.station.num_docks_available;
  if (count !== 1) return null;
  return kind === 'pickup' ? 'Only 1 bike available.' : 'Only 1 dock available.';
}

function rankingLabel(candidate: RankedStation, kind: StationRankKind): string {
  if (candidate.reason === 'closest') return 'Recommended — closest';
  if (candidate.reason === 'more-availability') {
    return kind === 'pickup' ? 'Alternative — more bikes' : 'Alternative — more docks';
  }
  return 'Alternative — next closest';
}

export default function StationChoice({
  kind,
  candidates,
  selectedId,
  onSelect,
}: StationChoiceProps) {
  const generatedId = useId();
  const title = kind === 'pickup' ? 'Pickup station' : 'Drop-off station';

  return (
    <fieldset className="station-choice">
      <legend>{title}</legend>
      <div className="station-choice__list">
        {candidates.map((candidate) => {
          const inputId = `${generatedId}-${candidate.station.station_id}`;
          const warning = lowAvailabilityText(candidate, kind);
          return (
            <label
              className={
                candidate.station.station_id === selectedId
                  ? 'station-choice__item station-choice__item--selected'
                  : 'station-choice__item'
              }
              htmlFor={inputId}
              key={candidate.station.station_id}
            >
              <input
                id={inputId}
                type="radio"
                name={`${generatedId}-${kind}`}
                checked={candidate.station.station_id === selectedId}
                onChange={() => onSelect(candidate.station.station_id)}
              />
              <span className="station-choice__body">
                <span className="station-choice__heading">
                  <span className="station-choice__name">{candidate.station.name}</span>
                  <span className="station-choice__badge">{rankingLabel(candidate, kind)}</span>
                </span>
                <span className="station-choice__meta">
                  {candidate.distanceMi.toFixed(2)} mi · {availabilityText(candidate, kind)}
                </span>
                {warning ? <span className="station-choice__warning">{warning}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
