-- データベースの制約を確認
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'employees'::regclass
AND (conname LIKE '%employeeNumber%' OR conname LIKE '%companyId%')
ORDER BY conname;


