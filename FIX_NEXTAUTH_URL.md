# NEXTAUTH_URLの設定方法

## 問題
`NEXTAUTH_URL`が空文字列になっているため、ビルドエラーが発生しています。

## 解決方法

### 1. デプロイURLを確認
Vercelダッシュボードで、プロジェクトのデプロイURLを確認してください。
通常は以下の形式です：
- `https://rakupochi-kintai-[hash].vercel.app`

または、カスタムドメインが設定されている場合：
- `https://your-domain.com`

### 2. NEXTAUTH_URLを設定

#### 方法1: Vercelダッシュボード
1. https://vercel.com にログイン
2. プロジェクト `rakupochi-kintai` を選択
3. 「Settings」→「Environment Variables」を開く
4. `NEXTAUTH_URL` を探して編集、または新規追加
5. 値にデプロイURLを設定（例：`https://rakupochi-kintai-xxx.vercel.app`）
6. すべての環境（Production, Preview, Development）に設定
7. 「Save」をクリック

#### 方法2: Vercel CLI
```bash
cd /Users/takasakimotonobu/rakupochi-kintai

# NEXTAUTH_URLを削除（既存の空の値を削除）
vercel env rm NEXTAUTH_URL production
vercel env rm NEXTAUTH_URL preview
vercel env rm NEXTAUTH_URL development

# 正しいURLで再設定
vercel env add NEXTAUTH_URL production
# プロンプトが表示されたら、デプロイURLを入力（例：https://rakupochi-kintai-xxx.vercel.app）

vercel env add NEXTAUTH_URL preview
# 同じURLを入力

vercel env add NEXTAUTH_URL development
# 開発環境の場合は http://localhost:3000 を入力
```

### 3. 再デプロイ
環境変数を更新した後、再デプロイを実行：
```bash
vercel --prod
```

または、Vercelダッシュボードで「Deployments」→「Redeploy」をクリック。

## 注意事項
- `NEXTAUTH_URL`は、アプリケーションがアクセス可能な完全なURLである必要があります
- プロトコル（`https://`）を含める必要があります
- 末尾にスラッシュ（`/`）は不要です

