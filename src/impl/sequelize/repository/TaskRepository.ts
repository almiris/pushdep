import { Repository } from "sequelize-typescript";
import { FindOptions, Op, Transaction } from "sequelize";
import { PushDepExecutionState, PushDepTaskCount } from "../../../core/PushDep";
import { GenericRepository } from "../helper/GenericRepository";
import { Task } from "../model/Task.model";

interface Count { 
    state: number; 
    count: number 
}

export class TaskRepository extends GenericRepository<Task> {
    constructor(taskRepository: Repository<Task>) {
        super(taskRepository);
    }

    async findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(transaction: Transaction | null, kindId: string, lock = false): Promise<Task> {
        return /* await */ this.repository.findOne({
            transaction: transaction,
            lock: lock ? {
                level: transaction.LOCK.UPDATE,
                of: Task
             } : false,
            skipLocked: lock ? true : false,
            where: {
                [Op.and]: [{
                        kindId: kindId,
                        state: PushDepExecutionState.pending
                    },
                    this.repository.sequelize.literal(`(SELECT COUNT(td.task_id) FROM task_dependency AS td
                        INNER JOIN task as t ON td.dependency_id = t.id
                        WHERE td.task_id = "Task".id
                        AND (t.state = ${PushDepExecutionState.pending} OR t.state = ${PushDepExecutionState.active})) = 0`)
                ]
            }, 
            order: [
                ["state", "ASC"],
                ["priority", "DESC"],
                ["createdAt", "ASC"]
            ]
        });
    }

    async countActiveTasks(transaction: Transaction, kindId: string): Promise<number> {
        return /* await */ this.repository.count({
            transaction: transaction,
            where: {
                kindId: kindId,
                state: PushDepExecutionState.active
            }
        });
    }

    async findByTaskIdAsync(transaction: Transaction, taskId: string): Promise<Task> {
        return /* await */ this.repository.findByPk(taskId, {
            transaction: transaction,
        });
    }

    async countAsync(kindId?: string): Promise<PushDepTaskCount> {
        const options: FindOptions = {
            attributes: [ 
                "state",
                [this.repository.sequelize.fn('COUNT', this.repository.sequelize.col("state")), "count"]
            ],
            group: "state",
            raw: true
        };

        if (kindId) {
            options.where = {
                kindId: kindId
            }
        }

        const count = await this.repository.findAll(options) as unknown as Count[];

        return count.reduce((result: PushDepTaskCount, c: Count) => {
            result[PushDepExecutionState[c.state]] = Number(c.count);
            result.all += Number(c.count);
            return result;
        }, {
            pending: 0,
            active: 0,
            completed: 0,
            canceled: 0,
            failed: 0,
            all: 0
        });
    }

    async startAsync(transaction: Transaction, taskId: string): Promise<boolean> {
        return (await this.updateAsync(transaction, {
            state: PushDepExecutionState.active, 
            startedAt: new Date() 
        }, {
            id: taskId
        }))[0] == 1;
    }

    async completeAsync(transaction: Transaction, taskId: string): Promise<boolean> {
        return (await this.updateAsync(transaction, {
            state: PushDepExecutionState.completed, 
            completedAt: new Date() 
        }, {
            id: taskId
        }))[0] == 1;
    }

    async cancelAsync(transaction: Transaction, taskId: string): Promise<boolean> {
        return (await this.updateAsync(transaction, {
            state: PushDepExecutionState.canceled, 
            canceledAt: new Date() 
        }, {
            id: taskId
        }))[0] == 1;
    }

    async failAsync(transaction: Transaction, taskId: string): Promise<boolean> {
        return (await this.updateAsync(transaction, {
            state: PushDepExecutionState.failed, 
            failedAt: new Date() 
        }, {
            id: taskId
        }))[0] == 1;
    }

    async returnAsync(transaction: Transaction, taskId: string): Promise<boolean> {
        return (await this.updateAsync(transaction, {
            state: PushDepExecutionState.pending, 
            startedAt: null,
            completedAt: null,
            canceledAt: null,
            failedAt: null
        }, {
            id: taskId
        }))[0] == 1;
    }
}
