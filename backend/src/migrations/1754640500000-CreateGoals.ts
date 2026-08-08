import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateGoals1754640500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'goals',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'team_id', type: 'uuid' },
          { name: 'title', type: 'varchar' },
          { name: 'description', type: 'text', default: "''" },
          { name: 'start_date', type: 'date' },
          { name: 'deadline', type: 'date' },
          {
            name: 'status',
            type: 'enum',
            enum: ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
            enumName: 'goal_status_enum',
            default: "'PLANNED'",
          },
          {
            name: 'importance',
            type: 'enum',
            enum: ['LOW', 'MEDIUM', 'HIGH'],
            enumName: 'goal_importance_enum',
          },
          { name: 'created_by_id', type: 'uuid' },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            name: 'FK_goals_team_id',
            columnNames: ['team_id'],
            referencedTableName: 'teams',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'FK_goals_created_by_id',
            columnNames: ['created_by_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('goals');
    await queryRunner.query('DROP TYPE "goal_importance_enum"');
    await queryRunner.query('DROP TYPE "goal_status_enum"');
  }
}
