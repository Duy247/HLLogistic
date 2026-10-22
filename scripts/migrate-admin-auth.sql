BEGIN;
CREATE TABLE IF NOT EXISTS admin_users (
 id bigserial PRIMARY KEY,
 username text UNIQUE NOT NULL,
 password_hash text NOT NULL,
 enabled boolean NOT NULL DEFAULT true,
 session_version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
 scope text NOT NULL, bucket text NOT NULL, hits bigint NOT NULL,
 expires_at timestamptz NOT NULL, PRIMARY KEY (scope, bucket)
);
CREATE INDEX IF NOT EXISTS rate_limit_expiry ON rate_limit_buckets(expires_at);
-- A scope-wide transaction lock serializes the two counters across all instances.
CREATE OR REPLACE FUNCTION consume_rate_limit(p_scope text, p_ip text, p_window integer, p_ip_limit integer, p_global_limit integer)
RETURNS TABLE(allowed boolean, retry_after integer) LANGUAGE plpgsql AS $$
DECLARE t timestamptz; expiry timestamptz;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('rate-limit:' || p_scope, 0));
 t := clock_timestamp();
 DELETE FROM rate_limit_buckets WHERE scope = p_scope AND expires_at <= t;
 SELECT max(expires_at) INTO expiry FROM rate_limit_buckets
 WHERE scope = p_scope AND ((bucket = 'global' AND hits >= p_global_limit) OR (bucket = p_ip AND hits >= p_ip_limit));
 IF expiry IS NOT NULL THEN
   RETURN QUERY SELECT false, greatest(1, ceil(extract(epoch FROM expiry - t))::integer);
   RETURN;
 END IF;
 INSERT INTO rate_limit_buckets(scope, bucket, hits, expires_at)
 VALUES (p_scope, 'global', 1, t + make_interval(secs => p_window)), (p_scope, p_ip, 1, t + make_interval(secs => p_window))
 ON CONFLICT(scope, bucket) DO UPDATE SET hits = rate_limit_buckets.hits + 1;
 RETURN QUERY SELECT true, 0;
END;
$$;
COMMIT;
