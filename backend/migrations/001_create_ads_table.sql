-- Create ads table
CREATE TABLE IF NOT EXISTS ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('image', 'video', 'html')),
  content_url TEXT NOT NULL,
  target_url TEXT,
  duration INTEGER DEFAULT 5 CHECK (duration > 0 AND duration <= 30),
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on is_active and dates for faster active ads query
CREATE INDEX IF NOT EXISTS idx_ads_active ON ads(is_active, start_date, end_date) WHERE is_active = true;

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_ads_created_at ON ads(created_at DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ads_updated_at BEFORE UPDATE ON ads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample ads for testing
INSERT INTO ads (title, description, type, content_url, target_url, duration, is_active) VALUES
  ('Sample Image Ad', 'This is a sample image advertisement', 'image', 'https://via.placeholder.com/800x400/4A90E2/ffffff?text=Sample+Ad', 'https://example.com', 5, true),
  ('Sample Video Ad', 'This is a sample video advertisement', 'video', 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', 'https://example.com', 10, true)
ON CONFLICT DO NOTHING;
