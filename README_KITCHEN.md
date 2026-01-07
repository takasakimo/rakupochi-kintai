# AI Kitchen Partner

AI食材管理＆レシピ提案アプリケーション

## 概要

冷蔵庫の食材管理、AIによるレシピ提案、Myレシピ管理、ユーザーの好み学習を一元化し、毎日の料理の手間を解消するアプリケーションです。

## 技術スタック

- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Styling**: Tailwind CSS, shadcn/ui
- **Icons**: Lucide React
- **Backend/DB**: Supabase (PostgreSQL, Auth, Storage)
- **AI Integration**: OpenAI API
  - `gpt-4o`: 画像解析（レシート、レシピ写真）
  - `gpt-4o-mini`: テキスト生成、レシピ考案、JSON整形

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local`ファイルを作成し、以下の環境変数を設定してください：

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key

# Database URL (if using Prisma)
DATABASE_URL=your_supabase_database_url
```

### 3. Supabaseデータベースのセットアップ

1. Supabaseプロジェクトを作成
2. SQL Editorで`supabase/migrations/001_initial_schema.sql`を実行
3. Authenticationを有効化（Email認証）

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## 主要機能

### 1. 在庫管理（Inventory）

- 食材の手動登録
- レシート画像のOCR解析による一括登録
- 消費期限の管理
- カテゴリ別の分類

### 2. AIレシピ提案

- 冷蔵庫の在庫から最適なレシピを提案
- ユーザーの好みを学習
- 不足食材を買い物リストにワンクリックで追加

### 3. Myレシピ管理

- 手動入力
- URL/テキストからの自動解析
- 画像からのOCR解析
- お気に入り機能

### 4. 買い物リスト

- チェックリスト形式
- 完了/未完了の管理

### 5. 好み学習

- レシピ評価（1-5段階）から好みを学習
- フィードバックテキストの分析
- 自動的な好み設定の更新

## データベーススキーマ

### inventory (在庫)
- `id`: UUID
- `user_id`: UUID
- `name`: 食材名
- `quantity`: 数量
- `expiry_date`: 消費期限
- `category`: カテゴリ
- `created_at`: 作成日時

### recipes (レシピ)
- `id`: UUID
- `user_id`: UUID
- `title`: タイトル
- `description`: 説明
- `ingredients`: JSONB (材料配列)
- `steps`: JSONB (手順配列)
- `calories`: カロリー
- `image_url`: 画像URL
- `source_type`: ソースタイプ
- `is_favorite`: お気に入り
- `created_at`, `updated_at`: 日時

### recipe_history (レシピ履歴)
- `id`: UUID
- `user_id`: UUID
- `generated_recipe_json`: JSONB
- `rating`: 評価 (1-5)
- `feedback_text`: フィードバック
- `created_at`: 作成日時

### shopping_list (買い物リスト)
- `id`: UUID
- `user_id`: UUID
- `item_name`: アイテム名
- `is_checked`: チェック状態
- `created_at`: 作成日時

### user_preferences (ユーザー好み)
- `user_id`: UUID (Primary Key)
- `preferences_summary`: 好みの要約
- `updated_at`: 更新日時

## API エンドポイント

### `/api/analyze-receipt`
レシート画像を解析して在庫情報を抽出

### `/api/generate-recipe`
在庫と好みからレシピを生成

### `/api/parse-recipe-text`
URL/テキストからレシピ情報を抽出

### `/api/parse-recipe-image`
画像からレシピ情報を抽出

### `/api/update-preferences`
レシピ評価から好みを学習・更新

## セキュリティ

- Row Level Security (RLS) を全テーブルに適用
- ユーザーは自分のデータのみアクセス可能
- Supabase Authによる認証

## ライセンス

MIT




