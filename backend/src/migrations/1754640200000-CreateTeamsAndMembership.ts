import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from 'typeorm';

export class CreateTeamsAndMembership1754640200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'teams',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            isGenerated: true,
          },
          { name: 'name', type: 'varchar', isUnique: true },
          { name: 'lead_id', type: 'uuid', isNullable: true },
        ],
        foreignKeys: [
          {
            name: 'FK_teams_lead_id',
            columnNames: ['lead_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
    );

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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('users', 'FK_users_team_id');
    await queryRunner.dropColumn('users', 'team_id');
    await queryRunner.dropTable('teams');
  }
}
