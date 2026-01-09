-- 制約の確認
SELECT 
    conname AS constraint_name,
    CASE contype
        WHEN 'u' THEN 'UNIQUE'
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'f' THEN 'FOREIGN KEY'
        ELSE contype::text
    END AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'employees'::regclass
ORDER BY conname;

