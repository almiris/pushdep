import { DeepPartial, ObjectLiteral, Repository } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

export abstract class GenericRepository<T> {
    constructor(protected repository: Repository<T>) {
    }

    async saveAsync(entity: DeepPartial<T>): Promise<T> {
        return /* await */ this.repository.save(entity);
    }

    async insertAsync(entity: QueryDeepPartialEntity<T>): Promise<ObjectLiteral[]> {
        return (await this.repository.insert(entity)).identifiers;
    }

    async bulkInsertAsync(entities: QueryDeepPartialEntity<T>[]): Promise<ObjectLiteral[]> {
        return (await this.repository.insert(entities)).identifiers;
    }
}
