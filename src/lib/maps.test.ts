import { buildGMapsBicycling, buildGMapsWalking } from './maps';

describe('Google Maps directions links', () => {
  it('builds distinct walking and bicycling directions URLs without cross-leg waypoints', () => {
    const origin = { lat: 43.0731, lon: -89.4012 };
    const destination = { lat: 43.0805, lon: -89.3905 };
    const walking = new URL(buildGMapsWalking(origin, destination));
    const bicycling = new URL(buildGMapsBicycling(origin, destination));

    expect(walking.searchParams.get('travelmode')).toBe('walking');
    expect(bicycling.searchParams.get('travelmode')).toBe('bicycling');
    expect(walking.searchParams.has('waypoints')).toBe(false);
    expect(bicycling.searchParams.has('waypoints')).toBe(false);
    expect(walking.searchParams.get('origin')).toBe('43.0731,-89.4012');
    expect(bicycling.searchParams.get('destination')).toBe('43.0805,-89.3905');
  });
});
