// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title MiladyMarketplace
 * @notice OpenSea-compatible NFT marketplace supporting:
 *   - Fixed-price listings (native currency or ERC-20)
 *   - Offers (ERC-20 bids)
 *   - EIP-2981 royalty enforcement
 *   - Listing / offer cancellation
 *   - Protocol fee (configurable, up to 5%)
 */
contract MiladyMarketplace is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── Constants ───────────────────────────────────────────────────────────

    uint256 public constant MAX_FEE_BPS = 500; // 5%
    uint256 public constant BASIS_POINTS = 10_000;

    // ─── State ───────────────────────────────────────────────────────────────

    /// @notice Protocol fee in basis points
    uint256 public feeBps;

    /// @notice Protocol fee recipient
    address public feeRecipient;

    /// @notice Global listing nonce per seller (invalidates all prior listings on increment)
    mapping(address => uint256) public sellerNonce;

    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;         // in paymentToken (or native if paymentToken == address(0))
        address paymentToken;  // address(0) = native currency
        uint256 expiry;        // 0 = no expiry
        bool active;
    }

    struct Offer {
        address buyer;
        address nftContract;
        uint256 tokenId;
        uint256 amount;        // in paymentToken
        address paymentToken;
        uint256 expiry;
        bool active;
    }

    /// @notice listingId => Listing
    mapping(bytes32 => Listing) public listings;

    /// @notice offerId => Offer
    mapping(bytes32 => Offer) public offers;

    // ─── Events ──────────────────────────────────────────────────────────────

    event Listed(
        bytes32 indexed listingId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 price,
        address paymentToken,
        uint256 expiry
    );

    event ListingCancelled(bytes32 indexed listingId);

    event Sale(
        bytes32 indexed listingId,
        address indexed seller,
        address indexed buyer,
        address nftContract,
        uint256 tokenId,
        uint256 price,
        address paymentToken
    );

    event OfferMade(
        bytes32 indexed offerId,
        address indexed buyer,
        address indexed nftContract,
        uint256 tokenId,
        uint256 amount,
        address paymentToken,
        uint256 expiry
    );

    event OfferCancelled(bytes32 indexed offerId);

    event OfferAccepted(
        bytes32 indexed offerId,
        address indexed seller,
        address indexed buyer,
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        address paymentToken
    );

    event FeeUpdated(uint256 newFeeBps, address newFeeRecipient);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address feeRecipient_, uint256 feeBps_) Ownable(msg.sender) {
        require(feeBps_ <= MAX_FEE_BPS, "Marketplace: fee too high");
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
    }

    // ─── Listing ─────────────────────────────────────────────────────────────

    /**
     * @notice List an NFT for sale.
     * @param nftContract   ERC-721 contract address.
     * @param tokenId       Token to list.
     * @param price         Sale price (in wei for native, token units for ERC-20).
     * @param paymentToken  ERC-20 token address, or address(0) for native currency.
     * @param expiry        Unix timestamp deadline (0 = no expiry).
     */
    function list(
        address nftContract,
        uint256 tokenId,
        uint256 price,
        address paymentToken,
        uint256 expiry
    ) external whenNotPaused returns (bytes32 listingId) {
        require(price > 0, "Marketplace: price must be > 0");
        require(
            IERC721(nftContract).ownerOf(tokenId) == msg.sender,
            "Marketplace: not token owner"
        );
        require(
            IERC721(nftContract).isApprovedForAll(msg.sender, address(this)) ||
            IERC721(nftContract).getApproved(tokenId) == address(this),
            "Marketplace: not approved"
        );

        listingId = _listingId(msg.sender, nftContract, tokenId, sellerNonce[msg.sender]);
        listings[listingId] = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            paymentToken: paymentToken,
            expiry: expiry,
            active: true
        });

        emit Listed(listingId, msg.sender, nftContract, tokenId, price, paymentToken, expiry);
    }

    /**
     * @notice Cancel an active listing.
     */
    function cancelListing(bytes32 listingId) external {
        Listing storage l = listings[listingId];
        require(l.active, "Marketplace: not active");
        require(l.seller == msg.sender || msg.sender == owner(), "Marketplace: not authorized");
        l.active = false;
        emit ListingCancelled(listingId);
    }

    /**
     * @notice Cancel all listings by incrementing the seller nonce.
     */
    function cancelAllListings() external {
        sellerNonce[msg.sender]++;
    }

    /**
     * @notice Buy a listed NFT with native currency.
     */
    function buy(bytes32 listingId) external payable nonReentrant whenNotPaused {
        Listing storage l = listings[listingId];
        require(l.active, "Marketplace: not active");
        require(l.paymentToken == address(0), "Marketplace: use buyWithToken");
        require(msg.value >= l.price, "Marketplace: insufficient payment");
        if (l.expiry > 0) require(block.timestamp <= l.expiry, "Marketplace: listing expired");

        l.active = false;
        _executeSale(l.seller, msg.sender, l.nftContract, l.tokenId, l.price, address(0), listingId);

        // Refund excess
        if (msg.value > l.price) {
            (bool ok,) = msg.sender.call{value: msg.value - l.price}("");
            require(ok, "Marketplace: refund failed");
        }
    }

    /**
     * @notice Buy a listed NFT with ERC-20 token.
     */
    function buyWithToken(bytes32 listingId) external nonReentrant whenNotPaused {
        Listing storage l = listings[listingId];
        require(l.active, "Marketplace: not active");
        require(l.paymentToken != address(0), "Marketplace: use buy for native");
        if (l.expiry > 0) require(block.timestamp <= l.expiry, "Marketplace: listing expired");

        l.active = false;
        _executeSaleERC20(l.seller, msg.sender, l.nftContract, l.tokenId, l.price, l.paymentToken, listingId);
    }

    // ─── Offers ──────────────────────────────────────────────────────────────

    /**
     * @notice Make an offer on an NFT (ERC-20 only – caller must have approved this contract).
     */
    function makeOffer(
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        address paymentToken,
        uint256 expiry
    ) external whenNotPaused returns (bytes32 offerId) {
        require(amount > 0, "Marketplace: amount must be > 0");
        require(paymentToken != address(0), "Marketplace: offers require ERC-20");

        offerId = _offerId(msg.sender, nftContract, tokenId, block.timestamp);
        offers[offerId] = Offer({
            buyer: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            amount: amount,
            paymentToken: paymentToken,
            expiry: expiry,
            active: true
        });

        emit OfferMade(offerId, msg.sender, nftContract, tokenId, amount, paymentToken, expiry);
    }

    /**
     * @notice Cancel an active offer.
     */
    function cancelOffer(bytes32 offerId) external {
        Offer storage o = offers[offerId];
        require(o.active, "Marketplace: not active");
        require(o.buyer == msg.sender, "Marketplace: not your offer");
        o.active = false;
        emit OfferCancelled(offerId);
    }

    /**
     * @notice Accept an offer as the NFT owner.
     */
    function acceptOffer(bytes32 offerId) external nonReentrant whenNotPaused {
        Offer storage o = offers[offerId];
        require(o.active, "Marketplace: not active");
        if (o.expiry > 0) require(block.timestamp <= o.expiry, "Marketplace: offer expired");
        require(
            IERC721(o.nftContract).ownerOf(o.tokenId) == msg.sender,
            "Marketplace: not token owner"
        );

        o.active = false;
        _executeSaleERC20(msg.sender, o.buyer, o.nftContract, o.tokenId, o.amount, o.paymentToken, offerId);

        emit OfferAccepted(offerId, msg.sender, o.buyer, o.nftContract, o.tokenId, o.amount, o.paymentToken);
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _executeSale(
        address seller,
        address buyer,
        address nftContract,
        uint256 tokenId,
        uint256 price,
        address paymentToken,
        bytes32 listingId
    ) internal {
        (address royaltyReceiver, uint256 royaltyAmount) = _getRoyalty(nftContract, tokenId, price);
        uint256 fee = (price * feeBps) / BASIS_POINTS;
        uint256 sellerProceeds = price - fee - royaltyAmount;

        // Transfer NFT
        IERC721(nftContract).safeTransferFrom(seller, buyer, tokenId);

        // Pay royalty
        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            (bool ok,) = royaltyReceiver.call{value: royaltyAmount}("");
            require(ok, "Marketplace: royalty transfer failed");
        }

        // Pay protocol fee
        if (fee > 0) {
            (bool ok,) = feeRecipient.call{value: fee}("");
            require(ok, "Marketplace: fee transfer failed");
        }

        // Pay seller
        (bool ok2,) = seller.call{value: sellerProceeds}("");
        require(ok2, "Marketplace: seller transfer failed");

        emit Sale(listingId, seller, buyer, nftContract, tokenId, price, paymentToken);
    }

    function _executeSaleERC20(
        address seller,
        address buyer,
        address nftContract,
        uint256 tokenId,
        uint256 price,
        address paymentToken,
        bytes32 id
    ) internal {
        (address royaltyReceiver, uint256 royaltyAmount) = _getRoyalty(nftContract, tokenId, price);
        uint256 fee = (price * feeBps) / BASIS_POINTS;
        uint256 sellerProceeds = price - fee - royaltyAmount;

        // Pull payment from buyer
        IERC20(paymentToken).safeTransferFrom(buyer, address(this), price);

        // Transfer NFT
        IERC721(nftContract).safeTransferFrom(seller, buyer, tokenId);

        // Pay royalty
        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            IERC20(paymentToken).safeTransfer(royaltyReceiver, royaltyAmount);
        }

        // Pay protocol fee
        if (fee > 0) {
            IERC20(paymentToken).safeTransfer(feeRecipient, fee);
        }

        // Pay seller
        IERC20(paymentToken).safeTransfer(seller, sellerProceeds);

        emit Sale(id, seller, buyer, nftContract, tokenId, price, paymentToken);
    }

    function _getRoyalty(address nftContract, uint256 tokenId, uint256 price)
        internal
        view
        returns (address receiver, uint256 amount)
    {
        try IERC2981(nftContract).royaltyInfo(tokenId, price) returns (
            address r, uint256 a
        ) {
            // Cap royalty to protect buyers: max 30%
            if (a > (price * 3000) / BASIS_POINTS) {
                a = (price * 3000) / BASIS_POINTS;
            }
            return (r, a);
        } catch {
            return (address(0), 0);
        }
    }

    function _listingId(address seller, address nftContract, uint256 tokenId, uint256 nonce)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(seller, nftContract, tokenId, nonce));
    }

    function _offerId(address buyer, address nftContract, uint256 tokenId, uint256 ts)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(buyer, nftContract, tokenId, ts));
    }

    // Expose nftContract for internal sale calls
    mapping(bytes32 => address) private _listingNft;

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setFee(uint256 feeBps_, address feeRecipient_) external onlyOwner {
        require(feeBps_ <= MAX_FEE_BPS, "Marketplace: fee too high");
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
        emit FeeUpdated(feeBps_, feeRecipient_);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    receive() external payable {}
}
