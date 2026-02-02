import React from "react";
import {CircleMarker} from "react-leaflet";
import type {Station} from "../types";

export default function StationMarker({station}: {station: Station}) {
    const open = station.is_renting || station.is_returning;
    const color = open ? "#3b82f6" : "#dc2626";
    return (
        <CircleMarker
            center={[station.lat, station.lon]}
            radius={1}
            pathOptions={{color, fillColor: color, fillOpacity: 1, weight: 1}}
        />
    );
}
