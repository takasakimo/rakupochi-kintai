-- マイグレーション: contactPersonNameカラムを追加
-- このSQLを本番データベースで実行してください

-- contactPersonNameカラムが存在しない場合のみ追加
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sales_visits' 
        AND column_name = 'contactPersonName'
    ) THEN
        ALTER TABLE "sales_visits" ADD COLUMN "contactPersonName" TEXT;
        RAISE NOTICE 'contactPersonNameカラムを追加しました';
    ELSE
        RAISE NOTICE 'contactPersonNameカラムは既に存在します';
    END IF;
END $$;
