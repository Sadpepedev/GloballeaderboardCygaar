/*
  # Add cron job for daily points update
  
  1. Changes
    - Enable pg_cron extension
    - Create function to handle HTTP request
    - Create scheduled task to update points daily at 00:00:01 UTC
*/

-- Enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to handle the HTTP request
CREATE OR REPLACE FUNCTION public.trigger_points_update()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_url text;
  edge_key text;
BEGIN
  -- Get the Edge Function URL and key from settings
  edge_url := current_setting('app.edge_function_url');
  edge_key := current_setting('app.edge_function_key');
  
  -- Make the HTTP request
  PERFORM net.http_post(
    url := edge_url || '/update-points',
    headers := json_build_object('Authorization', 'Bearer ' || edge_key)::jsonb
  );
END;
$$;

-- Create the scheduled task
SELECT cron.schedule(
  'update-points-daily',    -- name of the cron job
  '1 0 * * *',             -- schedule (1 minute past midnight, every day)
  'SELECT public.trigger_points_update();'
);