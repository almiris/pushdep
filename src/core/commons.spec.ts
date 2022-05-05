import "dotenv/config";
import { Sequelize } from "sequelize-typescript";
import { InMemoryPushDep } from "src/impl/inmemory/InMemoryPushDep";
import { Kind as SequelizeKind } from "src/impl/sequelize/model/Kind.model";
import { Task as SequelizeTask } from "src/impl/sequelize/model/Task.model";
import { TaskDependency as SequelizeTaskDependency } from "src/impl/sequelize/model/TaskDependency.model";
import { TaskExecution as SequelizeTaskExecution } from "src/impl/sequelize/model/TaskExecution.model";
import { SequelizePushDep } from "src/impl/sequelize/SequelizePushDep";
import { Kind as TypeORMKind } from "src/impl/typeorm/entity/Kind.entity";
import { Task as TypeORMTask } from "src/impl/typeorm/entity/Task.entity";
import { TaskExecution as TypeORMTaskExecution } from "src/impl/typeorm/entity/TaskExecution.entity";
import { TypeORMPushDep } from "src/impl/typeorm/TypeORMPushDep";
import { DataSource } from "typeorm";
import { PushDep } from "./PushDep";

let dataSource: DataSource;
let sequelize: Sequelize;
export let pushDep: PushDep;

const pushDepClassCLIArg: string = process.argv.map(arg => arg.startsWith("--pushDepClass=") ? arg.substring("--pushDepClass=".length) : null).filter(arg => arg)[0];

export const PUSHDEP_CLASSES = {
    "InMemoryPushDep": InMemoryPushDep,
    "SequelizePushDep": SequelizePushDep,
    "TypeORMPushDep": TypeORMPushDep
};

export const TESTED_PUSHDEPS = pushDepClassCLIArg ? [{ pushDepClass: pushDepClassCLIArg }] : [{
    pushDepClass: "InMemoryPushDep"
}, {
    pushDepClass: "SequelizePushDep"
}, {
    pushDepClass: "TypeORMPushDep"
}];

export async function beforeAllAsync(pushDepClass) {
    if (PUSHDEP_CLASSES[pushDepClass] === TypeORMPushDep) {
        dataSource = new DataSource({
            type: process.env.DB_TYPE as any,
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: process.env.DB_SSL ? JSON.parse(process.env.DB_SSL) : undefined,
            extra: process.env.DB_EXTRA ? JSON.parse(process.env.DB_EXTRA) : undefined, // pool parameters!
            synchronize: true,
            logging: true,
            entities: [TypeORMKind, TypeORMTask, TypeORMTaskExecution],
            migrations: [],
            subscribers: [],
        });
        await dataSource.initialize();
        pushDep = new TypeORMPushDep(dataSource);
    }
    else if (PUSHDEP_CLASSES[pushDepClass] === SequelizePushDep) {
        sequelize = new Sequelize({
            dialect: process.env.DB_TYPE as any,
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: process.env.DB_SSL ? JSON.parse(process.env.DB_SSL) : undefined,
            pool: process.env.DB_EXTRA ? JSON.parse(process.env.DB_EXTRA) : undefined, // pool parameters!,
            sync: { alter: false, force: false },
            logging: (...msg) => console.log(msg), // true,
            models: [SequelizeKind, SequelizeTask, SequelizeTaskExecution, SequelizeTaskDependency]
        });         
        pushDep = new SequelizePushDep(sequelize);
    }
};

export async function afterAllAsync(pushDepClass) {
    if (PUSHDEP_CLASSES[pushDepClass] === TypeORMPushDep) {
        await dataSource.destroy();
    }
    else if (PUSHDEP_CLASSES[pushDepClass] === SequelizePushDep) {
        await sequelize.close();
    }
}

export async function beforeEachAsync(pushDepClass) {
    if (PUSHDEP_CLASSES[pushDepClass] === TypeORMPushDep) {
        await dataSource.manager.delete(TypeORMTaskExecution, {});
        await dataSource.manager.delete(TypeORMTask, {});
        await dataSource.manager.delete(TypeORMKind, {});
    }
    else if (PUSHDEP_CLASSES[pushDepClass] === SequelizePushDep) {
        // await SequelizeTaskExecution.truncate({ force: true });
        // await SequelizeTaskDependency.truncate({ force: true });
        await SequelizeTask.truncate({ force: true, cascade: true });
        await SequelizeKind.truncate({ force: true, cascade: true });
    }
    else if (PUSHDEP_CLASSES[pushDepClass] === InMemoryPushDep) {
        pushDep = new InMemoryPushDep();
    }
    await pushDep.setKindAsync({ id: "a", concurrency: 3 });
}

describe("One test to keep the .spec in this filename ;-)", () => {
    it("Should contain at least one test", () => {});
});
