/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "wetudy.com" }],
        destination: "https://www.wetudy.com/:path*",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
