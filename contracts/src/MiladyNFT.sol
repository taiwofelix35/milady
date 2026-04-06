// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title MiladyNFT
 * @notice ERC-721 NFT contract with EIP-2981 royalty support for the Milady marketplace.
 */
contract MiladyNFT is ERC721, ERC721URIStorage, ERC721Enumerable, IERC2981, Ownable, ReentrancyGuard {
    // ─── State ───────────────────────────────────────────────────────────────

    uint256 private _nextTokenId;

    /// @notice Maximum supply of tokens (0 = unlimited)
    uint256 public maxSupply;

    /// @notice Mint price in native currency (wei)
    uint256 public mintPrice;

    /// @notice Base URI used when tokenURI is not set individually
    string private _baseTokenURI;

    /// @notice Default royalty recipient
    address public royaltyRecipient;

    /// @notice Default royalty basis points (e.g. 500 = 5%)
    uint96 public royaltyBps;

    /// @notice Per-token royalty overrides
    struct RoyaltyInfo {
        address receiver;
        uint96 royaltyFraction;
    }
    mapping(uint256 => RoyaltyInfo) private _tokenRoyalties;

    // ─── Events ──────────────────────────────────────────────────────────────

    event TokenMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event RoyaltySet(uint256 indexed tokenId, address receiver, uint96 bps);
    event DefaultRoyaltySet(address receiver, uint96 bps);
    event MintPriceUpdated(uint256 newPrice);
    event Withdrawn(address indexed to, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        uint256 maxSupply_,
        uint256 mintPrice_,
        address royaltyRecipient_,
        uint96 royaltyBps_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        _baseTokenURI = baseURI_;
        maxSupply = maxSupply_;
        mintPrice = mintPrice_;
        royaltyRecipient = royaltyRecipient_;
        royaltyBps = royaltyBps_;
    }

    // ─── Minting ─────────────────────────────────────────────────────────────

    /**
     * @notice Public mint – caller pays mintPrice.
     * @param to      Recipient address.
     * @param uri     Metadata URI for this token (empty = use baseURI + tokenId).
     */
    function mint(address to, string calldata uri) external payable nonReentrant returns (uint256) {
        require(msg.value >= mintPrice, "MiladyNFT: insufficient payment");
        if (maxSupply > 0) {
            require(_nextTokenId < maxSupply, "MiladyNFT: max supply reached");
        }
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        if (bytes(uri).length > 0) {
            _setTokenURI(tokenId, uri);
        }
        emit TokenMinted(to, tokenId, uri);
        return tokenId;
    }

    /**
     * @notice Owner-only batch mint (airdrop / pre-mint).
     */
    function ownerMint(address to, string[] calldata uris) external onlyOwner {
        uint256 count = uris.length;
        if (maxSupply > 0) {
            require(_nextTokenId + count <= maxSupply, "MiladyNFT: exceeds max supply");
        }
        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(to, tokenId);
            if (bytes(uris[i]).length > 0) {
                _setTokenURI(tokenId, uris[i]);
            }
            emit TokenMinted(to, tokenId, uris[i]);
        }
    }

    // ─── Royalties (EIP-2981) ─────────────────────────────────────────────────

    /**
     * @notice Set default royalty for all tokens.
     */
    function setDefaultRoyalty(address receiver, uint96 bps) external onlyOwner {
        require(bps <= 10_000, "MiladyNFT: royalty exceeds 100%");
        royaltyRecipient = receiver;
        royaltyBps = bps;
        emit DefaultRoyaltySet(receiver, bps);
    }

    /**
     * @notice Override royalty for a specific token.
     */
    function setTokenRoyalty(uint256 tokenId, address receiver, uint96 bps) external onlyOwner {
        require(bps <= 10_000, "MiladyNFT: royalty exceeds 100%");
        _tokenRoyalties[tokenId] = RoyaltyInfo(receiver, bps);
        emit RoyaltySet(tokenId, receiver, bps);
    }

    /// @inheritdoc IERC2981
    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        external
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        RoyaltyInfo memory info = _tokenRoyalties[tokenId];
        if (info.receiver != address(0)) {
            receiver = info.receiver;
            royaltyAmount = (salePrice * info.royaltyFraction) / 10_000;
        } else {
            receiver = royaltyRecipient;
            royaltyAmount = (salePrice * royaltyBps) / 10_000;
        }
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
    }

    function setMintPrice(uint256 price) external onlyOwner {
        mintPrice = price;
        emit MintPriceUpdated(price);
    }

    function withdraw(address payable to) external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "MiladyNFT: nothing to withdraw");
        (bool ok,) = to.call{value: balance}("");
        require(ok, "MiladyNFT: transfer failed");
        emit Withdrawn(to, balance);
    }

    // ─── View helpers ─────────────────────────────────────────────────────────

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    // ─── Overrides ───────────────────────────────────────────────────────────

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        _requireOwned(tokenId);
        // If a per-token URI was stored, return it directly (full URI, no base concatenation).
        string memory perTokenURI = _suffixURI(tokenId);
        if (bytes(perTokenURI).length > 0) {
            return perTokenURI;
        }
        // Otherwise fall back to baseURI + tokenId.
        string memory base = _baseURI();
        if (bytes(base).length > 0) {
            return string.concat(base, Strings.toString(tokenId));
        }
        return "";
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, ERC721Enumerable, IERC165)
        returns (bool)
    {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }
}
