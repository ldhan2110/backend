-- name: findCredential
SELECT user_id, password_hash, active_flag FROM users WHERE user_id = #{userId};

-- name: exists
SELECT 1 AS one FROM users WHERE user_id = #{userId};

-- name: insert
INSERT INTO users (user_id, password_hash, active_flag, created_by, updated_by)
VALUES (#{userId}, #{passwordHash}, 'Y', #{by}, #{by});

-- name: findProfile
SELECT user_id, active_flag, created_at, created_by, updated_at, updated_by
FROM users WHERE user_id = #{userId};
