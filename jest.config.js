/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  transform: {
    "^.+\\.[tj]sx?$": [
      "ts-jest",
      {
        tsconfig: {
          // Without this configuration option, jest throws errors when encountering JSX
          // elements in tests or any files imported from test files
          jsx: "react-jsx",
          target: "ESNext",
          lib: ["dom", "dom.iterable", "esnext"],
        },
      },
    ],
  },
  transformIgnorePatterns: [
    // Specifically allow the `fractional-indexing` package to be transformed by ts-jest because
    // otherwise its ECMA Module syntax will cause jest to throw errors
    "node_modules/(?!(fractional-indexing)/)"
  ],
  moduleNameMapper: {
    '\\.css$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'jsdom',
  testMatch: [
    '**/*.test.ts?(x)',
  ],
  setupFiles: ['./jest.setup.js'],
};