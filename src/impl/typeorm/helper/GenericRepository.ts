import { Repository } from "typeorm";

export abstract class GenericRepository<T> {
    constructor(private repository: Repository<T>) {
    }

    async saveAsync(entity: T): Promise<T> {
        return await this.repository.save(entity);
    }
}
