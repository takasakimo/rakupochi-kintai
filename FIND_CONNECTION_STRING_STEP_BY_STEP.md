# 接続文字列の見つけ方（ステップバイステップ）

## 現在の画面から

現在、Database Schema（データベーススキーマ）の画面を見ていますね。接続文字列は別の場所にあります。

## 手順

### ステップ1: 左側メニューを確認

現在の画面の**左側メニュー**を見てください。以下のような項目があるはずです：

- Table Editor
- SQL Editor
- Database
- **Settings** ← これを探してください！

### ステップ2: Settingsを開く

左側メニューの**一番下の方**にある **「Settings」**（⚙️ 歯車のアイコン）をクリックしてください。

### ステップ3: Databaseを選択

Settingsメニューが開いたら、以下のような項目が表示されます：

- General
- API
- Auth
- **Database** ← これをクリックしてください
- Storage
- Edge Functions
- など

### ステップ4: ページを下にスクロール

Database設定ページを開いたら、**ページを下にスクロール**してください。

上から順に以下のセクションがあります：
1. Database password（データベースパスワード）
2. Connection info（接続情報）
3. Connection pooling configuration（接続プール設定）
4. **Connection string** ← **ここです！**

### ステップ5: Connection stringセクション

「Connection string」という見出しの下に、複数のタブがあります：

- **URI**
- **Connection pooling** ← これを選択！
- JDBC
- Golang
- Python
- Node.js

### ステップ6: 接続文字列をコピー

1. **「Connection pooling」** タブをクリック
2. **「Session mode」** を選択
3. 表示された接続文字列をコピー

## もし見つからない場合

### 方法A: ブラウザの検索機能

1. Settings → Database ページを開く
2. `Cmd + F`（Mac）または `Ctrl + F`（Windows）で検索
3. 「**Connection string**」と入力
4. 見つかった場所をクリック

### 方法B: 直接URLでアクセス

以下のURLパターンで直接アクセス：

```
https://supabase.com/dashboard/project/qhjefghdnsyordbdkqyf/settings/database
```

### 方法C: 手動で作成

もし見つからない場合は、以下の形式で手動で作成できます：

```
postgresql://postgres.qhjefghdnsyordbdkqyf:Moto0625@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

または

```
postgresql://postgres:Moto0625@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**注意**: リージョンが `ap-northeast-1` 以外の可能性があります。プロジェクト作成時に選択したリージョンを確認してください。

