-- Add is_pinned column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from UUID REFERENCES users(id);
