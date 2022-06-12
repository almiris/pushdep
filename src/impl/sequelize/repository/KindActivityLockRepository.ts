import { Repository } from "sequelize-typescript";
import { Op } from "sequelize";
import { Transaction } from "sequelize/types";
import { GenericRepository } from "../helper/GenericRepository";
import { Kind } from "../model/Kind.model";
import { KindActivityLock } from "../model/KindActivityLock.model";

export class KindActivityLockRepository extends GenericRepository<KindActivityLock> {
    constructor(kindLockRepository: Repository<KindActivityLock>) {
        super(kindLockRepository);
    }

    async acquireLockAsync(transaction: Transaction, kindId: string): Promise<KindActivityLock> {
        const lock = await this.repository.findOne({
            transaction: transaction,
            lock: {
                level: transaction.LOCK.UPDATE,
                of: KindActivityLock
            },
            skipLocked: true,
            where: {
                [Op.and]: [{
                    kindId: kindId
                },
                {
                    [Op.or]: [{
                        lockedAt: null,
                    },
                    this.repository.sequelize.literal('EXTRACT(EPOCH FROM (NOW() - "KindActivityLock"."locked_at")) > "kind"."lock_timeout_ms" / 1000')
                    ]
                }]
            },
            include: {
                model: Kind,
                required: true
            }
        });
        return lock;
    }

    async reserveLockAsync(transaction: Transaction, lockId: number, taskId: string): Promise<number> {
        return (await this.repository.update({ 
            lockedAt : new Date(),
            taskId: taskId
        }, { 
            transaction: transaction,
            where: {
                id: lockId
            }
        }))[0];
    }

    async releaseLockAsync(transaction: Transaction, kindId: string, taskId: string): Promise<void> {
        const lock = await this.repository.findOne({
            transaction: transaction,
            lock: {
                level: transaction.LOCK.UPDATE,
                of: KindActivityLock
            },
            skipLocked: true,
            where: {
                kindId: kindId,
                taskId: taskId
            }
        });
        if (lock) {
            await this.repository.update({ 
                lockedAt : null,
                taskId: null
            }, { 
                transaction: transaction,
                where: {
                    id: lock.id
                }
            });
        }
    }

    async deleteAllAsync(transaction: Transaction, kindId: string): Promise<number> {
        return await this.deleteAsync(transaction, { kindId: kindId });
    }
}
