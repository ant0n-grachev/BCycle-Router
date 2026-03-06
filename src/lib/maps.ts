import type {LatLon} from "../types";

function pointToParam(point: LatLon): string {
    return `${point.lat},${point.lon}`;
}

function destinationParam(dest: LatLon | { label: string }): string {
    return "label" in dest ? dest.label : pointToParam(dest);
}

export function buildGMapsMulti(
    origin: LatLon,
    pickup: LatLon,
    dropoff: LatLon,
    dest: LatLon | { label: string }
) {
    const params: Record<string, string> = {
        api: "1",
        origin: pointToParam(origin),
        destination: destinationParam(dest),
        waypoints: `${pointToParam(pickup)}|${pointToParam(dropoff)}`,
        travelmode: "bicycling",
    };
    const qp = new URLSearchParams(params);
    return `https://www.google.com/maps/dir/?${qp.toString()}`;
}

export function buildGMapsWalking(origin: LatLon, destination: LatLon) {
    const params: Record<string, string> = {
        api: "1",
        origin: pointToParam(origin),
        destination: pointToParam(destination),
        travelmode: "walking",
    };
    const qp = new URLSearchParams(params);
    return `https://www.google.com/maps/dir/?${qp.toString()}`;
}
