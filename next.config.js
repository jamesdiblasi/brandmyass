/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Azure App Service runs `node server.js`. Standalone output emits exactly
  // that — a self-contained server plus only the node_modules it actually
  // traced — which is what `azure/webapps-deploy` uploads. Note that
  // `next start` does not work with this set; use `npm run dev` locally.
  output: 'standalone',
}
module.exports = nextConfig
