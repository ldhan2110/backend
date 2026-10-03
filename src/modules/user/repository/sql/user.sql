-- name: base
SELECT * FROM users;

-- name: findById
SELECT * FROM users WHERE id = #{id};

-- name: insert
INSERT INTO users (email, status, created_by, updated_by)
VALUES (#{email}, #{status}, #{by}, #{by});

-- name: updateEmail
UPDATE users SET email = #{email}, updated_by = #{by} WHERE id = #{id};

-- name: countByStatus
SELECT status, count(*)::int AS total FROM users GROUP BY status;

-- name: remove
DELETE FROM users WHERE id = #{id};
