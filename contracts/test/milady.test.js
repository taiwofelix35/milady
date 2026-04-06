import { expect, assert } from "chai";
import hre from "hardhat";

async function getEthers() {
  const conn = await hre.network.connect();
  return conn.ethers;
}

async function expectRevert(txPromise, message) {
  try {
    await txPromise;
    assert.fail("Expected transaction to revert but it didn't");
  } catch (err) {
    assert.include(err.message, message);
  }
}

describe("MiladyNFT", function () {
  let nft, owner, alice, bob, ethers;

  beforeEach(async function () {
    ethers = await getEthers();
    [owner, alice, bob] = await ethers.getSigners();
    const MiladyNFT = await ethers.getContractFactory("MiladyNFT");
    nft = await MiladyNFT.deploy(
      "Milady Maker", "MILADY", "ipfs://test/", 100,
      ethers.parseEther("0.01"), owner.address, 500
    );
  });

  it("mints token with per-token URI (no base concatenation)", async function () {
    await nft.connect(alice).mint(alice.address, "ipfs://token/1", {
      value: ethers.parseEther("0.01"),
    });
    expect(await nft.ownerOf(0)).to.equal(alice.address);
    // Per-token URI returned directly, not concatenated with base
    expect(await nft.tokenURI(0)).to.equal("ipfs://token/1");
  });

  it("mints token without URI – falls back to baseURI + tokenId", async function () {
    await nft.connect(alice).mint(alice.address, "", {
      value: ethers.parseEther("0.01"),
    });
    expect(await nft.tokenURI(0)).to.equal("ipfs://test/0");
  });

  it("enforces mint price", async function () {
    await expectRevert(
      nft.connect(alice).mint(alice.address, "", { value: ethers.parseEther("0.005") }),
      "MiladyNFT: insufficient payment"
    );
  });

  it("reports correct royalty info", async function () {
    await nft.connect(alice).mint(alice.address, "", { value: ethers.parseEther("0.01") });
    const [receiver, amount] = await nft.royaltyInfo(0, ethers.parseEther("1"));
    expect(receiver).to.equal(owner.address);
    expect(amount).to.equal(ethers.parseEther("0.05")); // 5%
  });

  it("allows owner to set per-token royalty override", async function () {
    await nft.connect(alice).mint(alice.address, "", { value: ethers.parseEther("0.01") });
    await nft.setTokenRoyalty(0, bob.address, 1000);
    const [receiver, amount] = await nft.royaltyInfo(0, ethers.parseEther("1"));
    expect(receiver).to.equal(bob.address);
    expect(amount).to.equal(ethers.parseEther("0.1"));
  });

  it("respects max supply", async function () {
    const MiladyNFT = await ethers.getContractFactory("MiladyNFT");
    const limited = await MiladyNFT.deploy(
      "Limited", "LTD", "", 2, ethers.parseEther("0"), owner.address, 0
    );
    await limited.mint(alice.address, "");
    await limited.mint(alice.address, "");
    await expectRevert(limited.mint(alice.address, ""), "MiladyNFT: max supply reached");
  });
});

describe("MiladyMarketplace", function () {
  let nft, marketplace, owner, seller, buyer, ethers;

  beforeEach(async function () {
    ethers = await getEthers();
    [owner, seller, buyer] = await ethers.getSigners();

    const MiladyNFT = await ethers.getContractFactory("MiladyNFT");
    nft = await MiladyNFT.deploy(
      "Milady", "MLY", "", 1000, ethers.parseEther("0"), owner.address, 500
    );

    const MiladyMarketplace = await ethers.getContractFactory("MiladyMarketplace");
    marketplace = await MiladyMarketplace.deploy(owner.address, 250);

    await nft.connect(seller).mint(seller.address, "ipfs://1");
    await nft.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
  });

  async function listToken(tokenId, price) {
    const nftAddress = await nft.getAddress();
    const listTx = await marketplace.connect(seller).list(
      nftAddress, tokenId, price, ethers.ZeroAddress, 0
    );
    const receipt = await listTx.wait();
    const event = receipt.logs.find((l) => l.fragment && l.fragment.name === "Listed");
    return event.args[0]; // listingId
  }

  it("lists and buys with native currency; distributes fees + royalties", async function () {
    const price = ethers.parseEther("1");
    const listingId = await listToken(0, price);

    const sellerBefore = await ethers.provider.getBalance(seller.address);
    const buyTx = await marketplace.connect(buyer).buy(listingId, { value: price });
    await buyTx.wait();

    expect(await nft.ownerOf(0)).to.equal(buyer.address);
    const sellerAfter = await ethers.provider.getBalance(seller.address);
    // Seller receives 100% - 2.5% fee - 5% royalty = 92.5%
    expect(sellerAfter - sellerBefore).to.be.closeTo(
      ethers.parseEther("0.925"),
      ethers.parseEther("0.001")
    );
  });

  it("cancels a listing", async function () {
    const listingId = await listToken(0, ethers.parseEther("1"));
    await marketplace.connect(seller).cancelListing(listingId);
    const listing = await marketplace.listings(listingId);
    expect(listing.active).to.equal(false);
  });

  it("rejects buy on expired listing", async function () {
    const nftAddress = await nft.getAddress();
    const expiry = Math.floor(Date.now() / 1000) - 1;
    const listTx = await marketplace.connect(seller).list(
      nftAddress, 0, ethers.parseEther("1"), ethers.ZeroAddress, expiry
    );
    const receipt = await listTx.wait();
    const event = receipt.logs.find((l) => l.fragment && l.fragment.name === "Listed");
    const listingId = event.args[0];

    await expectRevert(
      marketplace.connect(buyer).buy(listingId, { value: ethers.parseEther("1") }),
      "Marketplace: listing expired"
    );
  });

  it("ERC-20 offer: make and accept", async function () {
    const nftAddress = await nft.getAddress();
    const marketplaceAddress = await marketplace.getAddress();
    const offerAmount = ethers.parseEther("0.5");

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const weth = await MockERC20.deploy("Wrapped ETH", "WETH");

    await weth.mint(buyer.address, offerAmount);
    await weth.connect(buyer).approve(marketplaceAddress, offerAmount);

    const offerTx = await marketplace.connect(buyer).makeOffer(
      nftAddress, 0, offerAmount, await weth.getAddress(), 0
    );
    const receipt = await offerTx.wait();
    const event = receipt.logs.find((l) => l.fragment && l.fragment.name === "OfferMade");
    const offerId = event.args[0];

    await marketplace.connect(seller).acceptOffer(offerId);

    expect(await nft.ownerOf(0)).to.equal(buyer.address);
  });

  it("ERC-20 offer: cancel", async function () {
    const nftAddress = await nft.getAddress();
    const marketplaceAddress = await marketplace.getAddress();
    const offerAmount = ethers.parseEther("0.5");

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const weth = await MockERC20.deploy("Wrapped ETH", "WETH");

    await weth.mint(buyer.address, offerAmount);
    await weth.connect(buyer).approve(marketplaceAddress, offerAmount);

    const offerTx = await marketplace.connect(buyer).makeOffer(
      nftAddress, 0, offerAmount, await weth.getAddress(), 0
    );
    const receipt = await offerTx.wait();
    const event = receipt.logs.find((l) => l.fragment && l.fragment.name === "OfferMade");
    const offerId = event.args[0];

    await marketplace.connect(buyer).cancelOffer(offerId);
    const offer = await marketplace.offers(offerId);
    expect(offer.active).to.equal(false);
  });

  it("ERC-20 offer: rejects accept of cancelled offer", async function () {
    const nftAddress = await nft.getAddress();
    const marketplaceAddress = await marketplace.getAddress();
    const offerAmount = ethers.parseEther("0.5");

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const weth = await MockERC20.deploy("Wrapped ETH", "WETH");

    await weth.mint(buyer.address, offerAmount);
    await weth.connect(buyer).approve(marketplaceAddress, offerAmount);

    const offerTx = await marketplace.connect(buyer).makeOffer(
      nftAddress, 0, offerAmount, await weth.getAddress(), 0
    );
    const receipt = await offerTx.wait();
    const event = receipt.logs.find((l) => l.fragment && l.fragment.name === "OfferMade");
    const offerId = event.args[0];

    await marketplace.connect(buyer).cancelOffer(offerId);
    await expectRevert(
      marketplace.connect(seller).acceptOffer(offerId),
      "Marketplace: not active"
    );
  });
});
