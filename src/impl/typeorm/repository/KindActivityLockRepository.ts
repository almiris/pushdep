import { IsNull, Repository } from "typeorm";
import { KindActivityLock } from "../entity/KindActivityLock.entity";
import { GenericRepository } from "../helper/GenericRepository";

export class KindActivityLockRepository extends GenericRepository<KindActivityLock> {
    constructor(kindActivityLockRepository: Repository<KindActivityLock>) {
        super(kindActivityLockRepository);
    }

    async acquireLockAsync(kindId: string): Promise<KindActivityLock> {
        return /* await */ this.repository.createQueryBuilder("kind_activity_lock")
            .setLock("pessimistic_partial_write", undefined, [ "kind_activity_lock" ])
            .innerJoin("kind_activity_lock.kind", "kind", "kind_activity_lock.kindId = :kindId", { kindId: kindId })
            .where({
                lockedAt: IsNull()
            })
            .orWhere("EXTRACT(EPOCH FROM (NOW() - kind_activity_lock.locked_at)) > kind.lock_timeout_ms / 1000")
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
                tables: [ "kind_activity_lock" ]
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
