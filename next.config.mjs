/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
    ] }];
  },
  transpilePackages: ["star-io10-web"],
  webpack(config) {
    config.module.rules.push({
      test: /star-io10-web[\\/].*\.ts$/,
      use: { loader: "babel-loader", options: { presets: ["@babel/preset-typescript"] } },
    });
    return config;
  },
};

export default nextConfig;
