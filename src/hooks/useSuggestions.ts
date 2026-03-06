import {useCallback, useEffect, useRef, useState} from "react";
import type {GeocodeSuggestion} from "../lib/geocode";
import {suggestNominatim} from "../lib/geocode";
import type {Bounds} from "../lib/bounds";

interface UseSuggestionsOptions {
    enabled: boolean;
    bounds: Bounds | null;
    minLength?: number;
}

export function useSuggestions(
    query: string,
    {enabled, bounds, minLength = 3}: UseSuggestionsOptions
): {
    suggestions: GeocodeSuggestion[];
    noResults: boolean;
    clear: () => void;
} {
    const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
    const [noResults, setNoResults] = useState(false);
    const seqRef = useRef(0);

    useEffect(() => {
        const seq = ++seqRef.current;

        if (!enabled) {
            if (seqRef.current === seq) {
                setSuggestions([]);
                setNoResults(false);
            }
            return;
        }

        const trimmed = query.trim();
        if (!trimmed || (trimmed.length < minLength && !trimmed.includes(","))) {
            setSuggestions([]);
            setNoResults(false);
            return;
        }

        setNoResults(false);
        const controller = new AbortController();
        const handle = window.setTimeout(() => {
            suggestNominatim(trimmed, {
                bounds,
                limit: 5,
                signal: controller.signal,
            })
                .then((next) => {
                    if (seqRef.current === seq) {
                        setSuggestions(next);
                        setNoResults(next.length === 0);
                    }
                })
                .catch((error: unknown) => {
                    if (error instanceof Error && error.name === "AbortError") {
                        return;
                    }
                    if (seqRef.current === seq) {
                        setSuggestions([]);
                        setNoResults(false);
                    }
                });
        }, 200);

        return () => {
            controller.abort();
            window.clearTimeout(handle);
        };
    }, [query, enabled, bounds, minLength]);

    const clear = useCallback(() => {
        setSuggestions([]);
        setNoResults(false);
    }, []);

    return {suggestions, noResults, clear};
}
