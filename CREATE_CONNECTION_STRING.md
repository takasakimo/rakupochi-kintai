# 接続文字列を手動で作成する方法

もしSupabaseダッシュボードで接続文字列が見つからない場合、以下の情報から手動で作成できます。

## 必要な情報

1. **プロジェクト参照（Project Reference）**
   - SupabaseダッシュボードのURLから確認できます
   - 例: `https://supabase.com/dashboard/project/qhjefghdnsyordbdkqyf`
   - この場合、プロジェクト参照は `qhjefghdnsyordbdkqyf`

2. **データベースパスワード**
   - Settings → Database の上部にある「Database password」セクションで確認
   - わからない場合は「Reset database password」でリセット

3. **リージョン**
   - 通常は `ap-northeast-1`（東京リージョン）
   - プロジェクト作成時に選択したリージョン

## 接続文字列のテンプレート

### 接続プール（推奨）
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

### 実際の例
プロジェクト参照が `qhjefghdnsyordbdkqyf` で、リージョンが `ap-northeast-1` の場合：

```
postgresql://postgres.qhjefghdnsyordbdkqyf:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

## 手順

1. 上記のテンプレートをコピー
2. `[PROJECT-REF]` を実際のプロジェクト参照に置き換え
3. `[YOUR-PASSWORD]` をデータベースパスワードに置き換え
4. `[REGION]` をリージョンに置き換え（通常は `ap-northeast-1`）

## プロジェクト参照の確認方法

1. SupabaseダッシュボードのURLを確認
2. または、Settings → General で確認できる場合があります

