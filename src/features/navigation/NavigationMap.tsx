import { useEffect, useMemo, useReducer, useState } from 'react';
import { divIcon, latLng, point, type LatLngTuple } from 'leaflet';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
  ZoomControl,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getStationMapState, type StationMapStateName } from '../../components/stationMapState';
import type { LatLon, Station } from '../../types';
import type { LocationFix } from './navigationLocation';
import type { RoutedPath } from './routingTypes';
import NavigationIcon from './NavigationIcon';

interface NavigationMapProps {
  route: RoutedPath | null;
  fix: LocationFix | null;
  heading: number | null;
  locationEnabled: boolean;
  active: boolean;
  onFollow: () => void;
  target: LatLon;
  stations: Station[];
  missingStationIds: string[];
  targetStationId: string | null;
}

const stationStateColors: Record<StationMapStateName, string> = {
  pickup: '#0369a1',
  dropoff: '#166534',
  'pickup-dropoff': '#6d28d9',
  empty: '#166534',
  full: '#0369a1',
  unavailable: '#b91c1c',
  disabled: '#475569',
};

type CameraMode = 'overview' | 'follow' | 'free';

function Camera({
  route,
  fix,
  mode,
  revision,
  onDrag,
}: {
  route: RoutedPath | null;
  fix: LocationFix | null;
  mode: CameraMode;
  revision: number;
  onDrag: () => void;
}) {
  const map = useMap();
  useMapEvents({ dragstart: onDrag });
  const showRoute = mode === 'overview' || (mode === 'follow' && !fix);
  useEffect(() => {
    if (showRoute && route && route.geometry.length > 1)
      map.fitBounds(
        route.geometry.map((p) => [p.lat, p.lon]),
        {
          paddingTopLeft: [40, Math.min(190, map.getSize().y * 0.25)],
          paddingBottomRight: [40, Math.min(240, map.getSize().y * 0.3)],
          maxZoom: 17,
          animate: false,
        },
      );
  }, [showRoute, map, route, revision]);
  useEffect(() => {
    if (mode === 'follow' && fix) {
      const position = latLng(fix.lat, fix.lon);
      const zoom = Math.min(
        18,
        map.getBoundsZoom(position.toBounds(Math.max(20, fix.accuracy * 2)), false, point(80, 160)),
      );
      map.setView(position, zoom, { animate: true, duration: 0.35 });
    }
  }, [mode, fix, map, revision]);
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  return null;
}

export default function NavigationMap({
  route,
  fix,
  heading,
  locationEnabled,
  active,
  onFollow,
  target,
  stations,
  missingStationIds,
  targetStationId,
}: NavigationMapProps) {
  const [mode, setMode] = useState<CameraMode>('overview');
  const [revision, moveCamera] = useReducer((value: number) => value + 1, 0);
  const displayedFix = locationEnabled ? fix : null;
  const displayedHeading = locationEnabled ? heading : null;
  const positions = useMemo<LatLngTuple[]>(
    () => route?.geometry.map((point) => [point.lat, point.lon]) ?? [],
    [route],
  );
  const markerIcon = useMemo(() => {
    const direction = displayedHeading ?? displayedFix?.heading;
    const rotation =
      typeof direction === 'number' &&
      Number.isFinite(direction) &&
      direction >= 0 &&
      direction < 360
        ? direction
        : null;
    const source = rotation === null ? 'none' : displayedHeading !== null ? 'compass' : 'gps';
    const shape =
      rotation === null
        ? '<circle cx="12" cy="12" r="5" fill="currentColor" />'
        : '<path d="m12 2 8 19-8-4-8 4Z" fill="currentColor" />';
    return divIcon({
      className: 'navigation-location-marker',
      html: `<div class="navigation-location-marker__heading" data-heading="${rotation ?? ''}" data-heading-source="${source}" style="transform:rotate(${rotation ?? 0}deg)">${rotation === null ? '' : '<span class="navigation-location-marker__cone" aria-hidden="true"></span>'}<div class="navigation-location-marker__point"><svg class="navigation-location-marker__${rotation === null ? 'dot' : 'arrow'}" viewBox="0 0 24 24" aria-hidden="true">${shape}</svg></div></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }, [displayedFix?.heading, displayedHeading]);
  return (
    <div className="navigation-map" role="region" aria-label="Navigation map">
      <MapContainer
        center={[target.lat, target.lon]}
        zoom={15}
        zoomControl={false}
        attributionControl={false}
        className="navigation-map__leaflet"
        keyboard
        scrollWheelZoom
      >
        <Camera
          route={route}
          fix={displayedFix}
          mode={mode}
          revision={revision}
          onDrag={() => setMode('free')}
        />
        <ZoomControl position="topright" />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }
        />
        {positions.length > 1 ? (
          <>
            <Polyline
              positions={positions}
              pathOptions={{ color: '#ffffff', weight: 11, opacity: 0.95 }}
            />
            <Polyline
              positions={positions}
              pathOptions={{ color: '#2877e5', weight: 7, opacity: 1 }}
            />
          </>
        ) : null}
        {stations.map((station) => {
          const mapState = getStationMapState(station);
          const missing = missingStationIds.includes(station.station_id);
          const counts = missing
            ? '—/—'
            : `${station.num_bikes_available}/${station.num_docks_available}`;
          const availability = missing
            ? 'Availability unavailable'
            : `${station.num_bikes_available} bikes, ${station.num_docks_available} docks. ${mapState.label}.`;
          return (
            <CircleMarker
              key={station.station_id}
              center={[station.lat, station.lon]}
              radius={station.station_id === targetStationId ? 11 : 7}
              pathOptions={{
                color: '#ffffff',
                weight: 3,
                fillColor: missing
                  ? stationStateColors.unavailable
                  : stationStateColors[mapState.state],
                fillOpacity: 1,
              }}
            >
              <Tooltip direction="top" permanent className="navigation-map__count">
                <span aria-label={`${station.name}: ${availability}`}>{counts}</span>
              </Tooltip>
              <Popup>
                <strong>{station.name}</strong>
                <br />
                {availability}
              </Popup>
            </CircleMarker>
          );
        })}
        {!targetStationId ? (
          <CircleMarker
            center={[target.lat, target.lon]}
            radius={9}
            pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#7c3aed', fillOpacity: 1 }}
          >
            <Tooltip permanent>Destination</Tooltip>
          </CircleMarker>
        ) : null}
        {displayedFix ? (
          <>
            <Circle
              center={[displayedFix.lat, displayedFix.lon]}
              radius={displayedFix.accuracy}
              pathOptions={{ color: '#0284c7', weight: 1, fillOpacity: 0.1 }}
            />
            <Marker
              position={[displayedFix.lat, displayedFix.lon]}
              icon={markerIcon}
              zIndexOffset={1000}
              title="Your location"
              alt="Your location"
            >
              <Tooltip>Your location</Tooltip>
            </Marker>
          </>
        ) : null}
      </MapContainer>
      {locationEnabled ? (
        <button
          type="button"
          className="navigation-map__recenter"
          onClick={() => {
            onFollow();
            setMode('follow');
            moveCamera();
          }}
          aria-pressed={mode === 'follow' && displayedFix !== null}
          aria-label={displayedFix ? 'Follow my location' : 'Use my location'}
          disabled={!active}
        >
          <NavigationIcon name="locate" />
        </button>
      ) : null}
      <button
        type="button"
        className={`navigation-map__recenter${locationEnabled ? ' navigation-map__overview' : ''}`}
        onClick={() => {
          setMode('overview');
          moveCamera();
        }}
        aria-pressed={mode === 'overview'}
        aria-label="Show route"
        disabled={!route}
      >
        <NavigationIcon name="route" />
      </button>
    </div>
  );
}
