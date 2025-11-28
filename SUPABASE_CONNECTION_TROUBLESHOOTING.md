# Supabase接続プールURLのトラブルシューティング

## 現在のエラー

「Tenant or user not found」エラーが発生しています。

## 接続プールURLの正しい形式

Supabaseの接続プールURLには複数の形式があります。以下を試してください：

### 形式1: プロジェクト参照を含む（推奨）
```
postgresql://postgres.qhjefghdnsyordbdkqyf:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### 形式2: 通常のpostgresユーザー
```
postgresql://postgres:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### 形式3: リージョンが異なる場合
リージョンが `ap-northeast-1` 以外の可能性があります。以下を確認：
- `us-east-1` (バージニア)
- `us-west-1` (カリフォルニア)
- `eu-west-1` (アイルランド)
- `ap-southeast-1` (シンガポール)

## リージョンの確認方法

1. Supabaseダッシュボードで Settings → General を開く
2. 「Region」セクションでリージョンを確認
3. または、プロジェクト作成時のメールを確認

## 接続プールが利用できない場合

接続プールが利用できない場合は、直接接続を使用することもできますが、サーバーレス環境では接続が切れる可能性があります：

```
postgresql://postgres:[PASSWORD]@db.qhjefghdnsyordbdkqyf.supabase.co:5432/postgres?sslmode=require
```

## 次のステップ

1. Supabaseダッシュボードで Settings → Database → Connection string を再度確認
2. 「Connection pooling」タブで表示される接続文字列をそのままコピー
3. パスワード部分のみ置き換え
4. Vercel環境変数に設定

