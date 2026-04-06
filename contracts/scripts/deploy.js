import hre from "hardhat";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // ── MiladyNFT ──────────────────────────────────────────────────────────────
  const MiladyNFT = await hre.ethers.getContractFactory("MiladyNFT");
  const nft = await MiladyNFT.deploy(
    "Milady Maker",
    "MILADY",
    "ipfs://QmMiladyBaseURI/",
    10_000,
    hre.ethers.parseEther("0.01"),
    deployer.address,
    500
  );
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("MiladyNFT deployed to:", nftAddress);

  // ── MiladyMarketplace ──────────────────────────────────────────────────────
  const MiladyMarketplace = await hre.ethers.getContractFactory("MiladyMarketplace");
  const marketplace = await MiladyMarketplace.deploy(
    deployer.address,
    250
  );
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("MiladyMarketplace deployed to:", marketplaceAddress);

  console.log("\n=== Deployment Summary ===");
  console.log("Network:", hre.network.name);
  console.log("MiladyNFT:         ", nftAddress);
  console.log("MiladyMarketplace: ", marketplaceAddress);
  console.log("\nUpdate frontend/.env.local with these addresses!");

  const artifactsDir = join(__dirname, "../artifacts");
  mkdirSync(artifactsDir, { recursive: true });
  const addresses = { MiladyNFT: nftAddress, MiladyMarketplace: marketplaceAddress };
  writeFileSync(
    join(artifactsDir, "deployed-addresses.json"),
    JSON.stringify(addresses, null, 2)
  );
  console.log("Addresses written to artifacts/deployed-addresses.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
