import { PushDepExecutionState, PushDepTaskCount } from "src/core/PushDep";
import { Task } from "../model/Task.model";
import { TaskExecution } from "../model/TaskExecution.model";
import { GenericRepository } from "../helper/GenericRepository";
import { Repository } from "sequelize-typescript";
import { FindOptions } from "sequelize/types";

interface Count { 
    state: number; 
    count: number 
}

export class TaskExecutionRepository extends GenericRepository<TaskExecution> {
    constructor(private taskExecutionRepository: Repository<TaskExecution>) {
        super(taskExecutionRepository);
    }

    // async findByTaskIdAsync(id: string): Promise<TaskExecution> {
    //     return await this.taskExecutionRepository.findOne({
    //         where: {
    //             taskId: id
    //         }
    //     });
    // }

    async countAsync(kindId?: string): Promise<PushDepTaskCount> {
        let options: FindOptions = {
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
                attributes: [],
                where: {
                    kindId: kindId
                }
            };
        };

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

    // async startAsync(taskId: string) {
    //     await this.taskExecutionRepository.update({ taskId: taskId }, { 
    //         state: PushDepExecutionState.active, 
    //         startedAt: new Date() 
    //     });
    // }

    // async completeAsync(taskId: string) {
    //     await this.taskExecutionRepository.update({ taskId: taskId }, { 
    //         state: PushDepExecutionState.completed, 
    //         completedAt: new Date() 
    //     });
    // }

    // async cancelAsync(taskId: string) {
    //     await this.taskExecutionRepository.update({ taskId: taskId }, { 
    //         state: PushDepExecutionState.canceled, 
    //         canceledAt: new Date() 
    //     });
    // }

    // async failAsync(taskId: string) {
    //     await this.taskExecutionRepository.update({ taskId: taskId }, { 
    //         state: PushDepExecutionState.failed, 
    //         failedAt: new Date() 
    //     });
    // }

    // async returnAsync(taskId: string) {
    //     await this.taskExecutionRepository.update({ taskId: taskId }, { 
    //         state: PushDepExecutionState.pending, 
    //         startedAt: null,
    //         completedAt: null,
    //         canceledAt: null,
    //         failedAt: null
    //     });
    // }
}
