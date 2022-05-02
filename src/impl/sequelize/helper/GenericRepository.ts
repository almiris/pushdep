import { Repository } from "sequelize-typescript";

export abstract class GenericRepository<T> {
    constructor(private repository: Repository<T>) {
    }
}
