/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Enable optimizations
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
