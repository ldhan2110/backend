import { applyDecorators, Type, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

/**
 * Single-file multipart upload for any controller. Wires the multer interceptor
 * and the Swagger `multipart/form-data` docs in one decorator.
 *
 * The file arrives via `@UploadedFile() file: MulterFile`; any other form fields
 * arrive via `@Body() dto` as usual — pass that DTO as `body` so Swagger renders
 * the file field alongside the text fields.
 *
 * ```ts
 * @Post('avatar')
 * @UploadFile({ body: UploadAvatarDto })
 * upload(@UploadedFile() file: MulterFile, @Body() dto: UploadAvatarDto, @CurrentUser() id: string) {
 *   return this.storage.save(file, UploadTarget.AVATAR, id); // StorageService
 * }
 * ```
 */
export function UploadFile(options: { field?: string; body?: Type<unknown> } = {}) {
  const field = options.field ?? 'file';
  return applyDecorators(
    UseInterceptors(FileInterceptor(field)),
    ApiConsumes('multipart/form-data'),
    ...(options.body ? [ApiBody({ type: options.body })] : []),
  );
}
