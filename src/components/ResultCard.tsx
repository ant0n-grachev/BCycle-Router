import React from "react";
import type {Station} from "../types";
import {fmtMilesFeet} from "../lib/distance";

interface ResultCardProps {
    pickup: Station;
    dropoff: Station;
    dWalk1Mi: number;
    dBikeMi: number;
    dWalk2Mi: number;
    className?: string;
}

export default function ResultCard({
                                       pickup,
                                       dropoff,
                                       dWalk1Mi,
                                       dBikeMi,
                                       dWalk2Mi,
                                       className,
                                   }: ResultCardProps) {
    const classes = ["result-card", className].filter(Boolean).join(" ");

    return (
        <div className={classes}>
            <strong>Pickup:</strong> {pickup.name} — bikes: {pickup.num_bikes_available}
            <div className="small">
                {pickup.lat.toFixed(5)}, {pickup.lon.toFixed(5)} (walk {fmtMilesFeet(dWalk1Mi)})
            </div>

            <div style={{height: 8}}/>

            <strong>Dropoff:</strong> {dropoff.name} — docks: {dropoff.num_docks_available}
            <div className="small">
                {dropoff.lat.toFixed(5)}, {dropoff.lon.toFixed(5)} (walk {fmtMilesFeet(dWalk2Mi)})
            </div>

            <div style={{height: 8}}/>
            <div className="small">Bike segment ~{dBikeMi.toFixed(2)} mi</div>
        </div>
    );
}
