# OpenSea Parity Rollout Plan

Date: 2026-04-09

This plan breaks OpenSea-style parity into safe implementation phases.

## Phase 0 - Done In This Pass

- [x] Collection browse controls in UI (search, ownership filter, price range, sorting)
  - File: frontend/src/app/collection/[slug]/page.tsx

## Phase 1 - Protocol + Order Engine

- [ ] Decide protocol path:
  - Option A: Canonical Seaport integration (recommended for strict parity)
  - Option B: Expand MiladyMarketplaceV2 to full Seaport method support
- [ ] Signed order creation and off-chain order storage/indexing schema
- [ ] Full order lifecycle support:
  - validate / cancel / incrementCounter
  - order status and fill tracking in APIs
- [ ] Batch and advanced fulfill methods

## Phase 2 - Indexer + Data Layer

- [ ] Add persistent DB for marketplace data (orders, listings, offers, sales)
- [ ] Build backfill + realtime indexer workers with reorg handling
- [ ] Add query APIs for:
  - global search
  - trait filters
  - sort by price / recency / activity
  - wallet portfolio views

## Phase 3 - Marketplace UX Parity

- [ ] Global search page (collections, tokens, wallets)
- [ ] Advanced collection filters (traits, ranges, sale/listing recency)
- [ ] Collection offer board and trait offers
- [ ] Bulk buy/list/cancel with transaction queue UX
- [ ] Better transaction status and error recovery UX

## Phase 4 - Profile + Trust Layer

- [ ] Profile tabs: owned, listed, offers, activity
- [ ] Favorites/watchlist and notifications
- [ ] Creator verification and collection safety labels
- [ ] Report/moderation endpoints and admin review workflows

## Phase 5 - Analytics + Ranking

- [ ] Rolling windows: 24h / 7d / 30d stats
- [ ] Collection rankings and trends
- [ ] Price and sales charts

## Suggested Delivery Order

1. Protocol decision + order schema
2. Persistent indexer and APIs
3. Search/filter/ranking UI
4. Profile/trust systems
5. Final UX polish and performance
