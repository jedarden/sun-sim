# Geolocation and reverse-geocoding failure behavior

This page uses the browser Geolocation API for the **Use My Location** button and
Nominatim for optional reverse geocoding. Location services are enhancements:
map selection, date navigation, the timeline, animation, and all solar
calculations must continue to work when either service fails.

## User-visible contract

- Location errors are shown in the inline `#location-status` region. The region
  uses `role="status"` and `aria-live="polite"`, so errors are announced without
  a blocking dialog.
- A failed GPS request does not change the selected coordinates. The current
  map location, date, timeline, and sun information remain usable, and the
  button becomes enabled again for another attempt.
- A failed reverse-geocoding request does not change the map center or solar
  calculations. The coordinates continue to update and the name falls back to
  **Custom Location**.
- A successful reverse-geocoding request replaces the fallback and clears the
  status message.
- The panel always displays attribution for Nominatim and OpenStreetMap
  contributors, including when the lookup falls back.

## Geolocation outcomes

| Outcome | User-facing behavior | Fallback |
| --- | --- | --- |
| Permission denied | Show `Location permission denied` and explain how to enable browser location access. | Keep the existing map location and leave the GPS button enabled. |
| Position unavailable | Show `Location unavailable` and direct the user to the map. | Keep the existing map location and leave the GPS button enabled. |
| Geolocation timeout | Show `Location request timed out` and direct the user to the map. | Keep the existing map location and leave the GPS button enabled. |
| Unsupported or synchronous geolocation error | Show an inline unavailable message; do not use `alert()`. | Keep the existing map location and leave the GPS button enabled. |
| Valid coordinates | Center the map, update coordinates, and continue calculating the sun. | Not applicable. |

The GPS request uses `enableHighAccuracy: true`, a ten-second browser timeout,
and `maximumAge: 0`. A denial or unavailable result is not retried
automatically, so the user remains in control of the next attempt.

## Reverse-geocoding outcomes

The request is sent to the Nominatim reverse endpoint with a cache key rounded
to two decimal places. Requests are debounced, and each request has an
eight-second abort timeout. Successful names are cached for the rounded
coordinates so map movement does not repeatedly hit the service; failures are
not cached, so the same point can be retried.

| Nominatim outcome | Status text | Name fallback |
| --- | --- | --- |
| HTTP 429 | `Location name lookup is temporarily rate limited` | **Custom Location** |
| HTTP 204 or 404 | `No place name was found` | **Custom Location** |
| HTTP 2xx with no supported address field | `No place name was found` | **Custom Location** |
| Abort caused by the eight-second timeout | `Location name lookup timed out` | **Custom Location** |
| Network error or other non-success response | `Location name lookup is unavailable` | **Custom Location** |
| Supported city, town, village, hamlet, municipality, county, state, or country field | Clear the status after displaying the name | Displayed name |

The name lookup is deliberately optional. A failure never disables the map,
GPS button, date picker, timeline, animation controls, or solar-information
panel. Users can always select a different map point and retry either service.

## Attribution and request policy

Reverse-geocoded names are provided by
[Nominatim](https://nominatim.openstreetmap.org/), and the location panel links
to the [OpenStreetMap contributors' copyright notice](https://www.openstreetmap.org/copyright).
The request identifies the application with the existing
`SunSimulator/1.0` user-agent value. The service may impose rate limits; a 429 is
handled as a recoverable fallback rather than as an application error. The
client-side debounce and cache reduce unnecessary requests, but they do not
promise a service quota or bypass a server-side limit.

## Verification

`tests/geolocation-fallbacks.spec.js` mocks the browser Geolocation API and
Nominatim responses. It covers permission denial, unavailable positions,
timeout, rate limiting, and no-result responses, asserting that the status,
attribution, fallback name, and normal controls remain usable in every case.
