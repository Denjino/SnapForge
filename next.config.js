/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // playwright and sharp must stay external (native bindings / spawned
    // browsers). archiver is deliberately NOT listed: it must be bundled into
    // the route chunk, because electron-builder's node_modules collector
    // drops parts of its transitive dep chain (archiver-utils) from the
    // packaged app, which 500s the zip route at runtime.
    serverComponentsExternalPackages: ['playwright', 'sharp'],
  },
};

module.exports = nextConfig;
