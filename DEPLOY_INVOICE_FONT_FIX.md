# 請求書PDF日本語フォント修正のデプロイ手順

## 変更内容

1. **日本語フォントサポートの追加**
   - jsPDFで日本語を表示するためのフォント読み込み機能を追加
   - フォントファイル: `public/fonts/NotoSansJP-Regular.ttf` (5.2MB)

2. **PDFフォーマットの修正**
   - 提供されたPDFサンプルに合わせてフォーマットを修正
   - 明細テーブルの構造を変更

3. **フォント読み込み処理の改善**
   - デバッグログの追加
   - autoTableでのフォント指定を改善

## デプロイ手順

### 1. 変更をコミット

```bash
cd /Users/takasakimotonobu/rakupochi-kintai

# 変更を確認
git status

# フォントファイルとPDF生成コードの変更をコミット
git add app/api/admin/invoices/[id]/pdf/route.ts
git add public/fonts/NotoSansJP-Regular.ttf
git commit -m "fix: 請求書PDFの日本語フォント対応とフォーマット修正"
```

### 2. GitHubにプッシュ

```bash
git push origin main
```

### 3. Vercelへのデプロイ

#### 方法1: Vercel CLIを使用（推奨）

```bash
# Vercel CLIがインストールされていない場合
npm i -g vercel

# ログイン（初回のみ）
vercel login

# 本番環境にデプロイ
vercel --prod
```

#### 方法2: GitHub連携を使用

GitHubにプッシュすると、Vercelが自動的にデプロイを開始します。

### 4. デプロイ後の確認

1. **フォントファイルの確認**
   - Vercelダッシュボードで「Deployments」を確認
   - ビルドログにエラーがないか確認
   - `public/fonts/NotoSansJP-Regular.ttf` が含まれているか確認

2. **PDF生成のテスト**
   - 本番環境で請求書PDFを生成
   - 日本語が正しく表示されることを確認
   - フォーマットが正しいことを確認

3. **サーバーログの確認**
   - Vercelダッシュボードの「Functions」→「Logs」で確認
   - 以下のログが表示されることを確認:
     - `Loading Japanese font from: ...`
     - `Japanese font loaded successfully`

## 注意事項

- フォントファイルは5.2MBと大きいため、Gitリポジトリのサイズが増加します
- Vercelのデプロイ時間が少し長くなる可能性があります
- フォントファイルは`.gitignore`に含めないでください（本番環境で必要）

## トラブルシューティング

### フォントファイルがデプロイされない場合

1. `.gitignore`に`public/fonts/`が含まれていないか確認
2. Gitリポジトリにフォントファイルが含まれているか確認:
   ```bash
   git ls-files public/fonts/NotoSansJP-Regular.ttf
   ```

### デプロイ後も文字化けする場合

1. サーバーログでフォント読み込みエラーがないか確認
2. フォントファイルのパスが正しいか確認（`public/fonts/NotoSansJP-Regular.ttf`）
3. ブラウザのキャッシュをクリアして再テスト
