# Supabase接続文字列の見つけ方（詳細手順）

## 方法1: Supabaseダッシュボードで確認

### ステップ1: プロジェクトを開く
1. https://supabase.com/dashboard にログイン
2. 左側のプロジェクト一覧から、使用するプロジェクトをクリック

### ステップ2: Settingsを開く
左側のメニュー（サイドバー）を確認：
- 一番下の方に **「Settings」**（⚙️ 歯車のアイコン）があります
- クリックしてください

### ステップ3: Databaseを選択
Settingsメニューが開いたら：
- **「Database」** という項目を探してください
- クリックしてください

### ステップ4: ページを下にスクロール
Database設定ページを**下にスクロール**してください：
- 上から順に：
  - Database password（データベースパスワード）
  - Connection info（接続情報）
  - Connection pooling configuration（接続プール設定）← これは設定画面
  - **Connection string** ← これが接続文字列のセクションです！

### ステップ5: Connection stringセクションを探す
「Connection string」という見出しを探してください：
- その下に複数のタブがあります：
  - **URI**
  - **Connection pooling** ← これを選択！
  - JDBC
  - Golang
  - Python
  - Node.js

### ステップ6: Connection poolingタブを選択
1. **「Connection pooling」** タブをクリック
2. **「Session mode」** を選択（Transaction modeでも可）
3. 接続文字列が表示されます

### ステップ7: 接続文字列をコピー
表示された接続文字列をコピーしてください。

例：
```
postgresql://postgres.qhjefghdnsyordbdkqyf:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**注意**: `[YOUR-PASSWORD]` の部分は、同じページの上部にある「Database password」セクションで確認またはリセットできます。

## 方法2: ブラウザの検索機能を使用

1. Supabaseダッシュボードで Settings → Database を開く
2. ブラウザの検索機能を使用：
   - Mac: `Cmd + F`
   - Windows: `Ctrl + F`
3. 検索ボックスに **「Connection string」** と入力
4. 該当箇所にジャンプします

## 方法3: 直接URLでアクセス

以下のURLパターンで直接アクセスできる場合があります：
```
https://supabase.com/dashboard/project/[PROJECT-ID]/settings/database
```

## 接続文字列が見つからない場合の確認事項

1. **正しいプロジェクトを選択していますか？**
   - 複数のプロジェクトがある場合、間違ったプロジェクトを開いている可能性があります

2. **Settings → Database を開いていますか？**
   - Settings内の他のセクション（例：API、Auth）ではなく、Databaseを開いているか確認

3. **ページを十分にスクロールしましたか？**
   - Connection stringセクションはページの下の方にあります

4. **Supabaseのプランで接続プールが利用可能ですか？**
   - 無料プランでも利用可能ですが、確認してください

## 接続文字列の形式

正しい接続文字列は以下の形式です：

```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**特徴：**
- `postgres.[PROJECT-REF]` - プロジェクト参照が含まれる
- `pooler.supabase.com` - 接続プーラーを使用
- `6543` - 接続プールのポート番号
- `pgbouncer=true` - 接続プーリングパラメータ

## 次のステップ

接続文字列を見つけたら：
1. パスワード部分を確認（Database passwordセクションで確認）
2. Vercelの環境変数 `DATABASE_URL` に設定
3. 再デプロイ

