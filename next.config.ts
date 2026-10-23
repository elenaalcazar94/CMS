import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  serverExternalPackages: ["sanitize-html", "nodemailer"],
};

export default nextConfig;
