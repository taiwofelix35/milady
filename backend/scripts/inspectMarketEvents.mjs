import { createPublicClient, http, toEventHash } from "viem";

const rpcUrl = process.env.RPC_URL || "https://rpc.tempo.xyz";
const client = createPublicClient({ transport: http(rpcUrl) });

const txs = [
  "0x04ffeb86a20708c7331ed25b22b8739f992f46fd0cde9fb6e25414f47145b05a",
  "0xa2a9557c9cae13679d878a76369321ddcb85776b273a3d6de060606077576803",
  "0xd79e4b53957e23aa3d77d4a9646ad4d735a9d5a529147db3fd43103e724c69bc",
];

const known = {
  ItemListed: toEventHash("ItemListed(address,address,uint256,uint256)"),
  ItemSold: toEventHash("ItemSold(address,address,address,uint256,uint256)"),
  OfferMade: toEventHash("OfferMade(address,address,uint256,uint256,uint256)"),
  Listed: toEventHash("Listed(bytes32,address,address,uint256,uint256,address,uint256)"),
  Sale: toEventHash("Sale(bytes32,address,address,address,uint256,uint256,address)"),
  LegacyOfferMade: toEventHash("OfferMade(bytes32,address,address,uint256,uint256,address,uint256)"),
};

console.log("Known event topics:");
for (const [name, topic] of Object.entries(known)) {
  console.log(`- ${name}: ${topic}`);
}

for (const tx of txs) {
  const receipt = await client.getTransactionReceipt({ hash: tx });
  console.log(`\nTX ${tx}`);
  console.log(`to=${receipt.to} logs=${receipt.logs.length}`);

  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    const topic0 = log.topics && log.topics.length ? log.topics[0] : null;
    let matched = "unknown";
    if (topic0) {
      for (const [name, topic] of Object.entries(known)) {
        if (topic.toLowerCase() === topic0.toLowerCase()) {
          matched = name;
          break;
        }
      }
    }

    console.log(`  [${i}] address=${log.address} topic0=${topic0} match=${matched}`);
  }
}
