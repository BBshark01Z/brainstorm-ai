/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ---------------------------------------------------------------------------
  // Rewrites — proxy /api/* and /ws/* to the local backend.
  //
  // When running behind a public tunnel (Cloudflare / ngrok) only port 3000
  // is exposed.  These rewrites let the frontend talk to relative paths
  // (/api/..., /ws/...) and Next.js forwards them to the backend on 8765.
  // ---------------------------------------------------------------------------
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8765";

    return [
      // REST API proxy — /api/:path* → backend/:path*
      // NOTE: WebSocket proxy removed — Next.js rewrites do NOT handle
      // WebSocket upgrade headers (Upgrade: websocket, Connection: Upgrade).
      // The frontend connects DIRECTLY to ws://127.0.0.1:8765/ws/eeg-stream
      // (see useEEGContext.tsx + useWebSocketStream.ts) to avoid the "Connecting..." hang.
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
