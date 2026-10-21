# Riftbound Heist
Static site: enter a California ZIP, see nearby stores that may carry Riftbound TCG. Leaflet + OpenStreetMap, bundled Census 2023 ZCTA centroids (`public/ca-zips.json`).

## Updating store data
`./scripts/sync-stores.sh [path/to/stores.json]` (default `/workspace/tcg-heist/stores.json`) copies it to `public/stores.json` (falls back to labeled SAMPLE data). Commit and push; Vercel redeploys.

Schema: `{updated, sample?, stores:[{name,address,lat,lng,stockConfirmed,lastSighting:{date,note},events:[{date,name}],confidence,sources:[{label,url,date}]}]}`. Stock shows as "unverified/likely" unless `stockConfirmed` is true AND `lastSighting.date` is set.
