# GitHubアカウント確認手順

## 問題

Vercelの「Connect Git Repository」画面で、他のプロジェクト（`beauty-reservation-system`、`buddybow`）は「Connect」ボタンが表示されるが、`rakupochi-kintai`が表示されない。

## 考えられる原因

1. **GitHubリポジトリがまだ作成されていない**
2. **Vercelに接続されているGitHubアカウントと、リポジトリが存在するアカウントが異なる**
3. **リポジトリが別のアカウントや組織にある**

## 確認手順

### 1. Vercelに接続されているGitHubアカウントを確認

1. Vercelダッシュボードにログイン
2. プロジェクト `rakupochi-kintai` を選択
3. 「Settings」→「Git」を開く
4. 「Connected Git Repository」セクションで、接続されているGitHubアカウントを確認
   - 画像では `takasakimo` が選択されているようです

### 2. GitHubリポジトリの存在確認

以下のURLにアクセスして、リポジトリが存在するか確認：

- `https://github.com/takasakimo/rakupochi-kintai`
- または、他の可能性のあるアカウント:
  - `https://github.com/YOUR_OTHER_ACCOUNT/rakupochi-kintai`

### 3. リポジトリが存在しない場合

#### 方法A: GitHubでリポジトリを作成

1. https://github.com/new にアクセス
2. リポジトリ名: `rakupochi-kintai`
3. 公開設定を選択
4. 「Create repository」をクリック
5. **重要**: README、.gitignore、ライセンスは追加しない（既存のコードをプッシュするため）

#### 方法B: ローカルからGitHubにプッシュ

```bash
cd /Users/takasakimotonobu/rakupochi-kintai

# GitHubリモートを追加（takasakimoを実際のユーザー名に置き換え）
git remote add origin https://github.com/takasakimo/rakupochi-kintai.git

# 変更をコミット
git add .
git commit -m "Initial commit"

# GitHubにプッシュ
git push -u origin main
```

### 4. 別のGitHubアカウントにリポジトリがある場合

#### オプション1: 正しいアカウントにVercelを接続

1. Vercelダッシュボード → Settings → Git
2. 「Switch Git Provider」をクリック
3. 正しいGitHubアカウントを選択
4. リポジトリを接続

#### オプション2: リポジトリを現在のアカウントに移行

1. GitHubでリポジトリの「Settings」→「Transfer ownership」
2. 移行先のアカウントを選択

## 確認用コマンド

```bash
# ローカルのGitリモート設定を確認
git remote -v

# GitHubリポジトリの存在確認（ブラウザで確認）
open https://github.com/takasakimo/rakupochi-kintai
```

## 次のステップ

1. 上記の確認を行い、リポジトリが存在するアカウントを特定
2. リポジトリが存在しない場合は作成
3. コードをGitHubにプッシュ
4. Vercelダッシュボードで「Connect Git Repository」を再度確認
