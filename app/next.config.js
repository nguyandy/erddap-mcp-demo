/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mui/material', '@mui/system', '@emotion/react', '@emotion/styled'],
  output: 'standalone',
}

module.exports = nextConfig

