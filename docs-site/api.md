# API Reference

This API layer powers listing reads, event search, launchpad support, allowlist management, and shared collection discovery.

## Base Service

- Service: Express backend
- Content type: application/json
- Typical local base URL: http://localhost:4000

## Health and Config

### GET /health

Returns service liveness and RPC target.

### GET /config

Returns configured marketplace sources, launchpad contract, and default NFT contract.

## Marketplace Endpoints

### GET /marketplace/listing/:tokenId

Purpose:

- Resolve best active listing for one token.

Query:

- nft (optional): collection contract
- market (optional): preferred marketplace contract to prioritize

### GET /marketplace/listings

Purpose:

- Batch listing resolution for multiple token IDs.

Query:

- tokenIds (required): comma-separated integer IDs, max 200
- nft (optional): collection contract
- market (optional): preferred marketplace contract
- infer (optional): true to infer from logs when direct listing read is inactive

### GET /marketplace/activity/:tokenId

Purpose:

- Token-scoped historical marketplace events.

Query:

- nft (optional): collection contract
- fromBlock (optional): block lower bound

### GET /marketplace/activity

Purpose:

- Collection or global activity feed with pagination.

Query:

- nft (optional)
- type (optional): ItemListed, ItemSold, OfferMade
- fromBlock (optional)
- limit (optional)
- offset (optional)

### GET /marketplace/search

Purpose:

- Unified search over indexed events and token listing context.

Query:

- q (required): token ID, wallet, tx hash, or text
- nft (optional)
- fromBlock (optional)
- limit (optional)
- offset (optional)

Response highlights:

- queryType: tx, address, token, text
- totalEvents, count, hasNext
- events page
- listings array for token-oriented matches

## Launchpad Endpoints

### GET /launchpad/project/:collection

Returns project metadata and registration status when available.

### GET /launchpad/creator/:creator

Returns creator deployed collections.

## Shared Collection Registry

### GET /collections

Returns globally published collection metadata used by discovery pages.

### POST /collections/upsert

Upserts one collection record into shared registry.

Recommended body fields:

- nftContract
- marketContract
- name
- description
- supply
- coverImage
- imageUrlTemplate
- imageExtension
- startTokenId
- explorer

## Whitelist and Merkle Endpoints

### GET /wl/:collection/:phaseId

Fetch allowlist snapshot and merkle root.

### POST /wl/:collection/:phaseId/add

Add addresses to allowlist.

### POST /wl/:collection/:phaseId/remove

Remove addresses from allowlist.

### POST /wl/:collection/:phaseId/reset

Clear allowlist entries for phase.

### GET /wl/:collection/:phaseId/proof/:account

Fetch merkle proof for one account.

### POST /wl/:collection/:phaseId/import-csv

Import addresses from CSV text payload.

### GET /wl/:collection/:phaseId/sync-payload

Generate calldata payload for on-chain merkle root update.
