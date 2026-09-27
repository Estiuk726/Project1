import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source, so Next compiles them.
  transpilePackages: [
    '@flightmates/domain',
    '@flightmates/contracts',
    '@flightmates/db',
    '@flightmates/adapters',
  ],
  poweredByHeader: false,
};

export default nextConfig;
