import { getCompiler } from "./node_modules/hardhat/dist/src/internal/builtin-plugins/solidity/build-system/compiler/index.js";

const SOLCJS_PATH = "/opt/hostedtoolcache/node/24.14.1/x64/lib/node_modules/solc/soljson.js";

export const solidityHookHandlers = async () => ({
  downloadCompilers: async (_context, _compilerConfigs, _quiet) => {
    // Skip download - we use a local compiler
  },
  getCompiler: async (_context, compilerConfig, next) => {
    const path = SOLCJS_PATH;
    return getCompiler(compilerConfig.version, { compilerPath: path });
  },
});

const localCompilerPlugin = {
  id: "local-compiler",
  hookHandlers: {
    solidity: () => Promise.resolve({ default: solidityHookHandlers }).then(m => m.default()),
  },
};

export default localCompilerPlugin;
