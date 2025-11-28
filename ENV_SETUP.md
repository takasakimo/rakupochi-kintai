# 環境変数の設定方法

## NEXTAUTH設定の確認・設定方法

### 1. Vercelダッシュボードで確認・設定（推奨）

1. **Vercelダッシュボードにアクセス**
   - https://vercel.com にログイン
   - プロジェクト `rakupochi-kintai` を選択

2. **環境変数の設定画面へ**
   - プロジェクトページで「Settings」タブをクリック
   - 左メニューから「Environment Variables」を選択

3. **必要な環境変数を追加**
   
   以下の環境変数を追加してください：

   | 変数名 | 値 | 説明 |
   |--------|-----|------|
   | `DATABASE_URL` | `postgresql://...` | PostgreSQLデータベースの接続文字列 |
   | `NEXTAUTH_URL` | `https://your-domain.vercel.app` | デプロイされたアプリのURL |
   | `NEXTAUTH_SECRET` | ランダムな文字列 | 認証用の秘密鍵 |

4. **環境の選択**
   - Production（本番環境）
   - Preview（プレビュー環境）
   - Development（開発環境）
   
   すべての環境に設定することを推奨します。

### 2. Vercel CLIで確認・設定

```bash
# プロジェクトディレクトリに移動
cd rakupochi-kintai

# 環境変数の一覧を表示
vercel env ls

# 環境変数を追加
vercel env add NEXTAUTH_URL
vercel env add NEXTAUTH_SECRET
vercel env add DATABASE_URL

# 環境変数を削除
vercel env rm NEXTAUTH_SECRET
```

### 3. NEXTAUTH_SECRETの生成方法

```bash
# macOS/Linux
openssl rand -base64 32

# または、Node.jsを使用
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

生成された文字列を`NEXTAUTH_SECRET`の値として設定してください。

### 4. 現在の設定を確認

```bash
# ローカル環境変数をVercelから取得
vercel env pull .env.local

# .env.localファイルを確認
cat .env.local
```

### 5. 設定後の再デプロイ

環境変数を追加・変更した後は、再デプロイが必要です：

```bash
# 再デプロイ
vercel --prod
```

または、Vercelダッシュボードで「Deployments」タブから「Redeploy」をクリック。

## 現在の設定値

現在の環境変数は以下のコマンドで確認できます：

```bash
vercel env ls
```

## トラブルシューティング

### 認証が動作しない場合

1. `NEXTAUTH_URL`が正しいURLに設定されているか確認
2. `NEXTAUTH_SECRET`が設定されているか確認
3. ブラウザのコンソールでエラーを確認
4. Vercelのログを確認：
   ```bash
   vercel logs
   ```

### データベース接続エラーの場合

1. `DATABASE_URL`が正しいか確認
2. データベースが起動しているか確認
3. 接続文字列の形式を確認：
   ```
   postgresql://ユーザー名:パスワード@ホスト:ポート/データベース名?schema=public
   ```

