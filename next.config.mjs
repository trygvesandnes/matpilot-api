/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const origins = process.env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()) ?? ["*"];
    return [
      {
        // Alle /api/-endepunkter
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin",  value: origins.join(",") },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type,Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;
