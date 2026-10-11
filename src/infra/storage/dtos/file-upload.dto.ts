import { ApiProperty } from '@nestjs/swagger';

/**
 * Base multipart upload body. Extend it per endpoint to add text fields:
 *
 * ```ts
 * export class UploadAvatarDto extends FileUploadDto {
 *   @ApiProperty() @IsString() label: string;
 * }
 * ```
 */
export class FileUploadDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'File to upload' })
  file!: unknown;
}
