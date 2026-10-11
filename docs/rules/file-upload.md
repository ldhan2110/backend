# File Upload

File storage is **infra**, not a feature module. One service —
`StorageService` (`src/infra/storage/`) — owns disk + DB + validation. Feature
modules don't re-implement upload; they inject `StorageService` and call
`save()` from their own endpoint.

## Layout

```
src/infra/storage/
  storage.module.ts                    provides+exports StorageService; declares StorageController
  services/storage.service.ts          hash/shard/write/stream + save/download/validate; exports MulterFile
  repository/storage.repository.ts     file metadata via SqlMapper
  repository/sql/file.sql              named queries (namespace: file.*)
  controllers/storage.controller.ts    GET /files/:id download only
  decorators/upload-file.decorator.ts  @UploadFile() — multer + Swagger multipart
  dtos/file.response.dto.ts            FileResponseDto (out), FileRecordDto (internal)
  dtos/file-upload.dto.ts              FileUploadDto base (binary field)
  constants/upload-target.ts           UploadTarget enum + UPLOAD_TARGETS
```

`StorageModule` is already wired through `InfraModule` — no `app.module` change.

## Add an upload endpoint (in a feature module)

1. Import `StorageModule`? No — `StorageService` is exported and `InfraModule`
   is global-reachable. Just inject it.
2. Pick/extend a target in `UploadTarget`. The target is the top path segment:
   `<target>/<shard>/<hash>.<ext>`.
3. DTO: extend `FileUploadDto` to add text fields.
4. Route: `@UploadFile({ body: Dto })`, `@UploadedFile() file: MulterFile`,
   `@Body() dto`. Pass the caller's id as `by` (audit).

```ts
import { StorageService, MulterFile } from '@infra/storage/services/storage.service';
import { UploadFile } from '@infra/storage/decorators/upload-file.decorator';
import { FileUploadDto } from '@infra/storage/dtos/file-upload.dto';
import { UploadTarget } from '@infra/storage/constants/upload-target';

export class UploadAvatarDto extends FileUploadDto {
  @ApiProperty() @IsString() label: string;
}

@Post('avatar')
@UploadFile({ body: UploadAvatarDto })
upload(@UploadedFile() file: MulterFile, @Body() dto: UploadAvatarDto, @CurrentUser() id: string) {
  return this.storage.save(file, UploadTarget.AVATAR, id);
}
```

Download is served centrally at `GET /files/:id` — don't add per-module
download routes.

## Contract

| Piece | Rule |
|---|---|
| `save(file, target, by)` | validates size/mime, content-addresses, dedupes on `UNIQUE(file_path)`, returns `FileResponseDto` |
| `UploadTarget` | add a value here before using a new target; unknown target → `400` |
| `@UploadFile({ field?, body? })` | `field` = form field (default `file`); `body` = **Swagger docs only** — form fields reach `@Body()` without it |
| Validation | size/mime enforced in `save()` via config; per-field rules via `class-validator` on the extended DTO |
| Dedupe | identical bytes at the same `<target>` path → `DuplicateFileException` (409) |
| Multer | default memory storage, no pre-buffer size limit — `save()` rejects after buffering |

## Config (env)

| Var | Meaning | Default |
|---|---|---|
| `UPLOAD_DIR` | storage root (rel/abs) | `uploads` |
| `UPLOAD_MAX_SIZE` | max bytes | `10485760` (10 MB) |
| `UPLOAD_ALLOWED_MIME` | comma allowlist; empty = any | *(empty)* |

## Schema

The `files` table (entity `src/infra/database/entities/file.entity.ts`) already
exists. A new target needs no schema change. Any column change ships as a
migration — see [`migration.md`](migration.md).

## Self-check

- [ ] Endpoint lives in the feature module; upload logic stays in `StorageService`.
- [ ] New target added to `UploadTarget`.
- [ ] `by` (caller id) passed to `save()`.
- [ ] No duplicate download route; use `GET /files/:id`.
- [ ] SQL stays `#{}`-bound in `file.sql`.
