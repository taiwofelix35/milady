import { getCompiler } from "./node_modules/hardhat/dist/src/internal/builtin-plugins/solidity/build-system/compiler/index.js";

const SOLCJS_PATH = "/opt/hostedtoolcache/node/24.14.1/x64/lib/node_modules/solc/soljson.js";

export default async () => ({
  downloadCompilers: async (_context, _compilerConfigs, _quiet) => {
    // Skip download - we use a local compiler path
  },
  getCompiler: async (_context, compilerConfig, _next) => {
    return getCompiler(compilerConfig.version, { compilerPath: SOLCJS_PATH });
  },
});
