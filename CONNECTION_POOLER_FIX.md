# 接続プールURLの修正方法

## 現在の状況
- 直接接続URL（5432）: ✅ 動作中
- 接続プールURL（6543）: ❌ "Tenant or user not found" エラー

## Supabaseダッシュボードで確認すべき項目

1. **Settings → Database → Connection string**
   - Connection pooling タブを選択
   - Session mode と Transaction mode の両方を確認
   - 表示された接続文字列をコピー

2. **Settings → Database → Connection pooling**
   - Connection pooling が有効になっているか確認
   - Pool mode が正しく設定されているか確認

3. **Settings → Database → Connection info**
   - Database password が正しいか確認
   - Project reference ID が正しいか確認

## 推奨される接続文字列の形式

### Transaction mode（Prisma推奨）
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&transaction_mode=transaction
```

### Session mode
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

## 現在の動作している接続文字列（直接接続）
```
postgresql://postgres:Moto0625@db.qhjefghdnsyordbdkqyf.supabase.co:5432/postgres
```

## 注意事項
- 直接接続URLでも、Vercelのサーバーレス環境では接続が再利用されるため、実質的な問題は少ない
- Prismaクライアントも接続プーリングを行うため、接続数制限に達する可能性は低い
- 接続数が増える場合は、Supabaseのサポートに問い合わせることを推奨

