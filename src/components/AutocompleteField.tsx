import React, {useState} from "react";
import type {GeocodeSuggestion} from "../lib/geocode";

interface AutocompleteFieldProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    ariaLabel: string;
    suggestions: GeocodeSuggestion[];
    noResults: boolean;
    onSelect: (suggestion: GeocodeSuggestion) => void;
    inputRef?: React.RefObject<HTMLInputElement | null>;
    showClear?: boolean;
    onClear?: () => void;
}

export default function AutocompleteField({
    value,
    onChange,
    placeholder,
    ariaLabel,
    suggestions,
    noResults,
    onSelect,
    inputRef,
    showClear,
    onClear,
}: AutocompleteFieldProps) {
    const [focused, setFocused] = useState(false);
    const showSuggestions = focused && (suggestions.length > 0 || noResults);

    return (
        <div className="autocomplete">
            <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                className={`input${showClear ? " input--with-clear" : ""}`}
                inputMode="search"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                aria-label={ariaLabel}
                autoComplete="off"
            />
            {showClear && onClear && (
                <button
                    type="button"
                    className="autocomplete__clear"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={onClear}
                    aria-label={`Clear ${ariaLabel.toLowerCase()}`}
                >
                    &times;
                </button>
            )}
            {showSuggestions && (
                noResults && suggestions.length === 0 ? (
                    <div className="autocomplete__empty" role="status">
                        Location not found
                    </div>
                ) : (
                    <ul className="autocomplete__list" role="listbox" onMouseDown={(e) => e.preventDefault()}>
                        {suggestions.map((suggestion, idx) => (
                            <li key={`${suggestion.lat}-${suggestion.lon}-${idx}`} className="autocomplete__item">
                                <button
                                    type="button"
                                    className="autocomplete__option"
                                    onClick={() => {
                                        onSelect(suggestion);
                                        setFocused(false);
                                    }}
                                >
                                    {suggestion.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                )
            )}
        </div>
    );
}
