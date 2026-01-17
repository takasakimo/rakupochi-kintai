# らくっぽ勤怠（正式版）

中小企業向けWebベース勤怠管理システム

## 技術スタック

- **Frontend/Backend**: Next.js 14+ (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: NextAuth.js v5
- **UI**: Material-UI (MUI) または shadcn/ui
- **State Management**: Zustand
- **PWA**: next-pwa

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example`をコピーして`.env`を作成し、必要な値を設定してください。

```bash
cp .env.example .env
```

### 3. データベースのセットアップ

```bash
# マイグレーション実行
npm run db:migrate

# シードデータ投入（オプション）
npm run db:seed
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## 主要機能

### 従業員向け機能
- 4段階打刻（起床、出発、出勤、退勤）
- GPS位置情報取得（出勤・退勤時のみ）
- 打刻修正申請
- 残業事前申請
- 休暇申請
- 経費精算申請
- シフト管理

### 管理者向け機能
- ダッシュボード
- 従業員管理
- 打刻データ管理
- 申請承認管理
- シフト作成・編集
- レポート出力

### 自動アラート機能
- 残業時間アラート（40時間、60時間）
- 打刻忘れ通知
- 有給失効前通知
- 連続勤務アラート

## プロジェクト構造

```
├── app/                    # Next.js App Router
│   ├── (auth)/            # 認証関連ページ
│   ├── (employee)/        # 従業員向けページ
│   ├── (admin)/           # 管理者向けページ
│   └── api/               # API Routes
├── components/            # Reactコンポーネント
├── lib/                   # ユーティリティ関数
├── prisma/                # Prismaスキーマ
├── types/                 # TypeScript型定義
└── public/                # 静的ファイル
```

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# 本番ビルド
npm run build

# 本番サーバー起動
npm start

# データベースマイグレーション
npm run db:migrate

# Prisma Studio起動
npm run db:studio
```
