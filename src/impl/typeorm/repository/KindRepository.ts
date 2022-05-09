import { PushDepKind } from "../../../core/PushDep";
import { Repository } from "typeorm";
import { Kind } from "../entity/Kind.entity";
import { GenericRepository } from "../helper/GenericRepository";

export class KindRepository extends GenericRepository<Kind> {
    constructor(kindRepository: Repository<Kind>) {
        super(kindRepository);
    }

    async findAsync(kindId: string): Promise<PushDepKind> {
        return await this.repository.findOne({
            select: {
                id: true,
                concurrency : true
            },
            where: {
                id: kindId
            }
        });
    }
}
