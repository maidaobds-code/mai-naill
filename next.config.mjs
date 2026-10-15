/** @type {import('next').NextConfig} */
const nextConfig = {
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
