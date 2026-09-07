import type { LatLon } from '../types';

function pointToParam(point: LatLon): string {
  return `${point.lat},${point.lon}`;
}

function buildGMapsDirections(
  origin: LatLon,
  destination: LatLon,
  travelmode: 'walking' | 'bicycling',
) {
  const params: Record<string, string> = {
    api: '1',
    origin: pointToParam(origin),
    destination: pointToParam(destination),
    travelmode,
  };
  return `https://www.google.com/maps/dir/?${new URLSearchParams(params).toString()}`;
}

export function buildGMapsWalking(origin: LatLon, destination: LatLon) {
  return buildGMapsDirections(origin, destination, 'walking');
}

export function buildGMapsBicycling(origin: LatLon, destination: LatLon) {
  return buildGMapsDirections(origin, destination, 'bicycling');
}
