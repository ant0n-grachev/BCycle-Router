import React, {useEffect, useMemo, useRef, useState} from "react";
import type {LatLon, Station} from "./types";
import {suggestNominatim} from "./lib/geocode";
import type {GeocodeSuggestion} from "./lib/geocode";
import {loadStations} from "./lib/gbfs";
import {haversineKm, kmToMiles} from "./lib/distance";
import {buildGMapsMulti} from "./lib/maps";
import {computeBounds, expandBounds, contains} from "./lib/bounds";
import type {Bounds} from "./lib/bounds";
import ResultCard from "./components/ResultCard";

const OUTSIDE_SERVICE_MESSAGE = "Current location outside of the service area.";

export default function App() {
    const [deviceOrigin, setDeviceOrigin] = useState<LatLon | null>(null);
    const [originErr, setOriginErr] = useState<string | null>(null);
    const [originMode, setOriginMode] = useState<"device" | "manual">("device");
    const [originText, setOriginText] = useState("");
    const [destText, setDestText] = useState("");
    const [systemBounds, setSystemBounds] = useState<Bounds | null>(null);
    const [deviceLocationLocked, setDeviceLocationLocked] = useState(false);
    const [originSuggestions, setOriginSuggestions] = useState<GeocodeSuggestion[]>([]);
    const [destSuggestions, setDestSuggestions] = useState<GeocodeSuggestion[]>([]);
    const originSuggestSeq = useRef(0);
    const destSuggestSeq = useRef(0);
    const [originResolvedSuggestion, setOriginResolvedSuggestion] =
        useState<GeocodeSuggestion | null>(null);
    const [destResolvedSuggestion, setDestResolvedSuggestion] =
        useState<GeocodeSuggestion | null>(null);
    const [originInputFocused, setOriginInputFocused] = useState(false);
    const [destInputFocused, setDestInputFocused] = useState(false);
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
            setOriginMode("manual");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setDeviceOrigin({lat: pos.coords.latitude, lon: pos.coords.longitude});
                setOriginErr(null);
            },
            (err) => {
                setOriginErr(err.message || "Location error");
                setOriginMode((mode) => (mode === "device" ? "manual" : mode));
            },
            {enableHighAccuracy: true, timeout: 15000, maximumAge: 0}
        );
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const stations = await loadStations();
                if (cancelled) return;
                const rawBounds = computeBounds(stations);
                if (rawBounds) {
                    setSystemBounds(expandBounds(rawBounds, 1));
                }
            } catch (err) {
                if (!cancelled) {
                    console.error(err);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!deviceOrigin || !systemBounds) return;

        if (!contains(systemBounds, deviceOrigin.lat, deviceOrigin.lon)) {
            setDeviceLocationLocked(true);
            setOriginErr((prev) =>
                prev === OUTSIDE_SERVICE_MESSAGE ? prev : OUTSIDE_SERVICE_MESSAGE
            );
            setOriginMode((mode) => (mode === "device" ? "manual" : mode));
        } else {
            setDeviceLocationLocked(false);
            setOriginErr((prev) => (prev === OUTSIDE_SERVICE_MESSAGE ? null : prev));
        }
    }, [deviceOrigin, systemBounds]);

    useEffect(() => {
        const seq = ++originSuggestSeq.current;
        if (originMode !== "manual") {
            setOriginSuggestions([]);
            return;
        }

        const trimmed = originText.trim();
        if (!trimmed || (trimmed.length < 3 && !trimmed.includes(","))) {
            setOriginSuggestions([]);
            return;
        }

        const handle = window.setTimeout(() => {
            suggestNominatim(trimmed, {bounds: systemBounds, limit: 5})
                .then((suggestions) => {
                    if (originSuggestSeq.current === seq) {
                        setOriginSuggestions(suggestions);
                    }
                })
                .catch(() => {
                    if (originSuggestSeq.current === seq) {
                        setOriginSuggestions([]);
                    }
                });
        }, 200);

        return () => {
            window.clearTimeout(handle);
        };
    }, [originText, originMode, systemBounds]);

    useEffect(() => {
        const seq = ++destSuggestSeq.current;

        const trimmed = destText.trim();
        if (!trimmed || (trimmed.length < 3 && !trimmed.includes(","))) {
            setDestSuggestions([]);
            return;
        }

        const handle = window.setTimeout(() => {
            suggestNominatim(trimmed, {bounds: systemBounds, limit: 5})
                .then((suggestions) => {
                    if (destSuggestSeq.current === seq) {
                        setDestSuggestions(suggestions);
                    }
                })
                .catch(() => {
                    if (destSuggestSeq.current === seq) {
                        setDestSuggestions([]);
                    }
                });
        }, 200);

        return () => {
            window.clearTimeout(handle);
        };
    }, [destText, systemBounds]);

    const trimmedOrigin = originText.trim();
    const trimmedDest = destText.trim();

    const originSuggestionSelected = Boolean(
        originResolvedSuggestion && originResolvedSuggestion.label === trimmedOrigin
    );
    const destSuggestionSelected = Boolean(
        destResolvedSuggestion && destResolvedSuggestion.label === trimmedDest
    );

    const originNeedsSuggestionNotice =
        originMode === "manual" && trimmedOrigin.length > 0 && !originSuggestionSelected;
    const destNeedsSuggestionNotice =
        trimmedDest.length > 0 && !destSuggestionSelected;

    const canPlan =
        destSuggestionSelected &&
        (originMode === "manual" ? originSuggestionSelected : true);
    const planDisabled = loading || !canPlan;
    const planButtonText = loading
        ? "Planning…"
        : canPlan
        ? "Plan"
        : originMode === "manual"
        ? "Select a starting point and a destination from the suggestions to continue"
        : "Select a destination from the suggestions to continue";

    const showOriginSuggestions =
        originMode === "manual" && originInputFocused && originSuggestions.length > 0;
    const showDestSuggestions = destInputFocused && destSuggestions.length > 0;

    function handleOriginSuggestionSelect(suggestion: GeocodeSuggestion) {
        setOriginText(suggestion.label);
        setOriginResolvedSuggestion(suggestion);
        setOriginSuggestions([]);
        setOriginInputFocused(false);
    }

    function handleDestSuggestionSelect(suggestion: GeocodeSuggestion) {
        setDestText(suggestion.label);
        setDestResolvedSuggestion(suggestion);
        setDestSuggestions([]);
        setDestInputFocused(false);
    }

    const originStatusMessage = originErr
        ? originErr
        : deviceOrigin
        ? `${deviceOrigin.lat.toFixed(5)}, ${deviceOrigin.lon.toFixed(5)}`
        : "Requesting precise location… allow your browser to share it.";
    const originStatusHasError = Boolean(originErr);
    const deviceOptionDisabled = deviceLocationLocked;

    async function handlePlan(e?: React.FormEvent) {
        e?.preventDefault();
        setError(null);
        setResult(null);

        let manualOriginInput: string | null = null;
        if (originMode === "manual") {
            manualOriginInput = trimmedOrigin;
            if (!manualOriginInput) {
                setError("Enter a starting location.");
                return;
            }
            if (
                !originResolvedSuggestion ||
                originResolvedSuggestion.label !== manualOriginInput
            ) {
                setError("Select a starting location from the suggestions.");
                return;
            }
        } else if (!deviceOrigin || deviceLocationLocked) {
            setError(
                deviceLocationLocked
                    ? OUTSIDE_SERVICE_MESSAGE
                    : "Allow location access first or enter a starting location manually."
            );
            return;
        }

        if (!trimmedDest) {
            setError("Enter a destination.");
            return;
        }
        if (!destResolvedSuggestion || destResolvedSuggestion.label !== trimmedDest) {
            setError("Select a destination from the suggestions.");
            return;
        }

        const requestId = ++requestSeq.current;
        setLoading(true);
        try {
            let originForTrip: LatLon;
            if (manualOriginInput !== null) {
                const manualResolved = originResolvedSuggestion!;
                originForTrip = {lat: manualResolved.lat, lon: manualResolved.lon};
            } else {
                originForTrip = deviceOrigin!;
            }

            const ge = destResolvedSuggestion!;

            const stations = await loadStations();
            const rawBounds = computeBounds(stations);
            if (!rawBounds) {
                throw new Error("Could not determine system bounds from stations.");
            }
            const bounds = expandBounds(rawBounds, 1);

            if (!contains(bounds, originForTrip.lat, originForTrip.lon)) {
                const message =
                    manualOriginInput !== null
                        ? "Starting location not found."
                        : "Current location outside of the service area.";
                throw new Error(message);
            }

            if (!contains(bounds, ge.lat, ge.lon)) {
                const msg = "Destination not found.";
                throw new Error(msg);
            }

            const pickup = pickNearestWith(stations, originForTrip, (s) => s.num_bikes_available > 0);
            if (!pickup) throw new Error("No nearby stations with bikes available.");

            const dropoff = pickNearestWith(
                stations,
                ge,
                (s) => s.num_docks_available > 0,
                {requireRenting: false}
            );
            if (!dropoff) throw new Error("No stations with open docks near your destination.");

            const dWalk1Mi = kmToMiles(haversineKm(originForTrip, {lat: pickup.lat, lon: pickup.lon}));
            const dBikeMi = kmToMiles(haversineKm({lat: pickup.lat, lon: pickup.lon}, {
                lat: dropoff.lat,
                lon: dropoff.lon
            }));
            const dWalk2Mi = kmToMiles(haversineKm({lat: dropoff.lat, lon: dropoff.lon}, ge));

            const link = buildGMapsMulti(
                originForTrip,
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
            <main className="card">
                <header className="title">
                    <h1 className="title-line">
                        <span className="title-main">🚲 Madison BCycle Router</span>
                        <a
                            className="title-by"
                            href="https://anton.grachev.us"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            by Anton
                        </a>
                    </h1>
                </header>


                <p className="subtitle">Find a bike nearby, ride to a dock near your destination, and get guided the
                    rest of the way on foot.</p>

                <form onSubmit={handlePlan}>
                    <div className="group">
                        <div className="label">Starting location</div>
                        <div className="info">
                            <div className="origin-options">
                                <label
                                    className={`origin-option${
                                        deviceOptionDisabled ? " origin-option--disabled" : ""
                                    }`}
                                    aria-disabled={deviceOptionDisabled}
                                >
                                    <input
                                        type="radio"
                                        name="origin-mode"
                                        value="device"
                                        checked={originMode === "device"}
                                        onChange={() => setOriginMode("device")}
                                        disabled={deviceOptionDisabled}
                                    />
                                    <span className="origin-option__body">
                                        <span className="origin-option__title">Use my current location</span>
                                        <span
                                            className={`origin-option__status${
                                                originStatusHasError
                                                    ? " origin-option__status--error"
                                                    : ""
                                            }`}
                                        >
                                            {originStatusMessage}
                                        </span>
                                    </span>
                                </label>

                                <label className="origin-option">
                                    <input
                                        type="radio"
                                        name="origin-mode"
                                        value="manual"
                                        checked={originMode === "manual"}
                                        onChange={() => setOriginMode("manual")}
                                    />
                                    <span className="origin-option__body">
                                        <span className="origin-option__title">Enter a location manually</span>
                                    </span>
                                </label>

                                {originMode === "manual" && (
                                    <div className="origin-input-wrapper">
                                        <div className="autocomplete">
                                            <input
                                                className="input origin-input"
                                                inputMode="search"
                                                placeholder="address or lat,lon"
                                                value={originText}
                                                onChange={(e) => {
                                                    setOriginText(e.target.value);
                                                    setOriginResolvedSuggestion(null);
                                                }}
                                                onFocus={() => setOriginInputFocused(true)}
                                                onBlur={() => setOriginInputFocused(false)}
                                                aria-label="Starting location"
                                                autoComplete="off"
                                            />
                                            {showOriginSuggestions && (
                                                <ul
                                                    className="autocomplete__list"
                                                    role="listbox"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                >
                                                    {originSuggestions.map((suggestion, idx) => (
                                                        <li
                                                            key={`${suggestion.lat}-${suggestion.lon}-${idx}`}
                                                            className="autocomplete__item"
                                                        >
                                                            <button
                                                                type="button"
                                                                className="autocomplete__option"
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    handleOriginSuggestionSelect(suggestion);
                                                                }}
                                                            >
                                                                {suggestion.label}
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="group">
                        <div className="label">Destination</div>
                        <div className="row">
                            <div className="autocomplete">
                                <input
                                    className="input"
                                    inputMode="search"
                                    placeholder="address or lat,lon"
                                    value={destText}
                                    onChange={(e) => {
                                        setDestText(e.target.value);
                                        setDestResolvedSuggestion(null);
                                    }}
                                    onFocus={() => setDestInputFocused(true)}
                                    onBlur={() => setDestInputFocused(false)}
                                    aria-label="Destination"
                                    autoComplete="off"
                                />
                                {showDestSuggestions && (
                                    <ul
                                        className="autocomplete__list"
                                        role="listbox"
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        {destSuggestions.map((suggestion, idx) => (
                                            <li
                                                key={`${suggestion.lat}-${suggestion.lon}-${idx}`}
                                                className="autocomplete__item"
                                            >
                                                <button
                                                    type="button"
                                                    className="autocomplete__option"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        handleDestSuggestionSelect(suggestion);
                                                    }}
                                                >
                                                    {suggestion.label}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <button
                                type="submit"
                                className="btn btn--md block-gap"
                                disabled={planDisabled}
                            >
                                {planButtonText}
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
            </main>
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
