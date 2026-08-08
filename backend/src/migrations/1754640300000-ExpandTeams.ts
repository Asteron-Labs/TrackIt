import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
import { DEFAULT_WEEKLY_CAPACITY } from '../common/config/constants';

export class ExpandTeams1754640300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('teams', [
      new TableColumn({
        name: 'description',
        type: 'text',
        default: "''",
      }),
      new TableColumn({
        name: 'weekly_capacity_hours',
        type: 'double precision',
        default: DEFAULT_WEEKLY_CAPACITY.toString(),
      }),
      new TableColumn({
        name: 'created_at',
        type: 'timestamptz',
        default: 'CURRENT_TIMESTAMP',
      }),
      new TableColumn({
        name: 'updated_at',
        type: 'timestamptz',
        default: 'CURRENT_TIMESTAMP',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('teams', 'updated_at');
    await queryRunner.dropColumn('teams', 'created_at');
    await queryRunner.dropColumn('teams', 'weekly_capacity_hours');
    await queryRunner.dropColumn('teams', 'description');
  }
}
