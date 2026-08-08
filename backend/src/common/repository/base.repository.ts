import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';

/**
 * Shared base for entity-backed repositories, so modules do not each reinvent how they reach
 * TypeORM. A module repository extends this, passing its entity to `super`, and works through
 * the protected `repo`:
 *
 *   export class UsersRepository extends BaseRepository<User> {
 *     constructor(dataSource: DataSource) {
 *       super(dataSource, User);
 *     }
 *
 *     findByEmail(email: string) {
 *       return this.repo.findOne({ where: { email } });
 *     }
 *   }
 *
 * Data access is the only layer that touches TypeORM — services receive a repository by
 * constructor injection and never see the DataSource. Not yet extended (there are no entities
 * until the first entity story); it exists so that story has a convention to follow.
 */
export abstract class BaseRepository<T extends ObjectLiteral> {
  protected readonly repo: Repository<T>;

  protected constructor(dataSource: DataSource, entity: EntityTarget<T>) {
    this.repo = dataSource.getRepository(entity);
  }
}
