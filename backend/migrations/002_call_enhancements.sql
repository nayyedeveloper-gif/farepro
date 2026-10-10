-- Call history enhancements
ALTER TABLE calls ADD COLUMN IF NOT EXISTS call_result VARCHAR(20) DEFAULT 'unknown';
ALTER TABLE call_participants ADD COLUMN IF NOT EXISTS call_status VARCHAR(20) DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_calls_initiated_by ON calls(initiated_by);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_participants_user ON call_participants(user_id);

-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
