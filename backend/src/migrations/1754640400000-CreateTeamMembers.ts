import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from 'typeorm';

export class CreateTeamMembers1754640400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'team_members',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'team_id', type: 'uuid' },
          { name: 'user_id', type: 'uuid' },
          {
            name: 'joined_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        uniques: [
          {
            name: 'UQ_team_members_team_user',
            columnNames: ['team_id', 'user_id'],
          },
          {
            name: 'UQ_team_members_user',
            columnNames: ['user_id'],
          },
        ],
        foreignKeys: [
          {
            name: 'FK_team_members_team_id',
            columnNames: ['team_id'],
            referencedTableName: 'teams',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_team_members_user_id',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    await queryRunner.query(`
      INSERT INTO team_members (team_id, user_id, joined_at)
      SELECT team_id, id, CURRENT_TIMESTAMP
      FROM users
      WHERE team_id IS NOT NULL
    `);

    await queryRunner.dropForeignKey('users', 'FK_users_team_id');
    await queryRunner.dropColumn('users', 'team_id');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({ name: 'team_id', type: 'uuid', isNullable: true }),
    );
    await queryRunner.createForeignKey(
      'users',
      new TableForeignKey({
        name: 'FK_users_team_id',
        columnNames: ['team_id'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.query(`
      UPDATE users
      SET team_id = team_members.team_id
      FROM team_members
      WHERE team_members.user_id = users.id
    `);

    await queryRunner.dropTable('team_members');
  }
}
