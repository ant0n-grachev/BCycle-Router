import type {Station} from "../types";
import {shouldTreatSystemAsClosed} from "./gbfs";

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

describe("shouldTreatSystemAsClosed", () => {
    it("treats the system as closed when no rentable installed bikes are available", () => {
        const stations: Station[] = [
            makeStation({station_id: "renting-zero-a"}),
            makeStation({station_id: "renting-zero-b", num_docks_available: 4}),
            makeStation({
                station_id: "not-renting-with-bikes",
                is_renting: false,
                num_bikes_available: 7,
            }),
        ];

        expect(shouldTreatSystemAsClosed(stations)).toBe(true);
    });

    it("keeps the system open when at least one installed renting station has a bike", () => {
        const stations: Station[] = [
            makeStation({station_id: "renting-zero"}),
            makeStation({station_id: "renting-one", num_bikes_available: 1}),
            makeStation({
                station_id: "uninstalled-with-bikes",
                is_installed: false,
                num_bikes_available: 10,
            }),
        ];

        expect(shouldTreatSystemAsClosed(stations)).toBe(false);
    });

    it("still treats the system as closed when most installed stations are not operational", () => {
        const stations: Station[] = [
            makeStation({station_id: "open", num_bikes_available: 5}),
            ...Array.from({length: 10}, (_, index) =>
                makeStation({
                    station_id: `closed-${index}`,
                    is_renting: false,
                    is_returning: false,
                })
            ),
        ];

        expect(shouldTreatSystemAsClosed(stations)).toBe(true);
    });
});
