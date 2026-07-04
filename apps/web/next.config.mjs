/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@kiln/renderer-react",
    "@kiln/ui-planner",
    "@kiln/dataset-spec",
    "@kiln/schema-inferencer",
  ],
  // Keep the node-only DB packages out of any client/edge bundle.
  serverExternalPackages: ["postgres", "@kiln/db"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};

export default nextConfig;
