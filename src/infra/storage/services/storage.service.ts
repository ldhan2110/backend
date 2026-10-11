import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transactional } from '@nestjs-cls/transactional';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { HASH_ALGO, SHARD_DEPTH } from '../constants/storage.constants';
import { UPLOAD_TARGETS, UploadTarget } from '../constants/upload-target';
import { FileRecordDto, FileResponseDto } from '../dtos/file.response.dto';
import { DuplicateFileException, FileNotFoundException } from '../exceptions/file.exception';
import { StorageRepository } from '../repository/storage.repository';

/** Minimal shape of a multer-parsed upload — avoids a @types/multer dependency. */
export interface MulterFile {
  buffer: Buffer;
  originalname: string;
  size: number;
  mimetype: string;
}

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = '23505';

/**
 * Content-addressed file store: disk layer (hash/shard/write/stream) plus the
 * database metadata and validation. Other modules inject this and call `save()`
 * from their own endpoints; this module only exposes a download route.
 */
@Injectable()
export class StorageService {
  private readonly root: string;
  private readonly maxSize: number;
  private readonly allowedMime: string[];

  constructor(
    private readonly files: StorageRepository,
    config: ConfigService,
  ) {
    this.root = resolve(config.get<string>('file.dir', 'uploads'));
    this.maxSize = config.get<number>('file.maxSize', 10 * 1024 * 1024);
    this.allowedMime = config.get<string[]>('file.allowedMime', []);
  }

  /**
   * Persist an uploaded file under `target`. Rejects an oversize/disallowed
   * upload and identical content already stored at the same path.
   */
  @Transactional()
  async save(
    file: MulterFile | undefined,
    target: UploadTarget,
    by: string,
  ): Promise<FileResponseDto> {
    if (!file) throw new BadRequestException('No file provided');
    if (!UPLOAD_TARGETS.includes(target)) {
      throw new BadRequestException(`Unknown upload target: ${target}`);
    }
    if (file.size > this.maxSize) {
      throw new BadRequestException(`File exceeds the maximum size of ${this.maxSize} bytes`);
    }
    if (this.allowedMime.length && !this.allowedMime.includes(file.mimetype)) {
      throw new BadRequestException(`Content type ${file.mimetype} is not allowed`);
    }

    const extension = extname(file.originalname).slice(1).toLowerCase();
    const filePath = `${target}/${this.relPathFor(this.hash(file.buffer), extension)}`;

    if (await this.files.findByPath(filePath)) throw new DuplicateFileException();

    // Write the blob first; writing identical bytes to the same path is idempotent.
    await this.write(filePath, file.buffer);

    const fileId = randomUUID();
    try {
      await this.files.insert(
        {
          fileId,
          filePath,
          fileName: file.originalname,
          fileSize: file.size,
          fileExtension: extension,
        },
        by,
      );
    } catch (err) {
      // A concurrent save of identical content lost the race on UNIQUE(file_path).
      if ((err as { code?: string })?.code === UNIQUE_VIOLATION) throw new DuplicateFileException();
      throw err;
    }

    const saved = await this.files.findById(fileId);
    if (!saved) throw new FileNotFoundException(fileId);
    return this.toResponse(saved);
  }

  async download(fileId: string): Promise<{ record: FileRecordDto; stream: ReadStream }> {
    const record = await this.files.findById(fileId);
    if (!record) throw new FileNotFoundException(fileId);
    return { record, stream: this.createReadStream(record.filePath) };
  }

  /** Content hash (hex) of the given bytes. */
  hash(buffer: Buffer): string {
    return createHash(HASH_ALGO).update(buffer).digest('hex');
  }

  /** Relative path for a hash: SHARD_DEPTH two-char levels, then `<hash>.<ext>`. */
  relPathFor(hash: string, extension: string): string {
    const shards: string[] = [];
    for (let i = 0; i < SHARD_DEPTH; i++) shards.push(hash.slice(i * 2, i * 2 + 2));
    const name = extension ? `${hash}.${extension}` : hash;
    return [...shards, name].join('/');
  }

  /** Write bytes at a relative path, creating shard directories on demand. */
  async write(relPath: string, buffer: Buffer): Promise<void> {
    const abs = join(this.root, relPath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, buffer);
  }

  createReadStream(relPath: string): ReadStream {
    return createReadStream(join(this.root, relPath));
  }

  async exists(relPath: string): Promise<boolean> {
    try {
      await access(join(this.root, relPath));
      return true;
    } catch {
      return false;
    }
  }

  private toResponse(record: FileRecordDto): FileResponseDto {
    const dto = new FileResponseDto();
    dto.fileId = record.fileId;
    dto.fileName = record.fileName;
    dto.fileSize = record.fileSize;
    dto.fileExtension = record.fileExtension;
    dto.createdAt = record.createdAt;
    dto.createdBy = record.createdBy;
    dto.updatedAt = record.updatedAt;
    dto.updatedBy = record.updatedBy;
    return dto;
  }
}
