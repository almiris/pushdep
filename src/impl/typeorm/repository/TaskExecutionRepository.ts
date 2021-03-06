import { PushDepExecutionState, PushDepTaskCount } from "../../../core/PushDep";
import { Repository } from "typeorm";
import { TaskExecution } from "../entity/TaskExecution.entity";
import { GenericRepository } from "../helper/GenericRepository";

interface Count { 
    state: number; 
    count: number 
}

export class TaskExecutionRepository extends GenericRepository<TaskExecution> {
    constructor(taskExecutionRepository: Repository<TaskExecution>) {
        super(taskExecutionRepository);
    }

    async findByTaskIdAsync(id: string): Promise<TaskExecution> {
        return await this.repository.findOne({
            where: {
                taskId: id
            }
        });
    }

    async countAsync(kindId?: string): Promise<PushDepTaskCount> {
        let queryBuilder = this.repository
            .createQueryBuilder("task_execution")
            .select("state")
            .addSelect("COUNT(state)", "count");
        if (kindId) {
            queryBuilder = queryBuilder
                .innerJoin("task_execution.task", "task", "task.kindId = :kindId", { kindId: kindId });
        }
        const count: Count[] = await queryBuilder
            .groupBy("state")
            .getRawMany();

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

    async startAsync(taskId: string) {
        await this.repository.update({ taskId: taskId }, { 
            state: PushDepExecutionState.active, 
            startedAt: new Date() 
        });
    }

    async completeAsync(taskId: string) {
        await this.repository.update({ taskId: taskId }, { 
            state: PushDepExecutionState.completed, 
            completedAt: new Date() 
        });
    }

    async cancelAsync(taskId: string) {
        await this.repository.update({ taskId: taskId }, { 
            state: PushDepExecutionState.canceled, 
            canceledAt: new Date() 
        });
    }

    async failAsync(taskId: string) {
        await this.repository.update({ taskId: taskId }, { 
            state: PushDepExecutionState.failed, 
            failedAt: new Date() 
        });
    }

    async returnAsync(taskId: string) {
        await this.repository.update({ taskId: taskId }, { 
            state: PushDepExecutionState.pending, 
            startedAt: null,
            completedAt: null,
            canceledAt: null,
            failedAt: null
        });
    }
}
