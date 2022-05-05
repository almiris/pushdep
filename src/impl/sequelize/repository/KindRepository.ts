import { PushDepKind } from "../../../core/PushDep";
import { Kind } from "../model/Kind.model";
import { GenericRepository } from "../helper/GenericRepository";
import { Repository } from "sequelize-typescript";
import { Transaction } from "sequelize/types";

export class KindRepository extends GenericRepository<Kind> {
    constructor(kindRepository: Repository<Kind>) {
        super(kindRepository);
    }

    async findAsync(transaction: Transaction, kindId: string): Promise<PushDepKind> {
        return await this.repository.findByPk(kindId, { 
            transaction: transaction,
            attributes: [ "id", "concurrency" ], 
            raw: true 
        });
    }
}
