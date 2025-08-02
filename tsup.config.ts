import { defineConfig } from 'tsup'

export default defineConfig([
  // Main library bundle
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    outDir: 'dist',
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    minify: true,
    treeshake: true,
    external: ['fast-csv', 'd3-array', 'ejs', 'commander', 'fs-extra', 'html-escaper'],
    banner: {
      js: '/* JMeter Style Reporter v1.0.0 - MIT License */',
    },
  },
  // CLI bundle
  {
    entry: ['src/cli/index.ts'],
    format: ['cjs'],
    outDir: 'dist/cli',
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    minify: true,
    shims: true,
    banner: {
      js: '/* JMeter Style Reporter CLI v1.0.0 */',
    },
    external: ['fast-csv', 'd3-array', 'ejs', 'commander', 'fs-extra', 'html-escaper'],
  }
])