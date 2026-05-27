# 🚲 BRouter

BRouter is a single-page React application that helps riders plan a complete Madison BCycle trip from start to finish.

Instead of manually checking bike-share stations, dock availability, and navigation separately, BRouter finds a nearby station with available bikes, finds a return station near the rider’s destination with open docks, and opens the full route in Google Maps.

<p align="center">
  <video
    src="https://github.com/user-attachments/assets/e3689c4c-f612-4196-b2c7-ded43c66002c"
    width="960"
    height="540"
    controls
    muted
    loop
    playsinline
  >
    Your browser does not support the video tag.
  </video>
</p>

## Problem

Planning a bike-share trip usually requires several separate steps:

1. Find a station near your current location.
2. Check whether that station has available bikes.
3. Find a station near your destination.
4. Check whether that station has open docks.
5. Open a separate navigation app and build the route manually.

BRouter combines those steps into one flow.

## What it does

BRouter takes the rider’s current location and destination, then recommends a practical Madison BCycle trip:

- Walk from the rider’s current location to a nearby station with available bikes.
- Bike from that pickup station to a station near the destination with open docks.
- Walk from the return station to the final destination.
- Open the full multi-stop route in Google Maps for turn-by-turn navigation.

## Key features

- **Location-aware trip planning**  
  Uses the browser Geolocation API to detect the rider’s current location and find nearby Madison BCycle stations.

- **Flexible destination input**  
  Supports both street addresses and latitude/longitude coordinates.

- **Live BCycle station data**  
  Fetches real-time Madison BCycle station information and availability from public GBFS feeds.

- **Station-aware recommendations**  
  Selects pickup stations with available bikes and return stations with available docks.

- **Distance breakdowns**  
  Calculates and displays walking and biking distances for each part of the trip.

- **Google Maps handoff**  
  Generates a multi-stop Google Maps route so riders can continue with familiar turn-by-turn navigation.

- **Responsive interface**  
  Uses a clean card-based layout that works across desktop and mobile screens.

## Tech stack

- **Frontend:** React 19, TypeScript
- **Styling:** Custom CSS
- **Data fetching:** Browser Fetch API
- **Geocoding:** OpenStreetMap Nominatim
- **Bike-share data:** Madison BCycle GBFS feeds
- **Routing handoff:** Google Maps Directions
- **Distance calculations:** Haversine formula

## Data sources

BRouter uses public data sources:

- [Madison BCycle GBFS station information](https://gbfs.bcycle.com/bcycle_madison/station_information.json)
- Madison BCycle GBFS station status feed
- [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/) for address geocoding
- [Google Maps Directions](https://www.google.com/maps/dir/) for navigation handoff

## Getting started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm start
```

Open the app in your browser:

```bash
http://localhost:3000
```

Allow location access when prompted so the app can find nearby Madison BCycle stations.

## Testing mode

For demo or testing purposes, run the following command in the browser console:

```javascript
brouterShowcase()
```

This simulates station availability so the app can be tested even when live stations have limited bikes or docks.

Refresh the page to return to live BCycle data.

## Current limitations

BRouter is a prototype and does not handle:

- BCycle user accounts
- Payments
- Bike unlocking
- Pass purchases
- Real-time bike-lane-aware routing
- Battery level filtering
- Accessibility or helmet/safety guidance

The app focuses only on trip planning and navigation handoff.

## Future improvements

Potential next steps include:

- Add safer bike-lane-aware routing.
- Filter stations by e-bike availability or battery level if supported by the data feed.
- Predict future bike and dock availability.
- Add support for BCycle app deep links if available.
- Improve mobile UX for visitors and first-time riders.
- Add support for other BCycle cities using GBFS feeds.

## Project purpose

This project was built as a portfolio project to explore how public bike-share data can improve urban trip planning. It is an independent prototype and is not affiliated with Madison BCycle or BCycle.
