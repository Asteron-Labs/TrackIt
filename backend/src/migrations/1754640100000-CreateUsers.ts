import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { UserRole } from '../modules/users/users.entity';

export class CreateUsers1754640100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            isGenerated: true,
          },
          { name: 'email', type: 'varchar', isUnique: true },
          { name: 'password_hash', type: 'varchar' },
          { name: 'name', type: 'varchar' },
          {
            name: 'role',
            type: 'enum',
            enum: Object.values(UserRole),
            enumName: 'user_role_enum',
          },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
    await queryRunner.query('DROP TYPE "user_role_enum"');
  }
}
