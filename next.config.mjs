/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets the dev server use its own folder so `npm run build` can run alongside it.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};
export default nextConfig;
