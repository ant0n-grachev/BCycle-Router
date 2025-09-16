import React from "react";
import {Station} from "../types";
import {fmtMilesFeet} from "../lib/distance";

export default function ResultCard(props: {
    pickup: Station;
    dropoff: Station;
    dWalk1Mi: number;
    dBikeMi: number;
    dWalk2Mi: number;
}) {
    const card: React.CSSProperties = {
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 16,
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
    };
    const small: React.CSSProperties = {fontSize: 12, color: "#64748b"};

    return (
        <div style={{...card, boxShadow: "none"}}>
            <strong>Pickup:</strong> {props.pickup.name} — bikes: {props.pickup.num_bikes_available}
            <div style={small}>
                {props.pickup.lat.toFixed(5)}, {props.pickup.lon.toFixed(5)} (walk {fmtMilesFeet(props.dWalk1Mi)})
            </div>

            <div style={{height: 8}}/>

            <strong>Dropoff:</strong> {props.dropoff.name} — docks: {props.dropoff.num_docks_available}
            <div style={small}>
                {props.dropoff.lat.toFixed(5)}, {props.dropoff.lon.toFixed(5)} (walk {fmtMilesFeet(props.dWalk2Mi)})
            </div>

            <div style={{height: 8}}/>
            <div style={small}>Bike segment ~{props.dBikeMi.toFixed(2)} mi</div>
        </div>
    );
}
