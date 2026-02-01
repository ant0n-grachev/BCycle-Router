import {useEffect, useState} from "react";
import type {LatLon} from "../types";
import type {Bounds} from "../lib/bounds";
import {contains} from "../lib/bounds";

interface UseDeviceLocationOptions {
    enabled: boolean;
    bounds: Bounds | null;
    outsideMessage: string;
    onRequireManual: () => void;
}

export function useDeviceLocation({
    enabled,
    bounds,
    outsideMessage,
    onRequireManual,
}: UseDeviceLocationOptions) {
    const [location, setLocation] = useState<LatLon | null>(null);
    const [requested, setRequested] = useState(false);
    const [locked, setLocked] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled) return;

        setRequested(true);

        if (!navigator.geolocation) {
            setStatus("Geolocation not supported by your browser.");
            onRequireManual();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({lat: pos.coords.latitude, lon: pos.coords.longitude});
                setStatus(null);
            },
            (err) => {
                setStatus(err.message || "Location error");
                onRequireManual();
            },
            {enableHighAccuracy: true, timeout: 15000, maximumAge: 0}
        );
    }, [enabled, onRequireManual]);

    useEffect(() => {
        if (!location || !bounds) return;

        if (!contains(bounds, location.lat, location.lon)) {
            setLocked(true);
            setStatus(outsideMessage);
            onRequireManual();
        } else {
            setLocked(false);
            setStatus((prev) => (prev === outsideMessage ? null : prev));
        }
    }, [location, bounds, outsideMessage, onRequireManual]);

    return {location, requested, locked, status};
}
