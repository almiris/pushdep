import { PushDepKind } from "src/core/PushDep";
import { Repository } from "typeorm";
import { Kind } from "../entity/Kind.entity";
import { GenericService } from "../helper/GenericService";

export class KindService extends GenericService<Kind> {
    constructor(private kindRepository: Repository<Kind>) {
        super(kindRepository);
    }

    async findAsync(kindId: string): Promise<PushDepKind> {
        return (await this.kindRepository.find({
            select: {
                id: true,
                concurrency : true
            },
            where: {
                id: kindId
            }
        }))[0] || null;
    }
}
