import "dotenv/config";
import { Sequelize } from "sequelize-typescript";
import { MigrateTaskIndexes1658264833157 } from "src/impl/typeorm/migration/MigrateTaskIndexes";
import { DataSource } from "typeorm";
import { InMemoryPushDep } from "../impl/inmemory/InMemoryPushDep";
import { Kind as SequelizeKind } from "../impl/sequelize/model/Kind.model";
import { KindActivityLock as SequelizeKindActivityLock } from "../impl/sequelize/model/KindActivityLock.model";
import { Task as SequelizeTask } from "../impl/sequelize/model/Task.model";
import { TaskDependency as SequelizeTaskDependency } from "../impl/sequelize/model/TaskDependency.model";
import { SequelizePushDep } from "../impl/sequelize/SequelizePushDep";
import { Kind as TypeORMKind } from "../impl/typeorm/entity/Kind.entity";
import { KindActivityLock as TypeORMKindActivityLock } from "../impl/typeorm/entity/KindActivityLock.entity";
import { Task as TypeORMTask } from "../impl/typeorm/entity/Task.entity";
import { TaskDependency as TypeORMTaskDependency } from "../impl/typeorm/entity/TaskDependency.entity";
import { TypeORMPushDep } from "../impl/typeorm/TypeORMPushDep";
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
            synchronize: false,
            logging: false, // true,
            entities: [TypeORMKind, TypeORMKindActivityLock, TypeORMTask, TypeORMTaskDependency],
            migrationsTableName: "pshdp_typeorm_migrations",
            // migrationsRun: true, => QueryFailedError: relation "public.task" does not exist
            // migrations: [ MigrateTaskIndexes1658264833157 ],
            subscribers: [],
        });
        await dataSource.initialize();
        pushDep = new TypeORMPushDep(dataSource);
        const migration = new MigrateTaskIndexes1658264833157();
        await migration.up(dataSource.createQueryRunner());
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
            logging: false,
            // logging: (...msg) => console.log(msg), // true,
            // repositoryMode: true,
            models: [SequelizeKind, SequelizeKindActivityLock, SequelizeTask, SequelizeTaskDependency]
        });
        await sequelize.sync();
        pushDep = new SequelizePushDep(sequelize);
    }
}

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
        await dataSource.manager.delete(TypeORMKindActivityLock, {});
        await dataSource.manager.delete(TypeORMTaskDependency, {});
        await dataSource.manager.delete(TypeORMTask, {});
        await dataSource.manager.delete(TypeORMKind, {});
    }
    else if (PUSHDEP_CLASSES[pushDepClass] === SequelizePushDep) {
        // await SequelizeTaskDependency.truncate({ force: true });
        await SequelizeKindActivityLock.truncate({ force: true, cascade: true });
        await SequelizeTask.truncate({ force: true, cascade: true });
        await SequelizeKind.truncate({ force: true, cascade: true });
    }
    else if (PUSHDEP_CLASSES[pushDepClass] === InMemoryPushDep) {
        pushDep = new InMemoryPushDep();
    }
    await pushDep.setKindAsync({ id: "a", concurrency: 3, lockTimeoutMs: 1500 });
}

describe("One test to keep the .spec in this filename ;-)", () => {
    it("Should contain at least one test", () => {});
});
