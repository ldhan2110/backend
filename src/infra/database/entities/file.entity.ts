import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('files')
export class File extends BaseEntity {
  @PrimaryColumn({ name: 'file_id', type: 'varchar', length: 36 })
  fileId: string;

  @Column({ name: 'file_path', type: 'varchar', length: 255, unique: true })
  filePath: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'file_size', type: 'int' })
  fileSize: number;

  @Column({ name: 'file_extension', type: 'varchar', length: 20 })
  fileExtension: string;

  @Column({ name: 'active_flag', type: 'char', length: 1, default: 'Y' })
  activeFlag: string;
}
