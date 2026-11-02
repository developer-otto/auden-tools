-- Applied explicitly with `pnpm --filter web db:migrate`, never at build time.
CREATE TABLE IF NOT EXISTS auden_conversion_jobs (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  owner text GENERATED ALWAYS AS (payload->>'owner') STORED,
  status text GENERATED ALWAYS AS (payload->>'status') STORED,
  created bigint GENERATED ALWAYS AS ((payload->>'createdAt')::bigint) STORED,
  expires bigint GENERATED ALWAYS AS ((payload->>'expiresAt')::bigint) STORED,
  reserved bigint GENERATED ALWAYS AS ((payload->>'reservedBytes')::bigint) STORED,
  CHECK (status IN ('uploading','queued','running','succeeded','failed','cancelled'))
);
CREATE INDEX IF NOT EXISTS auden_conversion_owner ON auden_conversion_jobs(owner, created DESC);
CREATE INDEX IF NOT EXISTS auden_conversion_expiry ON auden_conversion_jobs(expires);
-- Keep quota events separately: deleting jobs must not reset the hourly limit.
CREATE TABLE IF NOT EXISTS auden_conversion_submissions (owner text NOT NULL, created bigint NOT NULL);
CREATE INDEX IF NOT EXISTS auden_conversion_quota ON auden_conversion_submissions(owner, created);

CREATE OR REPLACE FUNCTION auden_reserve_conversion(job jsonb, budget bigint)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  owner_id text := job->>'owner';
  now_ms bigint := (job->>'createdAt')::bigint;
BEGIN
  -- Serialize the reservation check across Function instances.
  PERFORM pg_advisory_xact_lock(618734902);
  IF (SELECT count(*) FROM auden_conversion_jobs WHERE owner = owner_id AND status IN ('uploading','queued','running')) >= 2
    OR (SELECT count(*) FROM auden_conversion_submissions WHERE owner = owner_id AND created > now_ms - 3600000) >= 20 THEN
    RAISE EXCEPTION 'RATE_LIMIT';
  END IF;
  IF (SELECT count(*) FROM auden_conversion_jobs) >= 100
    OR (SELECT coalesce(sum(reserved), 0) FROM auden_conversion_jobs) + (job->>'reservedBytes')::bigint > budget THEN
    RAISE EXCEPTION 'BUSY';
  END IF;
  INSERT INTO auden_conversion_jobs(id, payload) VALUES (job->>'id', job);
  INSERT INTO auden_conversion_submissions VALUES (owner_id, now_ms);
  RETURN job;
END;
$$;
