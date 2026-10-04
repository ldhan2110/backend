-- name: base
SELECT user_id, active_flag, created_at, created_by, updated_at, updated_by FROM users;

-- name: findById
SELECT user_id, active_flag, created_at, created_by, updated_at, updated_by
FROM users WHERE user_id = #{userId};

-- name: countByActive
SELECT active_flag, count(*)::int AS total FROM users GROUP BY active_flag;

-- name: remove
DELETE FROM users WHERE user_id = #{userId};
