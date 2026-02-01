import React from "react";
import ResultCard from "./ResultCard";
import type {Station} from "../types";
import {fmtMilesFeet} from "../lib/distance";

export interface ResultData {
    pickup: Station;
    dropoff: Station;
    link: string;
    dWalk1Mi: number;
    dBikeMi: number;
    dWalk2Mi: number;
}

export interface NearestData {
    station: Station;
    distanceMi: number;
    link: string;
    fallback: boolean;
}

export interface PlanState {
    loading: boolean;
    error: string | null;
}

export interface NearestState {
    loading: boolean;
    showCard: boolean;
    error: string | null;
}

interface PlanActionsProps {
    result: ResultData | null;
    nearest: NearestData | null;
    planState: PlanState;
    nearestState: NearestState;
    isMobile: boolean;
}

export default function PlanActions({
    result,
    nearest,
    planState,
    nearestState,
    isMobile,
}: PlanActionsProps) {
    return (
        <>
            {planState.loading && <div className="result-card block-gap">Planning your trip...</div>}

            {result && (
                <>
                    <ResultCard
                        className="block-gap"
                        pickup={result.pickup}
                        dropoff={result.dropoff}
                        dWalk1Mi={result.dWalk1Mi}
                        dBikeMi={result.dBikeMi}
                        dWalk2Mi={result.dWalk2Mi}
                    />
                    <a
                        href={result.link}
                        target={isMobile ? "_self" : "_blank"}
                        rel={isMobile ? undefined : "noopener noreferrer"}
                        className="btn btn--lg btn--block block-gap"
                    >
                        Open route in Google Maps
                    </a>
                </>
            )}

            {nearestState.loading && (
                <div className="result-card block-gap">Finding the closest station...</div>
            )}

            {!nearestState.loading && nearestState.error && (
                <div className="result-card block-gap nearest-error">{nearestState.error}</div>
            )}

            {nearestState.showCard && nearest && (
                <div className="result-card block-gap">
                    <strong>Nearest station:</strong> {nearest.station.name} — bikes: {nearest.station.num_bikes_available}
                    <div className="small">
                        {nearest.station.lat.toFixed(5)}, {nearest.station.lon.toFixed(5)} (about {fmtMilesFeet(nearest.distanceMi)} away)
                    </div>
                    {nearest.fallback && (
                        <div className="small">No available bikes nearby; showing the closest station instead.</div>
                    )}
                    <div style={{height: 8}} />
                    <a
                        href={nearest.link}
                        target={isMobile ? "_self" : "_blank"}
                        rel={isMobile ? undefined : "noopener noreferrer"}
                        className="btn btn--md btn--block"
                    >
                        Open route in Google Maps
                    </a>
                </div>
            )}
        </>
    );
}
