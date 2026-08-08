import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateTimesheetEntries1754640700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'timesheet_entries',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'employee_id', type: 'uuid' },
          { name: 'task_id', type: 'uuid' },
          { name: 'work_date', type: 'date' },
          { name: 'hours_spent', type: 'numeric' },
          { name: 'work_note', type: 'text', default: "''" },
          {
            name: 'submission_status',
            type: 'enum',
            enum: ['SUBMITTED'],
            enumName: 'timesheet_submission_status_enum',
            default: "'SUBMITTED'",
          },
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
            name: 'FK_timesheet_entries_employee_id',
            columnNames: ['employee_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'FK_timesheet_entries_task_id',
            columnNames: ['task_id'],
            referencedTableName: 'tasks',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
        uniques: [
          {
            name: 'UQ_timesheet_entries_employee_task_work_date',
            columnNames: ['employee_id', 'task_id', 'work_date'],
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'timesheet_entries',
      new TableIndex({
        name: 'IDX_timesheet_entries_employee_work_date',
        columnNames: ['employee_id', 'work_date'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('timesheet_entries');
    await queryRunner.query('DROP TYPE "timesheet_submission_status_enum"');
  }
}
