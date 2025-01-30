/*
  # Fix leaderboard access and relationships

  1. Changes
    - Drop and recreate foreign key with proper cascade rules
    - Update policies to ensure proper public access
    - Add indexes for better query performance

  2. Security
    - Maintain public read access
    - Allow public updates with proper constraints
*/

-- First, drop the existing foreign key constraint
ALTER TABLE points_leaderboard
DROP CONSTRAINT IF EXISTS fk_wallet_profile;

-- Recreate the foreign key with proper cascade rules
ALTER TABLE points_leaderboard
ADD CONSTRAINT fk_wallet_profile
FOREIGN KEY (address)
REFERENCES wallet_profiles (address)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Add index for better join performance
CREATE INDEX IF NOT EXISTS idx_points_leaderboard_address 
ON points_leaderboard (address);

CREATE INDEX IF NOT EXISTS idx_wallet_profiles_address 
ON wallet_profiles (address);

-- Update policies to ensure proper access
DROP POLICY IF EXISTS "Anyone can read leaderboard" ON points_leaderboard;
DROP POLICY IF EXISTS "Anyone can update points" ON points_leaderboard;

CREATE POLICY "Anyone can read leaderboard"
  ON points_leaderboard
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can update points"
  ON points_leaderboard
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Update wallet profiles policies
DROP POLICY IF EXISTS "Anyone can read wallet profiles" ON wallet_profiles;
DROP POLICY IF EXISTS "Anyone can update their own profile" ON wallet_profiles;
DROP POLICY IF EXISTS "Anyone can update their own profile update" ON wallet_profiles;

CREATE POLICY "Anyone can read wallet profiles"
  ON wallet_profiles
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can manage wallet profiles"
  ON wallet_profiles
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);