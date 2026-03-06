import {useCallback, useState} from "react";
import type {GeocodeSuggestion} from "../lib/geocode";

export function useDestinationSelection() {
    const [value, setValue] = useState("");
    const [suggestion, setSuggestion] = useState<GeocodeSuggestion | null>(null);

    const handleChange = useCallback((next: string) => {
        setValue(next);
        setSuggestion(null);
    }, []);

    const handleSelect = useCallback((next: GeocodeSuggestion) => {
        setValue(next.label);
        setSuggestion(next);
    }, []);

    const clear = useCallback(() => {
        setValue("");
        setSuggestion(null);
    }, []);

    const trimmed = value.trim();
    const isSelected = Boolean(suggestion && suggestion.label === trimmed);

    const validate = useCallback(() => {
        if (suggestion && suggestion.label === trimmed) {
            return {selection: suggestion, error: null};
        }
        if (!trimmed) {
            return {selection: null, error: "Enter a destination."};
        }
        return {selection: null, error: "Select a destination from the suggestions."};
    }, [suggestion, trimmed]);

    return {
        value,
        setValue: handleChange,
        suggestion,
        select: handleSelect,
        clear,
        isSelected,
        validate,
    };
}
