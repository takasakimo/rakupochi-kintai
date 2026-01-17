# 環境変数の設定方法（AI Kitchen Partner）

## ステップ1: `.env.local`ファイルを作成

プロジェクトのルートディレクトリ（`package.json`がある場所）に`.env.local`ファイルを作成します。

### 方法1: ターミナルで作成

```bash
cd /Users/takasakimotonobu/rakupochi-kintai
touch .env.local
```

### 方法2: エディタで作成

1. プロジェクトフォルダを開く
2. ルートディレクトリに新しいファイルを作成
3. ファイル名を`.env.local`にする（先頭のドットを忘れずに）

## ステップ2: Supabaseの設定値を取得

### 2-1. Supabaseアカウントの作成（まだの場合）

1. https://supabase.com にアクセス
2. 「Start your project」をクリック
3. GitHubアカウントでログイン（推奨）またはメールアドレスで登録

### 2-2. 新しいプロジェクトを作成

1. Supabaseダッシュボードで「New Project」をクリック
2. プロジェクト名を入力（例：`ai-kitchen-partner`）
3. データベースパスワードを設定（メモしておく）
4. リージョンを選択（`Northeast Asia (Tokyo)`推奨）
5. 「Create new project」をクリック
6. プロジェクトの作成完了を待つ（1-2分）

### 2-3. SupabaseのURLとキーを取得

1. プロジェクトダッシュボードの左メニューから「Settings」（⚙️アイコン）をクリック
2. 「API」をクリック
3. 以下の値をコピー：
   - **Project URL**: `https://xxxxx.supabase.co` の形式
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` の形式（長い文字列）

## ステップ3: OpenAI APIキーの取得

### 3-1. OpenAIアカウントの作成（まだの場合）

1. https://platform.openai.com にアクセス
2. 「Sign up」をクリックしてアカウント作成
3. メールアドレスを確認

### 3-2. APIキーの作成

1. https://platform.openai.com/api-keys にアクセス
2. 「Create new secret key」をクリック
3. キー名を入力（例：`AI Kitchen Partner`）
4. 「Create secret key」をクリック
5. **重要**: 表示されたキーをコピー（この画面を閉じると二度と見れません）
   - 形式：`sk-...` で始まる長い文字列

### 3-3. クレジットの追加（必要に応じて）

1. https://platform.openai.com/account/billing にアクセス
2. 「Add payment method」をクリック
3. クレジットカード情報を入力
4. 使用量に応じて課金されます（GPT-4o-miniは比較的安価）

## ステップ4: `.env.local`ファイルに値を設定

`.env.local`ファイルを開き、以下の内容を貼り付け、実際の値に置き換えてください：

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI API Key
OPENAI_API_KEY=sk-...

# Database URL (Supabaseの接続文字列)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

### 各値の説明

- `NEXT_PUBLIC_SUPABASE_URL`: ステップ2-3で取得したProject URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: ステップ2-3で取得したanon public key
- `OPENAI_API_KEY`: ステップ3-2で取得したAPIキー
- `DATABASE_URL`: Supabaseの接続文字列
  - 取得方法：
    1. Supabaseダッシュボード → Settings → Database
    2. 「Connection string」セクション
    3. 「URI」タブを選択
    4. `[YOUR-PASSWORD]`の部分をプロジェクト作成時に設定したパスワードに置き換え

## ステップ5: 設定の確認

### ファイルの内容を確認

```bash
cat .env.local
```

以下のように表示されればOKです（実際の値は異なります）：

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DATABASE_URL=postgresql://postgres:yourpassword@db.abcdefghijklmnop.supabase.co:5432/postgres
```

## ステップ6: データベースのセットアップ

環境変数を設定したら、Supabaseでデータベーススキーマを作成します。

1. Supabaseダッシュボード → 「SQL Editor」をクリック
2. 「New query」をクリック
3. `supabase/migrations/001_initial_schema.sql`の内容をコピー＆ペースト
4. 「Run」ボタンをクリック
5. 「Success. No rows returned」と表示されれば成功

## トラブルシューティング

### `.env.local`が読み込まれない場合

1. ファイル名が正確か確認（`.env.local`で、`.env.local.txt`ではない）
2. プロジェクトのルートディレクトリにあるか確認
3. 開発サーバーを再起動：
   ```bash
   # Ctrl+Cで停止してから
   npm run dev
   ```

### Supabaseの接続エラー

1. URLとキーが正しくコピーされているか確認
2. Supabaseプロジェクトがアクティブか確認
3. ネットワーク接続を確認

### OpenAI APIエラー

1. APIキーが正しく設定されているか確認
2. クレジット残高を確認（https://platform.openai.com/account/billing）
3. APIキーに権限があるか確認

## 次のステップ

環境変数の設定が完了したら：

1. 依存関係をインストール：
   ```bash
   npm install
   ```

2. 開発サーバーを起動：
   ```bash
   npm run dev
   ```

3. ブラウザで http://localhost:3000 を開く







