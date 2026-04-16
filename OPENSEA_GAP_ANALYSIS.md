# OpenSea / Seaport Gap Analysis

Date: 2026-04-08

## Current ABI vs Seaport Interface

Current marketplace ABI in frontend/src/lib/abis.ts supports:
- getListing
- getOffer
- createListing
- cancelListing
- buyListing
- makeOffer
- cancelOffer
- acceptOffer

OpenSea Seaport interface includes (core):
- fulfillBasicOrder
- fulfillOrder
- fulfillAdvancedOrder
- fulfillAvailableOrders
- fulfillAvailableAdvancedOrders
- matchOrders
- matchAdvancedOrders
- cancel
- validate
- incrementCounter
- getOrderHash
- getOrderStatus
- getCounter
- information
- name

## Missing Functionality in Current Contract

The current ABI does not expose Seaport order primitives:
- No order hash/status lifecycle tracking
- No offerer counter for bulk invalidation
- No generic signed order fulfillment
- No order validation pathway
- No batched fulfillment primitives

## Added Upgrade Path

A new contract was added at contracts/src/MiladyMarketplaceV2.sol.

This V2 contract now provides Seaport-like capabilities:
- name
- information
- getCounter
- incrementCounter
- getOrderHash
- getOrderStatus
- cancel
- validate
- fulfillBasicOrder
- fulfillOrder
- fulfillAdvancedOrder (full fills only)

Exposed but intentionally unsupported in this Seaport-lite contract (revert with NOT_IMPLEMENTED_IN_LITE):
- fulfillAvailableOrders
- fulfillAvailableAdvancedOrders
- matchOrders
- matchAdvancedOrders

## Important Notes

- This is Seaport-lite compatibility, not full Seaport parity.
- Partial fills are intentionally restricted in this V2 implementation.
- Criteria resolvers and conduit routing are accepted in signatures but not fully enforced.
- Batch and matching engines are deliberately stubbed to avoid unsafe behavior.
- For full OpenSea parity, use canonical Seaport contracts directly.

## Deployment Recommendation

If your goal is OpenSea-style UX but controlled protocol logic:
1. Deploy MiladyMarketplaceV2.sol via Remix.
2. Update frontend market contract address in env and collection registry.
3. Keep current UI methods for listing/offer while gradually migrating to signed-order paths.

If your goal is strict protocol parity:
1. Integrate canonical Seaport contract on your target chain.
2. Replace frontend actions with Seaport order construction + fulfill calls.
3. Keep your backend indexer source-tagging and collection aggregation as-is.
