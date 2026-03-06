import React from "react";

interface OriginOptionsProps {
    mode: "device" | "manual";
    disabled: boolean;
    status: string;
    statusHasError: boolean;
    onModeChange: (mode: "device" | "manual") => void;
    manualField: React.ReactNode;
}

export default function OriginOptions({
    mode,
    disabled,
    status,
    statusHasError,
    onModeChange,
    manualField,
}: OriginOptionsProps) {
    return (
        <div className="origin-options">
            <label
                className={`origin-option${disabled ? " origin-option--disabled" : ""}`}
                aria-disabled={disabled}
            >
                <input
                    type="radio"
                    name="origin-mode"
                    value="device"
                    checked={mode === "device"}
                    onChange={() => onModeChange("device")}
                    disabled={disabled}
                />
                <span className="origin-option__body">
                    <span className="origin-option__title">Use my current location</span>
                    <span
                        className={`origin-option__status${
                            statusHasError ? " origin-option__status--error" : ""
                        }`}
                    >
                        {status}
                    </span>
                </span>
            </label>

            <label className="origin-option">
                <input
                    type="radio"
                    name="origin-mode"
                    value="manual"
                    checked={mode === "manual"}
                    onChange={() => onModeChange("manual")}
                />
                <span className="origin-option__body">
                    <span className="origin-option__title">Enter a location manually</span>
                </span>
            </label>

            {mode === "manual" && <div className="origin-input-wrapper">{manualField}</div>}
        </div>
    );
}
