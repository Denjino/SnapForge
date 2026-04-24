/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['playwright', 'sharp', 'archiver'],
  },
};

module.exports = nextConfig;
