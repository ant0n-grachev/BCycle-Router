import {pickNearestStation} from "./stations";
import type {Station} from "../types";

function makeStation(overrides: Partial<Station>): Station {
    return {
        station_id: "id",
        name: "Station",
        lat: 43.0731,
        lon: -89.4012,
        is_installed: true,
        is_renting: true,
        is_returning: true,
        num_bikes_available: 0,
        num_docks_available: 0,
        ...overrides,
    };
}

describe("pickNearestStation", () => {
    it("returns the closest station that matches predicate and operational filters", () => {
        const stations: Station[] = [
            makeStation({
                station_id: "near-no-bikes",
                lat: 43.0732,
                lon: -89.4012,
                num_bikes_available: 0,
            }),
            makeStation({
                station_id: "far-with-bikes",
                lat: 43.08,
                lon: -89.41,
                num_bikes_available: 5,
            }),
            makeStation({
                station_id: "near-with-bikes",
                lat: 43.0735,
                lon: -89.4013,
                num_bikes_available: 3,
            }),
        ];

        const nearest = pickNearestStation(
            stations,
            {lat: 43.0731, lon: -89.4012},
            (station) => station.num_bikes_available > 0
        );

        expect(nearest?.station_id).toBe("near-with-bikes");
    });

    it("allows opting out of returning/renting requirements", () => {
        const stations: Station[] = [
            makeStation({
                station_id: "closed-returning",
                is_returning: false,
                num_docks_available: 8,
                lat: 43.0732,
                lon: -89.4012,
            }),
            makeStation({
                station_id: "open-returning",
                is_returning: true,
                num_docks_available: 8,
                lat: 43.09,
                lon: -89.44,
            }),
        ];

        const nearest = pickNearestStation(
            stations,
            {lat: 43.0731, lon: -89.4012},
            (station) => station.num_docks_available > 0,
            {requireReturning: false}
        );

        expect(nearest?.station_id).toBe("closed-returning");
    });

    it("returns null when no station matches", () => {
        const stations: Station[] = [
            makeStation({station_id: "one", is_installed: false, num_bikes_available: 9}),
            makeStation({station_id: "two", is_renting: false, num_bikes_available: 9}),
        ];

        const nearest = pickNearestStation(
            stations,
            {lat: 43.0731, lon: -89.4012},
            (station) => station.num_bikes_available > 0
        );

        expect(nearest).toBeNull();
    });
});
