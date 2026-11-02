import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  splitting: true,
  sourcemap: true,
  // Runtime dependencies are installed alongside the package.
  skipNodeModulesBundle: true,
})
