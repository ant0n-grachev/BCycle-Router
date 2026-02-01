import React from "react";
import OriginOptions from "./OriginOptions";

interface OriginSectionProps {
    mode: "device" | "manual";
    disabled: boolean;
    status: string;
    statusHasError: boolean;
    onModeChange: (mode: "device" | "manual") => void;
    manualField: React.ReactNode;
}

export default function OriginSection(props: OriginSectionProps) {
    return <OriginOptions {...props}/>;
}
