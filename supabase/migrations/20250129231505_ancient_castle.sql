/*
  # Add foreign key relationship between points_leaderboard and wallet_profiles

  1. Changes
    - Create missing wallet_profiles entries for existing points_leaderboard addresses
    - Add foreign key constraint from points_leaderboard.address to wallet_profiles.address

  2. Notes
    - Ensures data integrity by creating missing profile entries before adding the constraint
    - Uses ON DELETE SET NULL to allow profile deletion without affecting points
*/

-- First, insert missing wallet profiles
INSERT INTO wallet_profiles (address)
SELECT DISTINCT pl.address
FROM points_leaderboard pl
LEFT JOIN wallet_profiles wp ON wp.address = pl.address
WHERE wp.address IS NULL;

-- Now we can safely add the foreign key constraint
ALTER TABLE points_leaderboard
ADD CONSTRAINT fk_wallet_profile
FOREIGN KEY (address)
REFERENCES wallet_profiles (address)
ON DELETE SET NULL
ON UPDATE CASCADE;