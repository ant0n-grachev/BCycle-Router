import React, {useEffect, useMemo, useRef, useState} from "react";
import type {LatLon, Station} from "./types";
import {suggestNominatim} from "./lib/geocode";
import type {GeocodeSuggestion} from "./lib/geocode";
import {loadStations} from "./lib/gbfs";
import {haversineKm, kmToMiles, fmtMilesFeet} from "./lib/distance";
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
    const originInputRef = useRef<HTMLInputElement | null>(null);
    const destInputRef = useRef<HTMLInputElement | null>(null);
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
    const [planLoading, setPlanLoading] = useState(false);
    const [nearestError, setNearestError] = useState<string | null>(null);
    const [nearestResult, setNearestResult] = useState<
        | null
        | {
              station: Station;
              distanceMi: number;
              link: string;
              fallback: boolean;
          }
    >(null);
    const [nearestLoading, setNearestLoading] = useState(false);
    const requestSeq = useRef(0);
    const nearestRequestSeq = useRef(0);

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
    const originPoint = useMemo<LatLon | null>(
        () => {
            if (originMode === "manual") {
                if (!originSuggestionSelected || !originResolvedSuggestion) return null;
                if (originResolvedSuggestion.label !== trimmedOrigin) return null;
                return {
                    lat: originResolvedSuggestion.lat,
                    lon: originResolvedSuggestion.lon,
                };
            }
            if (!deviceOrigin || deviceLocationLocked) return null;
            return deviceOrigin;
        },
        [
            originMode,
            originSuggestionSelected,
            originResolvedSuggestion,
            trimmedOrigin,
            deviceOrigin,
            deviceLocationLocked,
        ]
    );

    const showOriginSuggestions =
        originMode === "manual" && originInputFocused && originSuggestions.length > 0;
    const showDestSuggestions = destInputFocused && destSuggestions.length > 0;
    const showOriginClear = originMode === "manual" && originText.length > 0;
    const showDestClear = destText.length > 0;
    const showNearestError = Boolean(nearestError && !destSuggestionSelected);
    const showNearestCard = Boolean(nearestResult && !destSuggestionSelected);
    const showNearestLoadingCard = Boolean(
        nearestLoading && !destSuggestionSelected && !nearestResult
    );
    const showPlanLoadingCard = Boolean(destSuggestionSelected && planLoading && !result);

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

    function handleClearOrigin() {
        nearestRequestSeq.current++;
        setOriginText("");
        setOriginResolvedSuggestion(null);
        setOriginSuggestions([]);
        window.requestAnimationFrame(() => {
            originInputRef.current?.focus();
        });
    }

    function handleClearDestination() {
        requestSeq.current++;
        setDestText("");
        setDestResolvedSuggestion(null);
        setDestSuggestions([]);
        setResult(null);
        setError(null);
        setPlanLoading(false);
        window.requestAnimationFrame(() => {
            destInputRef.current?.focus();
        });
    }

    const originStatusMessage = originErr
        ? originErr
        : deviceOrigin
        ? `${deviceOrigin.lat.toFixed(5)}, ${deviceOrigin.lon.toFixed(5)}`
        : "Requesting precise location… allow your browser to share it.";
    const originStatusHasError = Boolean(originErr);
    const deviceOptionDisabled = deviceLocationLocked;

    useEffect(() => {
        if (!originPoint) {
            nearestRequestSeq.current++;
            setNearestResult(null);
            setNearestLoading(false);
            if (originMode === "manual" && trimmedOrigin) {
                setNearestError("Select a starting location from the suggestions.");
            } else {
                setNearestError(null);
            }
            return;
        }

        const requestId = ++nearestRequestSeq.current;
        let cancelled = false;
        setNearestLoading(true);
        setNearestError(null);
        setNearestResult(null);

        (async () => {
            try {
                const stations = await loadStations();
                const rawBounds = computeBounds(stations);
                if (!rawBounds) {
                    throw new Error("Could not determine system bounds from stations.");
                }
                const bounds = expandBounds(rawBounds, 1);

                if (!contains(bounds, originPoint.lat, originPoint.lon)) {
                    const message =
                        originMode === "manual"
                            ? "Starting location not found."
                            : OUTSIDE_SERVICE_MESSAGE;
                    throw new Error(message);
                }

                let station = pickNearestWith(
                    stations,
                    originPoint,
                    (s) => s.num_bikes_available > 0
                );
                let fallback = false;
                if (!station) {
                    station = pickNearestWith(stations, originPoint, () => true);
                    fallback = true;
                }
                if (!station) {
                    throw new Error("No nearby stations found.");
                }

                const distanceMi = kmToMiles(
                    haversineKm(originPoint, {lat: station.lat, lon: station.lon})
                );

                const params = new URLSearchParams({
                    api: "1",
                    origin: `${originPoint.lat},${originPoint.lon}`,
                    destination: `${station.lat},${station.lon}`,
                    travelmode: "walking",
                });
                const link = `https://www.google.com/maps/dir/?${params.toString()}`;

                if (nearestRequestSeq.current !== requestId || cancelled) return;

                setNearestResult({
                    station,
                    distanceMi,
                    link,
                    fallback,
                });
            } catch (err: any) {
                if (nearestRequestSeq.current === requestId && !cancelled) {
                    setNearestResult(null);
                    setNearestError(err?.message || "Something went wrong.");
                }
            } finally {
                if (nearestRequestSeq.current === requestId && !cancelled) {
                    setNearestLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [
        originPoint?.lat,
        originPoint?.lon,
        originMode,
        trimmedOrigin,
    ]);

    useEffect(() => {
        if (!destSuggestionSelected) {
            requestSeq.current++;
            setPlanLoading(false);
            setResult(null);
            if (!destResolvedSuggestion) {
                setError(null);
            }
            return;
        }

        if (!originPoint) {
            requestSeq.current++;
            setPlanLoading(false);
            setResult(null);
            if (originMode === "manual") {
                if (!trimmedOrigin) {
                    setError("Enter a starting location.");
                } else if (!originSuggestionSelected) {
                    setError("Select a starting location from the suggestions.");
                }
            } else if (deviceLocationLocked) {
                setError(OUTSIDE_SERVICE_MESSAGE);
            } else if (!deviceOrigin) {
                setError("Allow location access first or enter a starting location manually.");
            }
            return;
        }

        const requestId = ++requestSeq.current;
        let cancelled = false;
        setPlanLoading(true);
        setError(null);
        setResult(null);

        (async () => {
            try {
                const ge = destResolvedSuggestion!;
                const stations = await loadStations();
                const rawBounds = computeBounds(stations);
                if (!rawBounds) {
                    throw new Error("Could not determine system bounds from stations.");
                }
                const bounds = expandBounds(rawBounds, 1);

                if (!contains(bounds, originPoint.lat, originPoint.lon)) {
                    const message =
                        originMode === "manual"
                            ? "Starting location not found."
                            : OUTSIDE_SERVICE_MESSAGE;
                    throw new Error(message);
                }

                if (!contains(bounds, ge.lat, ge.lon)) {
                    throw new Error("Destination not found.");
                }

                const pickup = pickNearestWith(
                    stations,
                    originPoint,
                    (s) => s.num_bikes_available > 0
                );
                if (!pickup) throw new Error("No nearby stations with bikes available.");

                const dropoff = pickNearestWith(
                    stations,
                    ge,
                    (s) => s.num_docks_available > 0,
                    {requireRenting: false}
                );
                if (!dropoff) throw new Error("No stations with open docks near your destination.");

                const dWalk1Mi = kmToMiles(
                    haversineKm(originPoint, {lat: pickup.lat, lon: pickup.lon})
                );
                const dBikeMi = kmToMiles(
                    haversineKm(
                        {lat: pickup.lat, lon: pickup.lon},
                        {lat: dropoff.lat, lon: dropoff.lon}
                    )
                );
                const dWalk2Mi = kmToMiles(
                    haversineKm({lat: dropoff.lat, lon: dropoff.lon}, ge)
                );

                const link = buildGMapsMulti(
                    originPoint,
                    {lat: pickup.lat, lon: pickup.lon},
                    {lat: dropoff.lat, lon: dropoff.lon},
                    ge
                );

                if (requestSeq.current !== requestId || cancelled) return;

                setResult({pickup, dropoff, link, dWalk1Mi, dBikeMi, dWalk2Mi});
            } catch (err: any) {
                if (requestSeq.current === requestId && !cancelled) {
                    setError(err?.message || "Something went wrong.");
                }
            } finally {
                if (requestSeq.current === requestId && !cancelled) {
                    setPlanLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [
        destSuggestionSelected,
        destResolvedSuggestion,
        originPoint?.lat,
        originPoint?.lon,
        originMode,
        trimmedOrigin,
        originSuggestionSelected,
        deviceLocationLocked,
        deviceOrigin,
    ]);

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

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                    }}
                >
                    <div className="group">
                        <div className="info location-panel">
                            <div className="location-panel__section">
                                <div className="location-panel__title">Starting location</div>
                                <div className="location-panel__content">
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
                                                        ref={originInputRef}
                                                        className={`input origin-input${
                                                            showOriginClear ? " input--with-clear" : ""
                                                        }`}
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
                                                    {showOriginClear && (
                                                        <button
                                                            type="button"
                                                            className="autocomplete__clear"
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onClick={handleClearOrigin}
                                                            aria-label="Clear starting location"
                                                        >
                                                            &times;
                                                        </button>
                                                    )}
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

                            <div className="location-panel__separator" aria-hidden="true" />

                            <div className="location-panel__section">
                                <div className="location-panel__title">Destination</div>
                                <div className="location-panel__content">
                                    <div className="autocomplete">
                                        <input
                                            ref={destInputRef}
                                            className={`input${showDestClear ? " input--with-clear" : ""}`}
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
                                        {showDestClear && (
                                            <button
                                                type="button"
                                                className="autocomplete__clear"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={handleClearDestination}
                                                aria-label="Clear destination"
                                            >
                                                &times;
                                            </button>
                                        )}
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
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && <div className="alert">{error}</div>}
                    {showNearestError && <div className="alert">{nearestError}</div>}

                    {showPlanLoadingCard && (
                        <div className="result-card block-gap">Planning your trip…</div>
                    )}

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

                    {showNearestLoadingCard && (
                        <div className="result-card block-gap">Finding the closest station…</div>
                    )}

                    {showNearestCard && nearestResult && (
                        <div className="result-card block-gap">
                            <strong>Nearest station:</strong> {nearestResult.station.name} — bikes: {nearestResult.station.num_bikes_available}
                            <div className="small">
                                {nearestResult.station.lat.toFixed(5)}, {nearestResult.station.lon.toFixed(5)} (about {fmtMilesFeet(nearestResult.distanceMi)} away)
                            </div>
                            {nearestResult.fallback && (
                                <div className="small">
                                    No available bikes nearby; showing the closest station instead.
                                </div>
                            )}
                            <div style={{height: 8}} />
                            <a
                                href={nearestResult.link}
                                target={isMobile ? "_self" : "_blank"}
                                rel={isMobile ? undefined : "noopener noreferrer"}
                                className="btn btn--md btn--block"
                            >
                                Open route in Google Maps
                            </a>
                        </div>
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
