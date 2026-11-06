import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

/**
 * Recharts v3 imports es-toolkit/compat utilities as default imports:
 *   import get from 'es-toolkit/compat/get'
 *
 * But es-toolkit only provides named exports from those subpaths.
 * Vite's pre-bundler (esbuild) would normally fix this via CJS interop,
 * but it generates a variable naming collision (require_isUnsafeProperty).
 *
 * This plugin intercepts the subpath imports and rewrites them as:
 *   import { get as default } from 'es-toolkit/compat'
 *
 * This avoids both the missing-default-export error AND the esbuild collision.
 */
const COMPAT_UTILS = [
  'get', 'sortBy', 'uniqBy', 'isPlainObject', 'range',
  'last', 'maxBy', 'minBy', 'omit', 'throttle', 'sumBy',
]

function esToolkitCompatPlugin(): Plugin {
  const prefix = 'es-toolkit/compat/'
  const virtualPrefix = '\0es-toolkit-compat:'

  return {
    name: 'es-toolkit-compat-default-export',
    enforce: 'pre',

    resolveId(source) {
      if (source.startsWith(prefix)) {
        const name = source.slice(prefix.length)
        if (COMPAT_UTILS.includes(name)) {
          return virtualPrefix + name
        }
      }
      return null
    },

    load(id) {
      if (id.startsWith(virtualPrefix)) {
        const name = id.slice(virtualPrefix.length)
        return `export { ${name} as default, ${name} } from 'es-toolkit/compat';`
      }
      return null
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    esToolkitCompatPlugin(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    exclude: ['es-toolkit'],
  },
})
