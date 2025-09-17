import React, {useEffect, useMemo, useRef, useState} from "react";
import type {LatLon, Station} from "./types";
import {geocodeNominatim} from "./lib/geocode";
import {loadStations} from "./lib/gbfs";
import {haversineKm, kmToMiles} from "./lib/distance";
import {buildGMapsMulti} from "./lib/maps";
import {computeBounds, expandBounds, contains} from "./lib/bounds";
import ResultCard from "./components/ResultCard";

export default function App() {
    const [origin, setOrigin] = useState<LatLon | null>(null);
    const [originErr, setOriginErr] = useState<string | null>(null);
    const [destText, setDestText] = useState("");
    const [result, setResult] = useState<null | {
        pickup: Station;
        dropoff: Station;
        link: string;
        dWalk1Mi: number;
        dBikeMi: number;
        dWalk2Mi: number;
    }>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const requestSeq = useRef(0);

    const isMobile = useMemo(
        () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
        []
    );

    useEffect(() => {
        if (!navigator.geolocation) {
            setOriginErr("Geolocation not supported by your browser.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => setOrigin({lat: pos.coords.latitude, lon: pos.coords.longitude}),
            (err) => setOriginErr(err.message || "Location error"),
            {enableHighAccuracy: true, timeout: 15000, maximumAge: 0}
        );
    }, []);

    async function handlePlan(e?: React.FormEvent) {
        e?.preventDefault();
        setError(null);
        setResult(null);

        if (!origin) return setError("Allow location access first.");
        const trimmedDest = destText.trim();
        if (!trimmedDest) return setError("Enter a destination (address or lat,lon).");

        const requestId = ++requestSeq.current;
        setLoading(true);
        try {
            const ge = await geocodeNominatim(trimmedDest);

            const stations = await loadStations();
            const rawBounds = computeBounds(stations);
            if (!rawBounds) {
                throw new Error("Could not determine system bounds from stations.");
            }
            const bounds = expandBounds(rawBounds, 1);

            if (!contains(bounds, ge.lat, ge.lon)) {
                const msg = "Destination not found.";
                throw new Error(msg);
            }

            const pickup = pickNearestWith(stations, origin, (s) => s.num_bikes_available > 0);
            if (!pickup) throw new Error("No nearby stations with bikes available.");
            const dropoff = pickNearestWith(
                stations,
                ge,
                (s) => s.num_docks_available > 0,
                {requireRenting: false}
            );
            if (!dropoff) throw new Error("No stations with open docks near your destination.");

            const dWalk1Mi = kmToMiles(haversineKm(origin, {lat: pickup.lat, lon: pickup.lon}));
            const dBikeMi = kmToMiles(haversineKm({lat: pickup.lat, lon: pickup.lon}, {
                lat: dropoff.lat,
                lon: dropoff.lon
            }));
            const dWalk2Mi = kmToMiles(haversineKm({lat: dropoff.lat, lon: dropoff.lon}, ge));

            const link = buildGMapsMulti(
                origin,
                {lat: pickup.lat, lon: pickup.lon},
                {lat: dropoff.lat, lon: dropoff.lon},
                ge
            );

            if (requestSeq.current !== requestId) return;
            setResult({pickup, dropoff, link, dWalk1Mi, dBikeMi, dWalk2Mi});
        } catch (err: any) {
            if (requestSeq.current === requestId) {
                setError(err?.message || "Something went wrong.");
            }
        } finally {
            if (requestSeq.current === requestId) {
                setLoading(false);
            }
        }
    }

    return (
        <div className="wrap">
            <div className="card">
                <div className="title">
                    <span className="title-line">
                        <span className="title-main">🚲 Madison BCycle Router</span>
                        {"\u00A0"}
                        <a className="title-by" href="https://anton.grachev.us" target="_blank"
                           rel="noopener noreferrer">
                            by Anton
                        </a>
                    </span>
                </div>


                <p className="subtitle">Find a bike nearby, ride to a dock near your destination, and get guided the
                    rest of the way on foot.</p>

                <form onSubmit={handlePlan}>
                    <div className="group">
                        <div className="label">Your current location</div>
                        <div className="info">
                            {origin ? (
                                <span>{origin.lat.toFixed(5)}, {origin.lon.toFixed(5)}</span>
                            ) : originErr ? (
                                <span style={{color: "#dc2626"}}>{originErr}</span>
                            ) : (
                                <span>Requesting precise location… allow your browser to share it.</span>
                            )}
                        </div>
                    </div>

                    <div className="group">
                        <div className="label">Destination (address or lat,lon)</div>
                        <div className="row">
                            <input
                                className="input"
                                inputMode="search"
                                placeholder="e.g., 2 E Main St, Madison or 43.0747,-89.3842"
                                value={destText}
                                onChange={(e) => setDestText(e.target.value)}
                                aria-label="Destination"
                            />
                            <button type="submit" className="btn btn--md block-gap" disabled={loading}>
                                {loading ? "Planning…" : "Plan"}
                            </button>
                        </div>
                    </div>

                    {error && <div className="alert">{error}</div>}

                    {result && (
                        <>
                            <ResultCard
                                className="block-gap"
                                pickup={result.pickup}
                                dropoff={result.dropoff}
                                dWalk1Mi={result.dWalk1Mi}
                                dBikeMi={result.dBikeMi}
                                dWalk2Mi={result.dWalk2Mi}
                            />

                            <a
                                href={result.link}
                                target={isMobile ? "_self" : "_blank"}
                                rel={isMobile ? undefined : "noopener noreferrer"}
                                className="btn btn--lg btn--block block-gap"
                            >
                                Open route in Google Maps
                            </a>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
}

function pickNearestWith(
    stations: Station[],
    origin: LatLon,
    predicate: (s: Station) => boolean,
    options?: { requireRenting?: boolean; requireReturning?: boolean }
): Station | null {
    const {requireRenting = true, requireReturning = true} = options ?? {};
    return stations
        .filter(
            (s) =>
                s.is_installed &&
                (!requireRenting || s.is_renting) &&
                (!requireReturning || s.is_returning) &&
                predicate(s)
        )
        .map((s) => ({s, d: haversineKm(origin, {lat: s.lat, lon: s.lon})}))
        .sort((a, b) => a.d - b.d)[0]?.s ?? null;
}
