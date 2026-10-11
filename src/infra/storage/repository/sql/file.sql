-- name: findById
SELECT file_id, file_path, file_name, file_size, file_extension,
       created_at, created_by, updated_at, updated_by
FROM files WHERE file_id = #{fileId};

-- name: findByPath
SELECT file_id, file_path, file_name, file_size, file_extension,
       created_at, created_by, updated_at, updated_by
FROM files WHERE file_path = #{filePath};

-- name: insert
INSERT INTO files (file_id, file_path, file_name, file_size, file_extension, created_by, updated_by)
VALUES (#{fileId}, #{filePath}, #{fileName}, #{fileSize}, #{fileExtension}, #{by}, #{by});
