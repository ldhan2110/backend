import { Injectable } from '@nestjs/common';
import { SqlMapper } from '@infra/database/mapper';
import { UserInfoDto } from '../dtos/auth.response.dto';

/** Internal credential projection — not a response DTO (never serialized to a client). */
export class CredentialDto {
  userId: string;
  passwordHash: string;
  activeFlag: string;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly mapper: SqlMapper) {}

  findCredential(userId: string): Promise<CredentialDto | null> {
    return this.mapper.selectOne(CredentialDto, this.mapper.named('auth.findCredential'), { userId });
  }

  async existsUser(userId: string): Promise<boolean> {
    const rows = await this.mapper.execute(CredentialDto, this.mapper.named('auth.exists'), { userId });
    return rows.length > 0;
  }

  insertUser(userId: string, passwordHash: string, by: string): Promise<number> {
    return this.mapper.insert(this.mapper.named('auth.insert'), { userId, passwordHash, by });
  }

  findProfile(userId: string): Promise<UserInfoDto | null> {
    return this.mapper.selectOne(UserInfoDto, this.mapper.named('auth.findProfile'), { userId });
  }
}
