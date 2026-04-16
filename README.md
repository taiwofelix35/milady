# milady

## Quick Start From Root

1. Frontend dev:
	npm run dev
2. Backend dev:
	npm run dev:backend
3. Frontend + backend together:
	npm run dev:all
3. Frontend production build:
	npm run build

Note: if ports are already in use, frontend/backend will auto-pick another port.

## Frontend

1. Install dependencies:
	npm --prefix frontend install
2. Configure env values in frontend (recommended):
	NEXT_PUBLIC_NFT_CONTRACT
	NEXT_PUBLIC_MARKETPLACE_CONTRACT
	NEXT_PUBLIC_LAUNCHPAD_CONTRACT
	NEXT_PUBLIC_BACKEND_URL
	NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
   If NEXT_PUBLIC_BACKEND_URL is not set, frontend auto-detects backend on localhost ports 4000-4005.
3. Start dev server:
	npm --prefix frontend run dev

Collection registry from your V1 is now centralized in frontend/src/lib/collections.ts.
You can add/update collection nft contract, market contract, metadata base, and image URI templates there.

Launchpad deploy visibility:
- Newly deployed collections appear in Launchpad page under "My Deployed Collections".
- They now auto-appear in this browser session on Home/Explore/Profile after Launchpad fetches your creator collections.
- They are now also published to backend shared collection registry so other users can load them automatically.
- You can still add them to frontend/src/lib/collections.ts for fully curated static metadata.
- For best global presentation, use Launchpad "Publish Collection Metadata" to set name, description, supply, cover image, image template, extension, and start token ID.

Collection page now includes OpenSea-style browse controls per page:
- token ID search
- ownership filter (all/owned/not-owned)
- min/max listed price filters
- sort by token ID or listed price

Explore page:
- Route: /explore
- Cross-collection listed NFT discovery
- Search/filter/sort controls across tracked collections

Search page:
- Route: /search?q=...
- Query marketplace index by token ID, wallet, tx hash, or text
- Shows matching listings and matching events
- Includes event pagination controls
- Navbar includes quick search input that routes to /search?q=...

Mobile UX notes:
- Navbar now includes a mobile menu toggle
- Mobile menu includes quick search, page links, and wallet controls
- Mobile bottom navigation is available for Home/Explore/Search/Activity/Profile
- Search page now has an in-page search form (not URL-edit only)

Docs site:
- External docs bundle is provided under docs-site/ for separate hosting/upload.
- Sections: Overview, Mint Docs, Architecture, API Reference
- Mint docs currently define supply 1,111 and mint price 3 MILADY

Profile page:
- Route: /profile/:address
- Tabs: Owned, Listed, Offers, Activity
- Owned/Listed filters: search, collection filter, sort
- Offers/Activity tabs show wallet-matched marketplace events from backend index window

## Backend

1. Install dependencies:
	npm --prefix backend install
2. Create backend env file:
	copy backend/.env.example backend/.env
3. Fill contract addresses and RPC in backend/.env.
	Optional multi-market tracking:
	STABLEWHEL_MARKETPLACE_CONTRACT
	TEMPPUNKS_MARKETPLACE_CONTRACT
	TEMPPUNKS_MARKETPLACE_V4_CONTRACT
	TEMPPUNKS_MARKETPLACE_V2_CONTRACT
4. Start backend dev server:
	npm --prefix backend run dev

## Backend API

- GET /health
- GET /config
- GET /collections
	returns globally published marketplace collection registry entries
- POST /collections/upsert
	body example: { "nftContract": "0x...", "marketContract": "0x...", "name": "..." }
- GET /marketplace/listing/:tokenId
	optional query: ?nft=0xCollectionAddress
	optional query: &market=0xMarketplaceAddress (prioritize specific marketplace contract)
	returns source/sourceLabel when listing is found on tracked marketplaces
- GET /marketplace/listings?tokenIds=1,2,3&nft=0xCollectionAddress
	batch listing lookup (up to 200 token IDs per request)
	optional query: &market=0xMarketplaceAddress (prioritize specific marketplace contract)
	optional query: &infer=true to allow inferred listings from event logs
- GET /marketplace/offer/:tokenId/:offerer
- GET /marketplace/activity/:tokenId?fromBlock=...
	optional query: &nft=0xCollectionAddress
- GET /marketplace/activity?limit=150&fromBlock=...
	optional query: &nft=0xCollectionAddress
- GET /marketplace/search?q=...&limit=100
	searches indexed marketplace events by token ID, wallet address, tx hash, or text
	optional query: &nft=0xCollectionAddress&fromBlock=...&offset=0
- GET /marketplace/collection-stats?nft=0xCollectionAddress&supply=3333&startTokenId=1&scan=350

TempPunks contracts discovered from production bundle:
- V5: 0x99398f5236520261A659114401473a561fCe6409
- V4: 0xCD4139bD81795515b3d4b723C1a6343F3F0B3977
- V2: 0x1fa92D02FE7bDE9DbDFF1151f7d222a9958E2025
- GET /launchpad/project/:collection
- GET /launchpad/creator/:creator

## Whitelist + Merkle API

- GET /wl/:collection/:phaseId
- POST /wl/:collection/:phaseId/add
	body: { "addresses": ["0x...", "0x..."] }
- POST /wl/:collection/:phaseId/remove
	body: { "addresses": ["0x...", "0x..."] }
- POST /wl/:collection/:phaseId/reset
- GET /wl/:collection/:phaseId/proof/:account
- POST /wl/:collection/:phaseId/import-csv
	body: { "csv": "0xabc...\n0xdef..." }
- GET /wl/:collection/:phaseId/sync-payload
	returns calldata for creatorSetPhaseMerkleRoot(collection, phaseId, merkleRoot)