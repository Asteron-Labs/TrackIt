import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateTasks1754640600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tasks',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'goal_id', type: 'uuid' },
          { name: 'title', type: 'varchar' },
          { name: 'description', type: 'text', default: "''" },
          {
            name: 'status',
            type: 'enum',
            enum: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'],
            enumName: 'task_status_enum',
            default: "'TODO'",
          },
          {
            name: 'priority',
            type: 'enum',
            enum: ['LOW', 'MEDIUM', 'HIGH'],
            enumName: 'task_priority_enum',
          },
          { name: 'estimated_hours', type: 'double precision' },
          { name: 'due_date', type: 'date' },
          { name: 'assignee_id', type: 'uuid', isNullable: true },
          {
            name: 'business_impact',
            type: 'enum',
            enum: ['LOW', 'MEDIUM', 'HIGH'],
            enumName: 'task_business_impact_enum',
            isNullable: true,
          },
          { name: 'priority_score', type: 'integer', isNullable: true },
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
            name: 'FK_tasks_goal_id',
            columnNames: ['goal_id'],
            referencedTableName: 'goals',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'FK_tasks_assignee_id',
            columnNames: ['assignee_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'tasks',
      new TableIndex({ name: 'IDX_tasks_goal_id', columnNames: ['goal_id'] }),
    );
    await queryRunner.createIndex(
      'tasks',
      new TableIndex({ name: 'IDX_tasks_assignee_id', columnNames: ['assignee_id'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tasks');
    await queryRunner.query('DROP TYPE "task_business_impact_enum"');
    await queryRunner.query('DROP TYPE "task_priority_enum"');
    await queryRunner.query('DROP TYPE "task_status_enum"');
  }
}
