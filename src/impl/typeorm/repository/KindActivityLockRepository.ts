import { IsNull, Repository } from "typeorm";
import { PSHDP_KIND_ACTIVITY_LOCK_TABLE, PSHDP_KIND_TABLE } from "../definitions";
import { KindActivityLock } from "../entity/KindActivityLock.entity";
import { GenericRepository } from "../helper/GenericRepository";

export class KindActivityLockRepository extends GenericRepository<KindActivityLock> {
    constructor(kindActivityLockRepository: Repository<KindActivityLock>) {
        super(kindActivityLockRepository);
    }

    async acquireLockAsync(kindId: string): Promise<KindActivityLock> {
        return /* await */ this.repository.createQueryBuilder(PSHDP_KIND_ACTIVITY_LOCK_TABLE)
            .setLock("pessimistic_partial_write", undefined, [ PSHDP_KIND_ACTIVITY_LOCK_TABLE ])
            .innerJoin(`${PSHDP_KIND_ACTIVITY_LOCK_TABLE}.kind`, PSHDP_KIND_TABLE, `${PSHDP_KIND_ACTIVITY_LOCK_TABLE}.kindId = :kindId`, { kindId: kindId })
            .where({
                lockedAt: IsNull()
            })
            .orWhere(`EXTRACT(EPOCH FROM (NOW() - ${PSHDP_KIND_ACTIVITY_LOCK_TABLE}.locked_at)) > ${PSHDP_KIND_TABLE}.lock_timeout_ms / 1000`)
            .take(1)
            .getOne();
    }

    async reserveLockAsync(lockId: number, taskId: string): Promise<number> {
        return (await this.repository.update({ id: lockId }, { 
            lockedAt : new Date(),
            taskId: taskId
        })).affected;
    }

    async releaseLockAsync(kindId: string, taskId: string): Promise<void> {
        const lock = await this.repository.findOne({
            lock: {
                mode: "pessimistic_partial_write",
                tables: [ PSHDP_KIND_ACTIVITY_LOCK_TABLE ]
            },
            where: {
                kindId: kindId,
                taskId: taskId
            }
        });
        if (lock) {
            await this.repository.update({ id: lock.id }, {
                lockedAt : null,
                taskId: null
            });
        }
    }

    async deleteAllAsync(kindId: string): Promise<number> {
        return (await this.repository.delete({ kindId: kindId })).affected;
    }
}
