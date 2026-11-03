import type { Config } from 'jest';

// El backend es ESM ("type": "module" e imports con extensión .js), así que
// Jest corre en modo ESM (el script `test` ya pasa --experimental-vm-modules)
// y ts-jest compila con `useESM`.
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  // Los imports relativos se escriben con .js (lo exige "moduleResolution":
  // "nodenext"); en los tests se resuelven al .ts original.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;
