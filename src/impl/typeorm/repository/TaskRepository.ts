import { In, LessThanOrEqual, Repository } from "typeorm";
import { PushDepExecutionState, PushDepTaskCount } from "../../../core/PushDep";
import { PSHDP_TASK_DEPENDENCY_TABLE, PSHDP_TASK_TABLE } from "../definitions";
import { Task } from "../entity/Task.entity";
import { GenericRepository } from "../helper/GenericRepository";

interface Count { 
    state: number; 
    count: number 
}

export class TaskRepository extends GenericRepository<Task> {
    constructor(taskRepository: Repository<Task>) {
        super(taskRepository);
    }

    async findPendingTaskWithHighestPriorityAndNoPendingOrActiveDependencyAsync(kindId: string, lock = false): Promise<Task> {
        const queryBuilder = this.repository.createQueryBuilder(PSHDP_TASK_TABLE);
        if (lock) {
            queryBuilder.setLock("pessimistic_partial_write", undefined, [ PSHDP_TASK_TABLE ])
        }
        return /* await */ queryBuilder.where({ 
                kindId: kindId, 
                state: PushDepExecutionState.pending,
                startAt: LessThanOrEqual(new Date())
            })
            .andWhere((qb) => {
                return `${qb
                    .subQuery()
                    .select("COUNT(td.task_id)")
                    .from(PSHDP_TASK_DEPENDENCY_TABLE, "td")
                    .innerJoin(PSHDP_TASK_TABLE, "t", `td.dependency_id = t.id and td.task_id = ${PSHDP_TASK_TABLE}.id and (t.state = :pendingState or t.state = :activeState)`, { pendingState: PushDepExecutionState.pending, activeState: PushDepExecutionState.active })
                    // The line above can be replaced by the following three lines:
                    // .innerJoin("task", "t", "td.dependency_id = t.id")
                    // .where("td.task_id = task.id")
                    // .andWhere("(t.state = :pendingState or t.state = :activeState)", { pendingState: PushDepExecutionState.pending, activeState: PushDepExecutionState.active })
                    .getQuery()}=0`;
            })
            .orderBy(`${PSHDP_TASK_TABLE}.state`, "ASC")
            .orderBy(`${PSHDP_TASK_TABLE}.priority`, "DESC")
            .addOrderBy(`${PSHDP_TASK_TABLE}.createdAt`, "ASC")
            .take(1)
            .getOne();
    }

    async hasTaskInStatesAsync(kindId: string, states: PushDepExecutionState[]): Promise<boolean> {
        return await this.repository.count({
            where: {
                kindId: kindId,
                state: In(states)
            }
        }) > 0;
    }

    async findByTaskIdAsync(id: string): Promise<Task> {
        return /* await */ this.repository.findOne({
            where: {
                id: id
            }
        });
    }

    async countAsync(kindId?: string): Promise<PushDepTaskCount> {
        let queryBuilder = this.repository
            .createQueryBuilder(PSHDP_TASK_TABLE)
            .select("state")
            .addSelect("COUNT(state)", "count");
        if (kindId) {
            queryBuilder = queryBuilder
                .where({ kindId: kindId });
        }
        const count: Count[] = await queryBuilder
            .groupBy("state")
            .getRawMany();

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

    async startAsync(taskId: string): Promise<boolean> {
        return (await this.repository.update({ id: taskId }, { 
            state: PushDepExecutionState.active, 
            startedAt: new Date() 
        })).affected === 1;
    }

    async completeAsync(taskId: string, taskResults: any): Promise<boolean> {
        return (await this.repository.update({ id: taskId }, { 
            state: PushDepExecutionState.completed, 
            completedAt: new Date(),
            results: taskResults
        })).affected === 1;
    }

    async cancelAsync(taskId: string, taskResults: any): Promise<boolean> {
        return (await this.repository.update({ id: taskId }, { 
            state: PushDepExecutionState.canceled, 
            canceledAt: new Date(),
            results: taskResults
        })).affected === 1;
    }

    async failAsync(taskId: string, taskResults: any): Promise<boolean> {
        return (await this.repository.update({ id: taskId }, { 
            state: PushDepExecutionState.failed, 
            failedAt: new Date(),
            results: taskResults
        })).affected === 1;
    }

    async returnAsync(taskId: string, taskResults: any, startAt: Date): Promise<boolean> {
        return (await this.repository.update({ id: taskId }, { 
            state: PushDepExecutionState.pending, 
            startAt: startAt || new Date(),
            startedAt: null,
            completedAt: null,
            canceledAt: null,
            failedAt: null,
            results: taskResults
        })).affected === 1;
    }    

    async getTaskDependenciesAsync(taskId: string) : Promise<Task[] | null> {
        const task = await this.repository.findOne({
            where: {
                id: taskId
            },
            relations: {
                dependencies: true
            },
            order: {
                id: "ASC"
            }
        });
        return task && task.dependencies && task.dependencies.length > 0 ? task.dependencies : null;
    }
}
