import { PushDep, PushDepTask } from "./pushdep";
import { v4 as uuidv4 } from 'uuid';

type InMemoryTasks = {
    [p: string]: PushDepTask[];
};

export class InMemoryPushDep implements PushDep {
    tasks: InMemoryTasks = {}

    async pushAsync(task: PushDepTask): Promise<string> {
        task.id = task.id || uuidv4();
        const tasks: PushDepTask[] = this.tasks[task.kind] || [];
        tasks.push(task);
        this.tasks[task.kind] = tasks;
        return task.id;
    }
}
