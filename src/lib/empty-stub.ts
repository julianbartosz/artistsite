// Empty stub for Node.js modules that shouldn't run client-side

// Default export
const emptyStub = {
  sync: () => [],
  async: () => Promise.resolve([]),
  stream: () => ({ on: () => {}, pipe: () => {} }),
  createFileSystemAdapter: () => ({
    lstat: () => Promise.resolve({}),
    stat: () => Promise.resolve({}),
    readdir: () => Promise.resolve([]),
    lstatSync: () => ({}),
    statSync: () => ({}),
    readdirSync: () => [],
  }),
  FILE_SYSTEM_ADAPTER: {
    lstat: () => Promise.resolve({}),
    stat: () => Promise.resolve({}),
    readdir: () => Promise.resolve([]),
    lstatSync: () => ({}),
    statSync: () => ({}),
    readdirSync: () => [],
  },
};

export default emptyStub;

// Named exports for compatibility
export const sync = () => [];
export const async = () => Promise.resolve([]);
export const stream = () => ({ on: () => {}, pipe: () => {} });
export const createFileSystemAdapter = () => ({
  lstat: () => Promise.resolve({}),
  stat: () => Promise.resolve({}),
  readdir: () => Promise.resolve([]),
  lstatSync: () => ({}),
  statSync: () => ({}),
  readdirSync: () => [],
});
export const FILE_SYSTEM_ADAPTER = {
  lstat: () => Promise.resolve({}),
  stat: () => Promise.resolve({}),
  readdir: () => Promise.resolve([]),
  lstatSync: () => ({}),
  statSync: () => ({}),
  readdirSync: () => [],
};

// CommonJS compatibility for webpack
if (typeof module !== 'undefined' && module.exports) {
  module.exports = emptyStub;
  module.exports.default = emptyStub;
  Object.assign(module.exports, {
    sync,
    async,
    stream,
    createFileSystemAdapter,
    FILE_SYSTEM_ADAPTER,
  });
}