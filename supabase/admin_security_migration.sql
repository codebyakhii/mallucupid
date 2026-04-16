-- Admin Security Questions Table
-- Used for admin login verification (5 security questions)
-- Answers verified server-side via verify_admin_security() RPC function

CREATE TABLE IF NOT EXISTS admin_security_questions (
  id SERIAL PRIMARY KEY,
  question_order INTEGER NOT NULL UNIQUE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS: only admin role can read
ALTER TABLE admin_security_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_questions_select 
  ON admin_security_questions 
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Server-side verification function (SECURITY DEFINER = runs with table owner privileges)
-- Takes JSONB answers { "1": "answer1", "2": "answer2", ... }
-- Returns TRUE only if all answers match and caller is admin
CREATE OR REPLACE FUNCTION verify_admin_security(p_answers JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_question RECORD;
  v_provided TEXT;
  v_correct_count INT := 0;
  v_total INT := 0;
BEGIN
  -- Only allow admin users
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN FALSE;
  END IF;

  -- Compare each answer
  FOR v_question IN 
    SELECT question_order, answer 
    FROM admin_security_questions 
    ORDER BY question_order
  LOOP
    v_total := v_total + 1;
    v_provided := p_answers ->> v_question.question_order::text;
    IF v_provided IS NOT NULL AND v_provided = v_question.answer THEN
      v_correct_count := v_correct_count + 1;
    END IF;
  END LOOP;

  RETURN v_total > 0 AND v_correct_count = v_total;
END;
$$;

-- Seed data (5 security questions)
INSERT INTO admin_security_questions (question_order, question, answer) VALUES
  (1, 'Most lovable person name', '5656565656'),
  (2, 'Most hated person name', '56565656'),
  (3, 'Why this role?', '565656'),
  (4, 'DOB', '5656'),
  (5, 'A or B or C?', '56')
ON CONFLICT (question_order) 
DO UPDATE SET question = EXCLUDED.question, answer = EXCLUDED.answer;
