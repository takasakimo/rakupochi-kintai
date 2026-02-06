# 請求書機能 実装手順書

## 概要
勤怠システムに請求書作成機能を追加します。請求先企業マスタを管理し、従業員に紐づけて、勤怠データから自動的に請求書を生成します。

## 実装ステップ

### フェーズ1: データベーススキーマ設計・実装
- [x] 1.1 Prismaスキーマに請求先企業マスタテーブルを追加
- [x] 1.2 Prismaスキーマに請求書テーブルを追加
- [x] 1.3 Prismaスキーマに請求明細テーブルを追加
- [x] 1.4 Employeeテーブルに請求関連フィールドを追加
- [x] 1.5 マイグレーション実行 ✅
- [x] 1.6 Prisma Client再生成

### フェーズ2: 請求先企業マスタ管理機能
- [x] 2.1 請求先企業マスタ一覧ページ作成 (`/app/admin/billing-clients/page.tsx`)
- [x] 2.2 請求先企業マスタ作成API作成 (`/app/api/admin/billing-clients/route.ts`)
- [x] 2.3 請求先企業マスタ取得API作成
- [x] 2.4 請求先企業マスタ更新API作成 (`/app/api/admin/billing-clients/[id]/route.ts`)
- [x] 2.5 請求先企業マスタ削除API作成
- [x] 2.6 請求先企業マスタ作成フォーム実装
- [x] 2.7 請求先企業マスタ編集機能実装
- [x] 2.8 サイドバーに「請求先企業管理」メニュー追加

### フェーズ3: 従業員管理への請求情報追加
- [x] 3.1 従業員管理ページに請求情報セクション追加 ✅
- [x] 3.2 クライアント情報プルダウン実装 ✅
- [x] 3.3 請求単価入力欄追加 ✅
- [x] 3.4 残業の有無チェックボックス追加 ✅
- [x] 3.5 残業単価倍率入力欄追加 ✅
- [x] 3.6 稼働日数のベース入力欄追加 ✅
- [x] 3.7 従業員更新APIに請求情報フィールド追加 ✅
- [x] 3.8 従業員一覧に請求先企業情報表示 ✅

### フェーズ4: 請求書管理機能（基本）
- [ ] 4.1 請求書一覧ページ作成 (`/app/admin/invoices/page.tsx`)
- [ ] 4.2 請求書作成API作成 (`/app/api/admin/invoices/route.ts`)
- [ ] 4.3 請求書取得API作成
- [ ] 4.4 請求書更新API作成 (`/app/api/admin/invoices/[id]/route.ts`)
- [ ] 4.5 請求書削除API作成
- [ ] 4.6 請求書一覧表示実装
- [ ] 4.7 サイドバーに「請求書管理」メニュー追加

### フェーズ5: 請求書作成フォーム
- [ ] 5.1 請求書作成ページ作成 (`/app/admin/invoices/new/page.tsx`)
- [ ] 5.2 請求先企業選択プルダウン実装
- [ ] 5.3 請求期間選択実装
- [ ] 5.4 請求書番号自動採番機能実装
- [ ] 5.5 対象従業員選択機能実装（チェックボックス）
- [ ] 5.6 請求書基本情報入力フォーム実装

### フェーズ6: 勤怠データからの自動計算機能
- [ ] 6.1 請求期間の勤怠データ取得API作成
- [ ] 6.2 勤務日数計算ロジック実装
- [ ] 6.3 基本金額計算ロジック実装
- [ ] 6.4 残業時間計算ロジック実装（残業の有無がONの場合）
- [ ] 6.5 残業金額計算ロジック実装
- [ ] 6.6 欠勤判定・減算計算ロジック実装
- [ ] 6.7 遅刻・早退判定・減算計算ロジック実装
- [ ] 6.8 明細自動生成機能実装
- [ ] 6.9 合計金額自動計算機能実装

### フェーズ7: 請求書編集機能
- [ ] 7.1 請求書編集ページ作成 (`/app/admin/invoices/[id]/edit/page.tsx`)
- [ ] 7.2 明細の手動編集機能実装
- [ ] 7.3 交通費入力機能実装
- [ ] 7.4 調整金額入力機能実装
- [ ] 7.5 消費税計算機能実装
- [ ] 7.6 請求書保存機能実装（下書き状態）

### フェーズ8: 請求書PDF生成機能
- [ ] 8.1 PDF生成ライブラリ導入（react-pdf または pdfkit）
- [ ] 8.2 請求書PDFテンプレート作成
- [ ] 8.3 PDF生成API作成 (`/app/api/admin/invoices/[id]/pdf/route.ts`)
- [ ] 8.4 請求書発行機能実装（ステータス更新 + PDF生成）
- [ ] 8.5 PDFダウンロード機能実装

### フェーズ9: UI/UX改善
- [ ] 9.1 請求書一覧のフィルタリング機能
- [ ] 9.2 請求書一覧の検索機能
- [ ] 9.3 請求書コピー機能実装
- [ ] 9.4 バリデーション実装
- [ ] 9.5 エラーハンドリング実装
- [ ] 9.6 ローディング状態の表示

### フェーズ10: テスト・デプロイ
- [ ] 10.1 単体テスト作成
- [ ] 10.2 統合テスト作成
- [ ] 10.3 動作確認
- [ ] 10.4 デプロイ

## データベーススキーマ詳細

### BillingClient (請求先企業マスタ)
```prisma
model BillingClient {
  id              Int       @id @default(autoincrement())
  companyId       Int       // 請求元企業（aimsなど）
  name            String    // 請求先企業名
  code            String?   // 請求先企業コード
  address         String?   // 住所
  phone           String?   // 電話番号
  fax             String?   // FAX番号
  contactPerson   String?   // 担当者名
  bankName        String?   // 銀行名
  bankBranch      String?   // 支店名
  accountNumber   String?   // 口座番号
  accountHolder   String?   // 口座名義
  taxRate         Float     @default(0.1) // 消費税率（10% = 0.1）
  invoiceNumberPrefix String? // 請求書番号プレフィックス
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  company         Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employees       Employee[]
  invoices        Invoice[]
  
  @@map("billing_clients")
}
```

### Invoice (請求書)
```prisma
model Invoice {
  id              Int       @id @default(autoincrement())
  companyId       Int       // 請求元企業
  billingClientId Int       // 請求先企業
  invoiceNumber   String    @unique // 請求書番号
  subject         String    // 件名
  periodStart     DateTime  @db.Date // 請求期間開始
  periodEnd       DateTime  @db.Date // 請求期間終了
  paymentTerms    String    // 代金決済条件
  dueDate         DateTime  @db.Date // お支払い期日
  subtotal        Int       // 小計（税抜）
  taxAmount       Int       // 消費税額
  totalAmount     Int       // 合計金額（税込）
  transportationCost Int?   @default(0) // 交通費
  adjustmentAmount Int?     @default(0) // 調整金額
  status          String    @default("draft") // draft, issued, billed, paid
  issuedAt        DateTime? // 発行日
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  company         Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  billingClient   BillingClient @relation(fields: [billingClientId], references: [id], onDelete: Cascade)
  details         InvoiceDetail[]
  
  @@map("invoices")
}
```

### InvoiceDetail (請求明細)
```prisma
model InvoiceDetail {
  id              Int       @id @default(autoincrement())
  invoiceId       Int
  employeeId      Int
  workDays        Int       // 勤務日数
  basicRate       Int       // 基本単価
  basicAmount     Int       // 基本金額
  overtimeHours   Float?    @default(0) // 残業時間
  overtimeRate    Float?    // 残業単価
  overtimeAmount  Int?      @default(0) // 残業金額
  absenceDays     Int?      @default(0) // 欠勤日数
  absenceDeduction Int?     @default(0) // 欠勤減算額
  lateEarlyDeduction Int?   @default(0) // 遅刻・早退減算額
  subtotal        Int       // 小計
  
  invoice         Invoice   @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  employee        Employee  @relation(fields: [employeeId], references: [id])
  
  @@map("invoice_details")
}
```

### Employee テーブルへの追加フィールド
```prisma
model Employee {
  // ... 既存フィールド
  billingClientId Int?      // 請求先企業ID（追加）
  billingRate     Int?      // 請求単価（時給または日給）
  overtimeRate    Float?    @default(1.25) // 残業単価倍率
  hasOvertime     Boolean   @default(false) // 残業の有無
  baseWorkDays    Int?      @default(22) // 稼働日数のベース（月間）
  
  billingClient   BillingClient? @relation(fields: [billingClientId], references: [id])
}
```

## 進捗記録

### 完了したステップ
- **フェーズ1: データベーススキーマ設計・実装** ✅ 完了
  - 1.1 Prismaスキーマに請求先企業マスタテーブルを追加 ✅
  - 1.2 Prismaスキーマに請求書テーブルを追加 ✅
  - 1.3 Prismaスキーマに請求明細テーブルを追加 ✅
  - 1.4 Employeeテーブルに請求関連フィールドを追加 ✅
  - 1.5 マイグレーション実行 ✅
  - 1.6 Prisma Client再生成 ✅

- **フェーズ2: 請求先企業マスタ管理機能** ✅ 完了
  - 2.1 請求先企業マスタ一覧ページ作成 ✅
  - 2.2 請求先企業マスタ作成API作成 ✅
  - 2.3 請求先企業マスタ取得API作成 ✅
  - 2.4 請求先企業マスタ更新API作成 ✅
  - 2.5 請求先企業マスタ削除API作成 ✅
  - 2.6 請求先企業マスタ作成フォーム実装 ✅
  - 2.7 請求先企業マスタ編集機能実装 ✅
  - 2.8 サイドバーに「請求先企業管理」メニュー追加 ✅

### 現在の進捗
- フェーズ: フェーズ3完了、フェーズ4開始準備完了
- 完了率: 30%（3/10フェーズ完了）

### 備考・メモ
- **2026/02/04**: フェーズ1完了 ✅
  - BillingClient（請求先企業マスタ）、Invoice（請求書）、InvoiceDetail（請求明細）テーブルを追加
  - Employeeテーブルに請求関連フィールド（billingClientId, billingRate, overtimeRate, hasOvertime, baseWorkDays）を追加
  - マイグレーションSQLファイル（`migration_add_invoice_tables.sql`）を作成し、SQLEditorで実行完了

- **2026/02/04**: フェーズ2完了 ✅
  - 請求先企業マスタ管理ページ（`/app/admin/billing-clients/page.tsx`）を作成
  - CRUD APIエンドポイント（`/api/admin/billing-clients`）を作成
  - サイドバーに「請求先企業管理」メニューを追加
  - 次のフェーズ: 従業員管理への請求情報追加

- **2026/02/04**: フェーズ3完了 ✅
  - 従業員管理ページに請求情報セクションを追加（交通費セクションの後）
  - 請求先企業プルダウンを実装（`/api/admin/billing-clients`から取得）
  - 請求単価、残業の有無、残業単価倍率、稼働日数のベース入力欄を追加
  - 従業員更新API（`/api/admin/employees/[id]`）に請求情報フィールドを追加
  - 従業員一覧取得API（`/api/admin/employees`）に請求情報フィールドと請求先企業情報を追加
  - 従業員一覧カードに請求先企業情報と請求単価を表示
  - 次のフェーズ: 請求書管理機能（基本）
