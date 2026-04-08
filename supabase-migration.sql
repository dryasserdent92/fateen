-- ===================================================
-- فطين — تحديث قاعدة البيانات للنسخة الأولى
-- نفّذ هذا في Supabase → SQL Editor
-- ===================================================

-- 1) إضافة عمود user_id لجدول expenses (إذا لم يكن موجوداً)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2) إنشاء index لتسريع الاستعلامات حسب المستخدم
CREATE INDEX IF NOT EXISTS expenses_user_id_idx ON expenses(user_id);

-- 3) تفعيل Row Level Security على جدول expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 4) سياسة: كل مستخدم يرى فقط مصاريفه
DROP POLICY IF EXISTS "Users can view own expenses" ON expenses;
CREATE POLICY "Users can view own expenses"
  ON expenses FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IS NULL  -- للسجلات القديمة قبل تفعيل الـ auth
  );

-- 5) سياسة: كل مستخدم يضيف مصاريفه فقط
DROP POLICY IF EXISTS "Users can insert own expenses" ON expenses;
CREATE POLICY "Users can insert own expenses"
  ON expenses FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR user_id IS NULL
  );

-- 6) سياسة: كل مستخدم يحذف مصاريفه فقط
DROP POLICY IF EXISTS "Users can delete own expenses" ON expenses;
CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE
  USING (
    user_id = auth.uid()
    OR user_id IS NULL
  );

-- ===================================================
-- انتهى — الجدول جاهز لإطلاق النسخة الأولى
-- ===================================================
