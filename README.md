# 🚲 Madison BCycle Router

Madison BCycle Router is a single-page React application that helps riders plan a seamless bike-share trip across Madison, Wisconsin. The app automatically finds the closest station with an available bike near the rider, locates a dock near the destination, and links out to Google Maps with the combined walking and biking directions.

## Key features
- **Location-aware planning** – Requests the rider's precise location through the browser's Geolocation API to anchor the starting point of the trip.
- **Flexible destinations** – Accepts either a street address or explicit latitude/longitude coordinates and geocodes them against OpenStreetMap's Nominatim service.
- **Live BCycle availability** – Pulls station information and status in real time from the Madison BCycle GBFS feeds to ensure recommended stations support rentals and returns.
- **Optimized routing** – Calculates walking and biking segments using the haversine formula, surfaces the total distances for each leg, and generates a multi-stop Google Maps route for turn-by-turn navigation.
- **Responsive UI** – Presents a clean card-based interface with clear alerts and distance breakdowns, adapting button behavior for mobile users opening Google Maps.

## Tech stack
- **Framework:** React 19 with TypeScript.
- **Styling:** Custom CSS for layout, typography, and interactive states.
- **Data fetching:** Browser Fetch API for GBFS feeds and Nominatim, with lightweight client-side helpers for bounds checks and distance math.

## Getting started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Launch the development server:
   ```bash
   npm start
   ```
3. Open `http://localhost:3000` in a browser that supports the Geolocation API. Allow location access when prompted to see nearby stations.

## Data sources
- [Madison BCycle GBFS](https://gbfs.bcycle.com/bcycle_madison/station_information.json): real-time station information and availability.
- [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/): address geocoding with Madison query biasing.
- [Google Maps Directions](https://www.google.com/maps/dir/): multi-stop navigation handoff for biking and walking legs.
