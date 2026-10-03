import { databaseConfig } from "@config/database.config";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
    imports: [TypeOrmModule.forRoot(databaseConfig()),]
})
export class DatabaseModule {}