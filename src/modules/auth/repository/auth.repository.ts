import { Injectable } from '@nestjs/common';
import { SqlMapper } from '@infra/database/mapper';
import { UserInfoResponseDto, CredentialDto } from '../dtos/auth.response.dto';

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

  findProfile(userId: string): Promise<UserInfoResponseDto | null> {
    return this.mapper.selectOne(UserInfoResponseDto, this.mapper.named('auth.findProfile'), { userId });
  }
}
