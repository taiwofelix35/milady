# Architecture

## System Overview

Milady On Tempo is split into three core layers:

1. Frontend application layer (Next.js)
2. Backend service layer (Express + viem)
3. On-chain contracts layer (Launchpad + Marketplace)

## Frontend Layer

Primary responsibilities:

- Wallet UX and transaction actions
- Collection and NFT discovery pages
- Search and activity surfaces
- Launchpad admin workflows
- Shared collection hydration and merge strategy

Primary user routes:

- Home
- Explore
- Search
- Collection
- NFT detail
- Profile
- Activity
- Launchpad

## Backend Layer

Primary responsibilities:

- Resolve listing state across market sources
- Aggregate and paginate indexed events
- Provide search endpoint for token, wallet, tx, and text queries
- Expose Launchpad helper endpoints
- Maintain whitelist + merkle utilities
- Maintain shared collection registry for globally visible collections

Backend persistence:

- whitelist-db.json
- collections-db.json

## Contracts Layer

### Launchpad Contract

- Deploy collection
- Configure mint phases
- Reserve mint
- Register collection to marketplace

### Marketplace Contracts

- Listing creation and cancellation
- Buy execution
- Offer creation and acceptance
- Event emission for downstream indexing

## Runtime Data Pipelines

### Launch and Discovery Pipeline

1. Creator deploys collection in Launchpad.
2. Collection metadata is published to shared registry.
3. Frontend hydrates shared registry and merges with static collection list.
4. Home/Explore/Profile render globally visible collections.

### Trading Pipeline

1. User lists or offers on chain.
2. Backend resolves listing reads and indexes events.
3. Frontend consumes listing/activity/search APIs.
4. UI updates with source labels and transaction links.

## Reliability Model

- Listing reads support preferred marketplace contract targeting.
- Activity endpoints support pagination to prevent oversized payloads.
- Search endpoint classifies query type and returns bounded result windows.
- Shared registry allows fast global visibility without redeploying frontend.

## Known Constraints

- Event indexing depth depends on configured lookback and RPC behavior.
- Global collection metadata quality depends on publish payload completeness.
- Any mint timeline changes require synchronized docs + phase updates.
