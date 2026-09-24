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

The request is sent to:

```text
https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=10&addressdetails=1
```

Its cache key is rounded to two decimal places. Requests are debounced for
500 ms, and an eight-second abort timeout is applied when `AbortController` is
available. Successful names are cached for the rounded coordinates so map
movement does not repeatedly hit the service; failures are not cached, so the
same point is retried only after a later application update, not automatically.

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
The request attempts `User-Agent: SunSimulator/1.0`, although browser Fetch
support for overriding `User-Agent` varies. Nominatim's
[public-service policy](https://operations.osmfoundation.org/policies/nominatim/)
requires an identifying HTTP `Referer` or `User-Agent`, visible attribution, and
an absolute maximum of one request per second per application.

### Production request-identity verification

On 2026-09-24, Chromium 151.0.7922.173 loaded the production page at
`https://sunsim.jedarden.com/` and the page's automatic reverse-geocoding
request was observed at the Nominatim endpoint with these request headers:

```text
Referer: https://sunsim.jedarden.com/
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36
```

The attempted `SunSimulator/1.0` value was not present on the wire. The
browser's default `Referer` was instead present, identifies the production
Sun Simulator origin, and is sufficient for the policy's request-identity
requirement independently of the stock browser `User-Agent`. Nominatim returned
HTTP 200 with a JSON response for that observed production request. This is a
point-in-time verification of identity for the deployed origin; a later
deployment or Referrer-Policy change requires repeating it.

The 500 ms debounce and successful-result cache reduce requests but do not
implement an aggregate one-request-per-second limiter or promise a service
quota. A 429 is handled as a recoverable fallback rather than as proof of
compliance. The verified Referer addresses request identity only; it does not
replace the policy's rate, caching, attribution, or service-switching
requirements. Because the shipped client has no runtime service switch or proxy,
the hard-coded public-instance integration is not, by itself, a complete
Nominatim-policy configuration. Deployments that cannot meet the policy need a
switchable service configuration or proxy.

## Offline behavior

If the page and its vendored scripts have already loaded, solar calculations,
map interaction, and controls continue when Nominatim is unreachable. A name
already cached for the rounded coordinates remains in memory; an uncached lookup
uses **Custom Location** and is not retried until a later application update.
Browser geolocation may work without the internet when the platform has an
offline positioning source, but that is outside this application's control. The
app has no service worker or persistent geocoding cache, so a cold start or
refresh while offline is not supported.

## Verification

`tests/geolocation-fallbacks.spec.js` mocks the browser Geolocation API and
Nominatim responses. It covers permission denial, unavailable positions,
abort-error handling, rate limiting, and no-result responses, asserting that the
status, attribution, fallback name, and normal controls remain usable in every
case. It does not verify the eight-second timer, operation without
`AbortController`, an effective on-wire `User-Agent`, or the public service's
rate-limit requirements. The production request-identity verification above is
an out-of-band check of the deployed origin rather than part of the mocked test
suite.
