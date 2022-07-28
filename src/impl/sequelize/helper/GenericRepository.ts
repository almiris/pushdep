import { Attributes, Transaction, WhereOptions } from "sequelize";
import { Model, Repository } from "sequelize-typescript";

export abstract class GenericRepository<M extends Model> {
    constructor(protected repository: Repository<M>) {
    }

    async createAsync(transaction: Transaction | null, model: M): Promise<M> {
        return /* await */ this.repository.create(model as any, {
            transaction: transaction
        });
    }

    async bulkCreateAsync(transaction: Transaction | null, models: M[]): Promise<M[]> {
        return /* await */ this.repository.bulkCreate(models as any[], {
            transaction: transaction
        });
    }

    async upsertAsync(transaction: Transaction | null, model: M): Promise<[M, boolean | null]> {
        return /* await */ this.repository.upsert(model as any, {
            transaction: transaction
        });
    }

    async updateAsync(transaction: Transaction | null, model: Partial<M>, where: WhereOptions<Attributes<M>>): Promise<[affectedCount: number]> {
        return /* await */ this.repository.update(model, {
            transaction: transaction,
            where: where
        });
    }

    async deleteAsync(transaction: Transaction | null, where: WhereOptions<Attributes<M>>): Promise<number> {
        return /* await */ this.repository.destroy({
            transaction: transaction,
            where: where
        });
    }
}
