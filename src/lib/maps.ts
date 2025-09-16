import {LatLon} from "../types";

export function buildGMapsMulti(
    origin: LatLon,
    pickup: LatLon,
    dropoff: LatLon,
    dest: LatLon | { label: string }
) {
    const destination = "label" in dest ? dest.label : `${dest.lat},${dest.lon}`;
    const params: Record<string, string> = {
        api: "1",
        origin: `${origin.lat},${origin.lon}`,
        destination,
        waypoints: `${pickup.lat},${pickup.lon}|${dropoff.lat},${dropoff.lon}`,
        travelmode: "bicycling",
    };
    const qp = new URLSearchParams(params);
    return `https://www.google.com/maps/dir/?${qp.toString()}`;
}
