import { FindOptions, Op, Transaction } from "sequelize";
import { Repository } from "sequelize-typescript";
import { PushDepExecutionState, PushDepTaskCount } from "../../../core/PushDep";
import { PSHDP_TASK_DEPENDENCY_TABLE, PSHDP_TASK_TABLE } from "../definitions";
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
                        state: PushDepExecutionState.pending,
                        startAt: {[Op.lte] : new Date()}
                    },
                    this.repository.sequelize.literal(`(SELECT COUNT(td.task_id) FROM ${PSHDP_TASK_DEPENDENCY_TABLE} AS td
                        INNER JOIN ${PSHDP_TASK_TABLE} as t ON td.dependency_id = t.id
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

    async hasTaskInStatesAsync(transaction: Transaction | null, kindId: string, states: PushDepExecutionState[]): Promise<boolean> {
        return await this.repository.count({
            transaction: transaction,
            where: {
                kindId: kindId,
                state: { [Op.or]: states }
            }
        }) > 0;
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
        }))[0] === 1;
    }

    async completeAsync(transaction: Transaction, taskId: string, taskResults: any): Promise<boolean> {
        return (await this.updateAsync(transaction, {
            state: PushDepExecutionState.completed, 
            completedAt: new Date(),
            results: taskResults
        }, {
            id: taskId
        }))[0] === 1;
    }

    async cancelAsync(transaction: Transaction, taskId: string, taskResults: any): Promise<boolean> {
        return (await this.updateAsync(transaction, {
            state: PushDepExecutionState.canceled, 
            canceledAt: new Date(),
            results: taskResults
        }, {
            id: taskId
        }))[0] === 1;
    }

    async failAsync(transaction: Transaction, taskId: string, taskResults: any): Promise<boolean> {
        return (await this.updateAsync(transaction, {
            state: PushDepExecutionState.failed, 
            failedAt: new Date(),
            results: taskResults
        }, {
            id: taskId
        }))[0] === 1;
    }

    async returnAsync(transaction: Transaction, taskId: string, taskResults: any, startAt: Date): Promise<boolean> {
        return (await this.updateAsync(transaction, {
            state: PushDepExecutionState.pending, 
            startAt: startAt || new Date(),
            startedAt: null,
            completedAt: null,
            canceledAt: null,
            failedAt: null,
            results: taskResults
        }, {
            id: taskId
        }))[0] === 1;
    }

    async getTaskDependenciesAsync(transaction: Transaction | null, taskId: string): Promise<Task[] | null> {
        const task = await this.repository.findOne({
            transaction: transaction,
            where: {
                id: taskId
            },
            include: {
                model: Task,
                as: "dependencies"
            },
            order: [
                ["id", "ASC"]
            ]
        });
        return task && task.dependencies && task.dependencies.length > 0 ? task.dependencies : null;
    }
}
