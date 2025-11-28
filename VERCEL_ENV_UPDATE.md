# Vercel環境変数の更新方法

## 接続プールURL

以下の接続文字列をVercelの環境変数に設定してください：

```
postgresql://postgres.qhjefghdnsyordbdkqyf:Moto0625@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

## 設定手順

### 方法1: Vercelダッシュボード

1. https://vercel.com にログイン
2. プロジェクト `rakupochi-kintai` を選択
3. **「Settings」** タブをクリック
4. 左メニューから **「Environment Variables」** を選択
5. `DATABASE_URL` を探して編集、または新規追加
6. 上記の接続文字列を貼り付け
7. すべての環境（Production, Preview, Development）にチェック
8. **「Save」** をクリック

### 方法2: Vercel CLI

```bash
cd /Users/takasakimotonobu/rakupochi-kintai

# 既存のDATABASE_URLを削除
vercel env rm DATABASE_URL production --yes
vercel env rm DATABASE_URL preview --yes
vercel env rm DATABASE_URL development --yes

# 新しい接続プールURLを設定
echo "postgresql://postgres.qhjefghdnsyordbdkqyf:Moto0625@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true" | vercel env add DATABASE_URL production

echo "postgresql://postgres.qhjefghdnsyordbdkqyf:Moto0625@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true" | vercel env add DATABASE_URL preview

echo "postgresql://postgres.qhjefghdnsyordbdkqyf:Moto0625@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true" | vercel env add DATABASE_URL development
```

## 変更点

**変更前（直接接続）:**
```
postgresql://postgres:Moto0625@db.qhjefghdnsyordbdkqyf.supabase.co:5432/postgres
```

**変更後（接続プール）:**
```
postgresql://postgres.qhjefghdnsyordbdkqyf:Moto0625@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

## 再デプロイ

環境変数を更新した後、再デプロイを実行：

```bash
vercel --prod
```

または、Vercelダッシュボードで「Deployments」→「Redeploy」をクリック。

