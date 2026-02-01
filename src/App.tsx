import React, {useEffect, useMemo, useRef, useState} from "react";
import type {LatLon, Station} from "./types";
import type {GeocodeSuggestion} from "./lib/geocode";
import {setShowcaseMode} from "./lib/gbfs";
import {haversineKm, kmToMiles} from "./lib/distance";
import {buildGMapsMulti} from "./lib/maps";
import {contains} from "./lib/bounds";
import {
    AutocompleteField,
    LocationPanel,
    OriginSection,
    PlanActions,
    StationMarker,
} from "./components";
import type {LocationSection} from "./components";
import {MapContainer, Rectangle, TileLayer, useMap} from "react-leaflet";
import type {LatLngBoundsExpression} from "leaflet";
import {
    useSuggestions,
    useDeviceLocation,
    useLatestAsync,
    useServiceAreaData,
    useOriginPoint,
    useDestinationSelection,
} from "./hooks";

const OUTSIDE_SERVICE_MESSAGE = "Current location outside of the service area.";
const OSM_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default function App() {
    const [originMode, setOriginMode] = useState<"device" | "manual">("manual");
    const originInputRef = useRef<HTMLInputElement | null>(null);
    const destInputRef = useRef<HTMLInputElement | null>(null);
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
    const [serviceAreaExpanded, setServiceAreaExpanded] = useState(false);
    const runNearestTask = useLatestAsync();
    const runPlanTask = useLatestAsync();

    const {
        data: serviceAreaData,
        seasonClosed,
        refresh: refreshServiceArea,
        refreshing: serviceAreaRefreshing,
    } = useServiceAreaData();
    const serviceAreaStations = serviceAreaData?.stations ?? null;
    const systemBounds = serviceAreaData?.bounds ?? null;

    const {
        location: deviceOrigin,
        requested: deviceLocationRequested,
        locked: deviceLocationLocked,
        status: deviceStatusMessage,
    } = useDeviceLocation({
        enabled: originMode === "device",
        bounds: systemBounds,
        outsideMessage: OUTSIDE_SERVICE_MESSAGE,
        onRequireManual: () => setOriginMode((mode) => (mode === "device" ? "manual" : mode)),
    });

    const {
        manualText: originText,
        setManualText: setOriginText,
        selectSuggestion: selectOriginSuggestion,
        clearManual: clearOriginManual,
        validate,
    } = useOriginPoint({
        mode: originMode,
        deviceOrigin,
        deviceLocked: deviceLocationLocked,
        outsideMessage: OUTSIDE_SERVICE_MESSAGE,
    });

    const {
        value: destText,
        setValue: setDestText,
        select: selectDestSuggestion,
        clear: clearDestSelection,
        isSelected: destSuggestionSelected,
        validate: validateDestination,
    } = useDestinationSelection();

    const isMobile = useMemo(
        () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
        []
    );

    useEffect(() => {
        if (!systemBounds) {
            setServiceAreaExpanded(false);
        }
    }, [systemBounds]);

    useEffect(() => {
        function showcaseCommand(enabled: boolean = true) {
            setShowcaseMode(Boolean(enabled));
            refreshServiceArea();
        }
        (window as any).bcycleShowcase = showcaseCommand;
        return () => {
            if ((window as any).bcycleShowcase === showcaseCommand) {
                delete (window as any).bcycleShowcase;
            }
        };
    }, [refreshServiceArea]);

    const {suggestions: originSuggestions, noResults: originNoResults, clear: clearOriginSuggestions} =
        useSuggestions(originText, {enabled: originMode === "manual", bounds: systemBounds});
    const {suggestions: destSuggestions, noResults: destNoResults, clear: clearDestSuggestions} =
        useSuggestions(destText, {enabled: true, bounds: systemBounds});


    const showOriginClear = originMode === "manual" && originText.length > 0;
    const showDestClear = destText.length > 0;
    const planState = useMemo(
        () => ({loading: destSuggestionSelected && planLoading && !result, error}),
        [destSuggestionSelected, planLoading, result, error]
    );
    const nearestState = useMemo(
        () => ({
            loading: nearestLoading && !destSuggestionSelected && !nearestResult,
            showCard: Boolean(nearestResult && !destSuggestionSelected),
            error:
                !destSuggestionSelected && !nearestResult && nearestError
                    ? nearestError
                    : null,
        }),
        [nearestLoading, destSuggestionSelected, nearestResult, nearestError]
    );

    function handleOriginSuggestionSelect(suggestion: GeocodeSuggestion) {
        selectOriginSuggestion(suggestion);
        clearOriginSuggestions();
        originInputRef.current?.blur();
    }

    function handleDestSuggestionSelect(suggestion: GeocodeSuggestion) {
        selectDestSuggestion(suggestion);
        clearDestSuggestions();
        destInputRef.current?.blur();
    }

    function handleClearOrigin() {
        clearOriginManual();
        clearOriginSuggestions();
        window.requestAnimationFrame(() => {
            originInputRef.current?.focus();
        });
    }

    function handleClearDestination() {
        clearDestSelection();
        clearDestSuggestions();
        setResult(null);
        setError(null);
        setPlanLoading(false);
        window.requestAnimationFrame(() => {
            destInputRef.current?.focus();
        });
    }

    const originStatusMessage = deviceStatusMessage
        ? deviceStatusMessage
        : deviceOrigin
        ? `${deviceOrigin.lat.toFixed(5)}, ${deviceOrigin.lon.toFixed(5)}`
        : deviceLocationRequested
        ? "Requesting precise location..."
        : "Location access not requested.";
    const originStatusHasError = Boolean(deviceStatusMessage);
    const deviceOptionDisabled = deviceLocationLocked;
    const serviceAreaBounds = useMemo<LatLngBoundsExpression | null>(() => {
        if (!systemBounds) return null;
        return [
            [systemBounds.south, systemBounds.west],
            [systemBounds.north, systemBounds.east],
        ];
    }, [systemBounds]);

    useEffect(() => {
        if (seasonClosed) {
            setNearestResult(null);
            setNearestError(null);
            setNearestLoading(false);
            return;
        }

        const {point: validOrigin, error: originError} = validate({forNearest: true});
        if (!validOrigin) {
            setNearestResult(null);
            setNearestLoading(false);
            setNearestError(originError);
            return;
        }

        if (!serviceAreaStations || !systemBounds) {
            setNearestLoading(true);
            setNearestResult(null);
            setNearestError(null);
            return;
        }

        setNearestLoading(true);
        setNearestError(null);
        setNearestResult(null);

        runNearestTask(
            async () => {
                const stations = serviceAreaStations;
                const bounds = systemBounds;

                if (!contains(bounds, validOrigin.lat, validOrigin.lon)) {
                    const message =
                        originMode === "manual"
                            ? "Starting location not found."
                            : OUTSIDE_SERVICE_MESSAGE;
                    throw new Error(message);
                }

                let station = pickNearestWith(
                    stations,
                    validOrigin,
                    (s) => s.num_bikes_available > 0
                );
                let fallback = false;
                if (!station) {
                    station = pickNearestWith(stations, validOrigin, () => true);
                    fallback = true;
                }
                if (!station) {
                    throw new Error("No nearby stations found.");
                }

                const distanceMi = kmToMiles(
                    haversineKm(validOrigin, {lat: station.lat, lon: station.lon})
                );

                const params = new URLSearchParams({
                    api: "1",
                    origin: `${validOrigin.lat},${validOrigin.lon}`,
                    destination: `${station.lat},${station.lon}`,
                    travelmode: "walking",
                });
                const link = `https://www.google.com/maps/dir/?${params.toString()}`;

                return {
                    station,
                    distanceMi,
                    link,
                    fallback,
                };
            },
            {
                onSuccess: (data) => setNearestResult(data),
                onError: (message) => setNearestError(message),
                onFinally: () => setNearestLoading(false),
            }
        );
    }, [
        seasonClosed,
        validate,
        originMode,
        serviceAreaStations,
        systemBounds,
        runNearestTask,
    ]);

    useEffect(() => {
        if (seasonClosed) {
            setPlanLoading(false);
            setResult(null);
            setError(null);
            return;
        }

        const {selection: selectedDestination, error: destinationError} =
            validateDestination();

        if (!destSuggestionSelected || !selectedDestination) {
            setPlanLoading(false);
            setResult(null);
            if (destText.trim()) {
                setError(destinationError);
            } else {
                setError(null);
            }
            return;
        }

        const {point: validOrigin, error: planOriginError} = validate();
        if (!validOrigin) {
            setPlanLoading(false);
            setResult(null);
            setError(planOriginError);
            return;
        }

        if (!serviceAreaStations || !systemBounds) {
            setPlanLoading(true);
            setResult(null);
            return;
        }

        setPlanLoading(true);
        setError(null);
        setResult(null);

        runPlanTask(
            async () => {
                const ge = selectedDestination;
                const stations = serviceAreaStations;
                const bounds = systemBounds;

                if (!contains(bounds, validOrigin.lat, validOrigin.lon)) {
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
                    validOrigin,
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
                    haversineKm(validOrigin, {lat: pickup.lat, lon: pickup.lon})
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
                    validOrigin,
                    {lat: pickup.lat, lon: pickup.lon},
                    {lat: dropoff.lat, lon: dropoff.lon},
                    ge
                );

                return {pickup, dropoff, link, dWalk1Mi, dBikeMi, dWalk2Mi};
            },
            {
                onSuccess: (data) => setResult(data),
                onError: (message) => setError(message),
                onFinally: () => setPlanLoading(false),
            }
        );
    }, [
        destSuggestionSelected,
        destText,
        originMode,
        validate,
        validateDestination,
        seasonClosed,
        serviceAreaStations,
        systemBounds,
        runPlanTask,
    ]);

    const originAutocompleteField = (
        <AutocompleteField
            inputRef={originInputRef}
            value={originText}
            onChange={setOriginText}
            placeholder="address or lat,lon"
            ariaLabel="Starting location"
            suggestions={originSuggestions}
            noResults={originNoResults}
            onSelect={handleOriginSuggestionSelect}
            showClear={showOriginClear}
            onClear={handleClearOrigin}
        />
    );

    const destinationAutocompleteField = (
        <AutocompleteField
            inputRef={destInputRef}
            value={destText}
            onChange={setDestText}
            placeholder="address or lat,lon"
            ariaLabel="Destination"
            suggestions={destSuggestions}
            noResults={destNoResults}
            onSelect={handleDestSuggestionSelect}
            showClear={showDestClear}
            onClear={handleClearDestination}
        />
    );

    const locationSections: LocationSection[] = [
        {
            key: "origin",
            title: "Starting location",
            content: (
                <OriginSection
                    mode={originMode}
                    disabled={deviceOptionDisabled}
                    status={originStatusMessage}
                    statusHasError={originStatusHasError}
                    onModeChange={setOriginMode}
                    manualField={originAutocompleteField}
                />
            ),
            separatorAfter: true,
        },
        {
            key: "destination",
            title: "Destination",
            content: destinationAutocompleteField,
        },
    ];

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

                {seasonClosed && (
                    <div className="service-area__closed">
                        Madison BCycle is currently closed.
                    </div>
                )}

                <section className="service-area">
                    <div className="service-area__header">
                        <div>
                            <div className="service-area__label">Service area</div>
                            <div className="service-area__hint">View the current system boundary.</div>
                        </div>
                        <div className="service-area__actions">
                            {serviceAreaExpanded && (
                                <button
                                    type="button"
                                    className="service-area__toggle"
                                    onClick={refreshServiceArea}
                                    disabled={!serviceAreaBounds || serviceAreaRefreshing}
                                >
                                    {serviceAreaRefreshing ? "Refreshing..." : "Refresh"}
                                </button>
                            )}
                            <button
                                type="button"
                                className="service-area__toggle"
                                onClick={() => setServiceAreaExpanded((prev) => !prev)}
                                disabled={!serviceAreaBounds || !serviceAreaStations}
                            >
                                {serviceAreaExpanded ? "Hide map" : "Show map"}
                            </button>
                        </div>
                    </div>
                    {serviceAreaExpanded && (
                        <div className="service-area__map-wrapper">
                            {serviceAreaBounds && serviceAreaStations ? (
                                <ServiceAreaMap bounds={serviceAreaBounds} stations={serviceAreaStations}/>
                            ) : (
                                <div className="service-area__empty">Service area unavailable.</div>
                            )}
                        </div>
                    )}
                </section>

                {seasonClosed ? null : (
                    <section>
                        <LocationPanel sections={locationSections}/>

                        {planState.error && !planState.loading && (
                            <div className="alert">{planState.error}</div>
                        )}

                        <PlanActions
                            result={result}
                            nearest={nearestResult}
                            planState={planState}
                            nearestState={nearestState}
                            isMobile={isMobile}
                        />
                    </section>
                )}
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

function ServiceAreaMap({bounds, stations}: {bounds: LatLngBoundsExpression; stations: Station[]}) {
    const markers = useMemo(
        () => stations.map((station) => <StationMarker key={station.station_id} station={station}/>),
        [stations]
    );

    return (
        <MapContainer
            className="service-area__map"
            bounds={bounds}
            dragging={false}
            doubleClickZoom={false}
            scrollWheelZoom={false}
            touchZoom={false}
            boxZoom={false}
            keyboard={false}
            zoomControl={false}
        >
            <BoundsUpdater bounds={bounds}/>
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution={OSM_ATTRIBUTION}
            />
            <Rectangle bounds={bounds} pathOptions={{color: "#22c55e", weight: 2}}/>
            {markers}
        </MapContainer>
    );
}

function BoundsUpdater({bounds}: {bounds: LatLngBoundsExpression}) {
    const map = useMap();
    useEffect(() => {
        map.fitBounds(bounds, {padding: [24, 24]});
    }, [map, bounds]);
    return null;
}
