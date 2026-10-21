# Riftbound Heist
Static site: enter a California ZIP, see nearby stores that may carry Riftbound TCG. Leaflet + OpenStreetMap, bundled Census 2023 ZCTA centroids (`public/ca-zips.json`).

## Updating store data
`./scripts/sync-stores.sh [path/to/stores.json]` (default `/workspace/tcg-heist/stores.json`) copies it to `public/stores.json` (falls back to labeled SAMPLE data). Commit and push; Vercel redeploys.

Schema: Real data (from Scout): `{generated, region, news:[{title,source_url,date}], stores:[{name,address,city,zip,lat,lng,phone,website,riftbound_evidence:[{summary,source_url,date}],confidence}]}`. Null lat/lng falls back to ZIP centroid (approximate) or "location pending".. Stock shows as "unverified/likely" unless `stockConfirmed` is true AND `lastSighting.date` is set.
