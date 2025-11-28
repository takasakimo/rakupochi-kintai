# データベース接続エラーの解決方法

## エラー: "Can't reach database server"

このエラーは、Supabaseデータベースに接続できないことを示しています。

## 解決方法

### 1. Supabaseの接続文字列を確認

Supabaseダッシュボードで以下を確認してください：

1. **Supabaseダッシュボードにログイン**
   - https://supabase.com/dashboard

2. **プロジェクトを選択**

3. **Settings → Database** を開く

4. **接続文字列を確認**
   - "Connection string" セクション
   - "URI" または "Connection pooling" を選択
   - **重要**: 本番環境では "Connection pooling" を使用することを推奨

### 2. 接続文字列の形式

Supabaseでは、以下の2つの接続方法があります：

#### 直接接続（Direct Connection）
```
postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

#### 接続プール（Connection Pooling）- 推奨
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**本番環境では接続プールを使用することを強く推奨します。**

### 3. Vercel環境変数の更新

1. **Vercelダッシュボード**でプロジェクトを開く
2. **Settings → Environment Variables** を開く
3. `DATABASE_URL` を編集
4. Supabaseの接続プールURLに変更
5. すべての環境（Production, Preview, Development）に設定
6. **Save** をクリック

### 4. 接続文字列の例

```
postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**パラメータの説明：**
- `pgbouncer=true`: 接続プーリングを有効化
- `connection_limit=1`: Vercelのサーバーレス環境に適した設定

### 5. 再デプロイ

環境変数を更新した後、再デプロイを実行：

```bash
vercel --prod
```

または、Vercelダッシュボードで「Deployments」→「Redeploy」をクリック。

### 6. 接続確認

再デプロイ後、シードAPIに再度アクセス：

```
https://rakupochi-kintai.vercel.app/api/admin/seed
```

成功メッセージが表示されれば、接続は正常です。

## トラブルシューティング

### 接続がタイムアウトする場合

1. Supabaseプロジェクトがアクティブか確認
2. データベースが一時停止していないか確認
3. IPアドレスの制限がないか確認（Supabaseの設定で確認）

### SSL接続エラーの場合

接続文字列に `?sslmode=require` を追加：

```
postgresql://...?sslmode=require&pgbouncer=true
```

### 認証エラーの場合

1. パスワードが正しいか確認
2. Supabaseのパスワードをリセット
3. 新しい接続文字列を取得

