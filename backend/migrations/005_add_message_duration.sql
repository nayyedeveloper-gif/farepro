-- Add duration column to messages table for voice messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 0;
