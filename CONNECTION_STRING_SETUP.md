# 接続文字列の設定方法

## 重要なポイント

VercelはIPv4ネットワークを使用しているため、**Direct connection**ではなく**Connection pooling**を使用する必要があります。

## 手順

1. Supabaseダッシュボードの「Connect to your project」モーダルを開く
2. 「Connection String」タブを選択
3. **「Method」ドロップダウンで「Connection pooling」を選択**
4. 表示された接続文字列をコピー
5. `[YOUR_PASSWORD]` を実際のパスワード（`Moto0625`）に置き換える

## 期待される接続文字列の形式

Connection poolingを選択すると、以下のような形式の接続文字列が表示されるはずです：

```
postgresql://postgres:[YOUR_PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true
```

または

```
postgresql://postgres.qhjefghdnsyordbdkqyf:[YOUR_PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true
```

## 注意点

- ポート番号は **6543**（接続プール）を使用
- ホスト名に **pooler** が含まれる
- クエリパラメータに **pgbouncer=true** が含まれる

