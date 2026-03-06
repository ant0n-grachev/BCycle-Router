import {useCallback, useMemo, useState} from "react";
import type {LatLon} from "../types";
import type {GeocodeSuggestion} from "../lib/geocode";

interface UseOriginPointParams {
    mode: "device" | "manual";
    deviceOrigin: LatLon | null;
    deviceLocked: boolean;
    outsideMessage: string;
}

export function useOriginPoint({
    mode,
    deviceOrigin,
    deviceLocked,
    outsideMessage,
}: UseOriginPointParams) {
    const [manualText, setManualText] = useState("");
    const [suggestion, setSuggestion] = useState<GeocodeSuggestion | null>(null);
    const trimmed = manualText.trim();
    const originPoint = useMemo<LatLon | null>(() => {
        if (mode === "manual") {
            if (!suggestion || suggestion.label !== trimmed) return null;
            return {lat: suggestion.lat, lon: suggestion.lon};
        }
        if (!deviceOrigin || deviceLocked) return null;
        return deviceOrigin;
    }, [mode, suggestion, trimmed, deviceOrigin, deviceLocked]);

    const validate = useCallback(
        ({forNearest = false}: {forNearest?: boolean} = {}) => {
            if (originPoint) {
                return {point: originPoint, error: null};
            }

            if (mode === "manual") {
                if (!trimmed) {
                    return {point: null, error: forNearest ? null : "Enter a starting location."};
                }
                if (!suggestion || suggestion.label !== trimmed) {
                    return {
                        point: null,
                        error: "Select a starting location from the suggestions.",
                    };
                }
            } else if (deviceLocked) {
                return {point: null, error: outsideMessage};
            } else if (!deviceOrigin) {
                return {
                    point: null,
                    error: "Allow location access first or enter a starting location manually.",
                };
            }

            return {point: null, error: null};
        },
        [originPoint, mode, trimmed, suggestion, deviceLocked, deviceOrigin, outsideMessage]
    );

    const handleManualChange = useCallback((value: string) => {
        setManualText(value);
        setSuggestion(null);
    }, []);

    const handleSuggestionSelect = useCallback((value: GeocodeSuggestion) => {
        setManualText(value.label);
        setSuggestion(value);
    }, []);

    const clearManual = useCallback(() => {
        setManualText("");
        setSuggestion(null);
    }, []);

    return {
        manualText,
        setManualText: handleManualChange,
        selectSuggestion: handleSuggestionSelect,
        clearManual,
        originPoint,
        validate,
    };
}
