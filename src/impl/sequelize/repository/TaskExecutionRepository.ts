import { PushDepExecutionState, PushDepTaskCount } from "../../../core/PushDep";
import { TaskExecution } from "../model/TaskExecution.model";
import { GenericRepository } from "../helper/GenericRepository";
import { Repository } from "sequelize-typescript";
import { FindOptions, Transaction } from "sequelize";
import { Task } from "../model/Task.model";

interface Count { 
    state: number; 
    count: number 
}

export class TaskExecutionRepository extends GenericRepository<TaskExecution> {
    constructor(taskExecutionRepository: Repository<TaskExecution>) {
        super(taskExecutionRepository);
    }

    async findByTaskIdAsync(transaction: Transaction, taskId: string): Promise<TaskExecution> {
        return await this.repository.findOne({
            transaction: transaction,
            where: {
                taskId: taskId
            }
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
            options.include = {
                model: Task,
                required: true,
                attributes: [],
                where: {
                    kindId: kindId
                }
            };
        }

        const count = await this.repository.findAll(options) as unknown as Count[];

        return count.reduce((result: PushDepTaskCount, count: Count) => {
            result[PushDepExecutionState[count.state]] = Number(count.count);
            result.all += Number(count.count);
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
            taskId: taskId
        }))[0] == 1;
    }

    async completeAsync(transaction: Transaction, taskId: string): Promise<boolean> {
        return (await this.updateAsync(transaction, {
            state: PushDepExecutionState.completed, 
            completedAt: new Date() 
        }, {
            taskId: taskId
        }))[0] == 1;
    }

    async cancelAsync(transaction: Transaction, taskId: string): Promise<boolean> {
        return (await this.updateAsync(transaction, {
            state: PushDepExecutionState.canceled, 
            canceledAt: new Date() 
        }, {
            taskId: taskId
        }))[0] == 1;
    }

    async failAsync(transaction: Transaction, taskId: string): Promise<boolean> {
        return (await this.updateAsync(transaction, {
            state: PushDepExecutionState.failed, 
            failedAt: new Date() 
        }, {
            taskId: taskId
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
            taskId: taskId
        }))[0] == 1;
    }
}
