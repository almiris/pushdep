import { PushDepKind } from "src/core/PushDep";
import { Kind } from "../model/Kind.model";
import { GenericRepository } from "../helper/GenericRepository";
import { Repository } from "sequelize-typescript";

export class KindRepository extends GenericRepository<Kind> {
    constructor(private kindRepository: Repository<Kind>) {
        super(kindRepository);
    }

    async findAsync(kindId: string): Promise<PushDepKind> {
        return this.kindRepository.findByPk(kindId, { attributes: [ "id", "concurrency" ], raw: true });
    }
}
