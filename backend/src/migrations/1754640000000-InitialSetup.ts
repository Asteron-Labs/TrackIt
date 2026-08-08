import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Intentionally empty.
 *
 * TRACKIT-12 wires up the migration tooling only. This migration exists to prove
 * that `migration:run` and `migration:revert` work end to end (and to create the
 * TypeORM migrations bookkeeping table). Actual schema arrives with the first
 * entity story — which is blocked on the two open questions in docs/DOMAIN.md
 * (multi-team membership, multi-assignee) being resolved in an ADR first.
 */
export class InitialSetup1754640000000 implements MigrationInterface {
  public async up(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }
}
