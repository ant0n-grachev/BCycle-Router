export interface Station {
    station_id: string;
    name: string;
    lat: number;
    lon: number;
    is_installed: boolean;
    is_renting: boolean;
    is_returning: boolean;
    num_bikes_available: number;
    num_docks_available: number;
}

export interface LatLon {
    lat: number;
    lon: number;
}
