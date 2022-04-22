import { PushDep, PushDepTask } from "./pushdep";
import { v4 as uuidv4 } from 'uuid';

type TasksMappedByKindOrderedByPushTime = {
    [kind: string]: PushDepTask[]
}

type TasksMappedByPriority = {
    [priority: number]: TasksMappedByKindOrderedByPushTime
}

type InMemoryTasks = {
    pendingTasksOrderedByPushTime: TasksMappedByPriority,
    activeTasksOrderedByPushTime: TasksMappedByPriority,
    completedTasksOrderedByPushTime: TasksMappedByPriority,
    canceledTasksOrderedByPushTime: TasksMappedByPriority,
    failedTasksOrderedByPushTime: TasksMappedByPriority
}

export class InMemoryPushDep implements PushDep {
    tasks: InMemoryTasks = {}

    async pushAsync(task: PushDepTask): Promise<string> {
        task.id = task.id || uuidv4();
        const tasks: PushDepTask[] = this.tasks[task.kind] || [];
        tasks.push(task);
        this.tasks[task.kind] = tasks;
        return task.id;
    }

    async popAsync(kind: string): Promise<PushDepTask> {
        const tasks: PushDepTask[] = this.tasks[kind];
        if (tasks) {
            const max = data.reduce(function(prev, current) {
                return (prev.y > current.y) ? prev : current
            })
        }
        return null;
    }
}
