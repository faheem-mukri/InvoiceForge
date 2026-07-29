/** @type {import('next').NextConfig} */

// Origin of the Express API. Server-side only (not NEXT_PUBLIC_*) because it is
// used by the rewrite proxy below, which runs on the server/edge.
const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:4000').replace(/\/$/, '');

const nextConfig = {
  // Proxy the API through this Next.js app so the browser only ever talks to
  // ONE origin. That makes auth cookies FIRST-PARTY, which is required for
  // iOS Safari/Chrome (all iOS browsers use WebKit) and any browser blocking
  // third-party cookies — cross-site SameSite=None cookies are dropped there.
  //
  // The client calls /api/... (see NEXT_PUBLIC_API_URL default in lib/api.js)
  // and Next forwards it to the backend, preserving cookies transparently.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
