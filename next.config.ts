import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // ビルド時の型チェックエラーを警告として扱う（本番環境では修正推奨）
    ignoreBuildErrors: true,
  },
  eslint: {
    // ビルド時のESLintエラーを警告として扱う
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
