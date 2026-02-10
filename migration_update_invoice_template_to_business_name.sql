-- 請求書費目テンプレートを{employeeName}から{businessName}に変更
-- 既存のテンプレートで{employeeName}を使用している場合は{businessName}に置換
UPDATE companies 
SET "invoiceItemNameTemplate" = REPLACE("invoiceItemNameTemplate", '{employeeName}', '{businessName}')
WHERE "invoiceItemNameTemplate" LIKE '%{employeeName}%';

-- デフォルト値が設定されていない場合は{businessName}委託費用を設定
UPDATE companies 
SET "invoiceItemNameTemplate" = '{businessName}委託費用' 
WHERE "invoiceItemNameTemplate" IS NULL;
