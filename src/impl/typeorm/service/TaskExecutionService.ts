import { PushDepExecutionState, PushDepTaskCount } from "src/core/PushDep";
import { Repository } from "typeorm";
import { TaskExecution } from "../entity/TaskExecution.entity";
import { GenericService } from "../helper/GenericService";

interface Count { 
    state: number; 
    count: number 
}

export class TaskExecutionService extends GenericService<TaskExecution> {
    constructor(private taskExecutionRepository: Repository<TaskExecution>) {
        super(taskExecutionRepository);
    }

    async findByTaskIdAsync(id: string): Promise<TaskExecution> {
        return (await this.taskExecutionRepository.findOne({
            where: {
                taskId: id
            }
        }))[0] || null;
    }

    async countAsync(kindId?: string): Promise<PushDepTaskCount> {
        let queryBuilder = this.taskExecutionRepository
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
}
