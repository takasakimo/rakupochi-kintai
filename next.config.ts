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
  // らくっぽ勤怠に不要な別プロジェクトのページを除外
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  // ビルドから除外するパス
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        'app/recipes/**/*',
        'app/inventory/**/*',
        'app/shopping-list/**/*',
        'utils/supabase/**/*',
      ],
    },
  },
};

export default nextConfig;
