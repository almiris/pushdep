import { InMemoryPushDep } from "src/core/InMemoryPushDep";

describe('InMemoryPushDep tests', () => {

  // beforeEach(async () => {});

  it('It should write and read a kind', async() => {
    const pushDep = new InMemoryPushDep();
    await pushDep.setKindAsync({ name: "a", concurrency: 3 });

    const kindA = await pushDep.getKindAsync("a");
    expect(kindA).not.toBeNull();
    expect(kindA).toEqual({
      name: "a",
      concurrency: 3
    });

    const kindB = await pushDep.getKindAsync("b");
    expect(kindB).toBeNull();

    expect.assertions(3);
  });

  it('It should push a task assigning it its id when necessary', async () => {
    const pushDep = new InMemoryPushDep();
    const id = await pushDep.pushAsync({
      id: "my_id",
      kind: "a"
    });
    const newId = await pushDep.pushAsync({
      kind: "a"
    });

    expect(id).toBe("my_id");
    expect(newId).not.toBeNull();
    expect(newId.length).toBe(36);
    expect((await pushDep.countAsync("a")).pending).toBe(2);
    expect.assertions(4);
  });

  it('It should count tasks', async () => {
    const pushDep = new InMemoryPushDep();

    await pushDep.pushAsync({ kind: "a" });
    await pushDep.pushAsync({ kind: "a" });
    await pushDep.pushAsync({ kind: "a" });

    let count = await pushDep.countAsync("a");
    expect(count).toEqual({
      pending: 3,
      active: 0,
      completed: 0,
      canceled: 0,
      failed: 0,
      all: 3
    });

    count = await pushDep.countAsync("b");
    expect(count).toEqual({
      pending: 0,
      active: 0,
      completed: 0,
      canceled: 0,
      failed: 0,
      all: 3
    });

    expect.assertions(2);
  });

  it('It should peek a task using priority', async () => {
    const pushDep = new InMemoryPushDep();
    const id0 = await pushDep.pushAsync({ kind: "a" });

    let task = await pushDep.peekAsync("a");
    expect(task.id).toBe(id0);

    const id2 = await pushDep.pushAsync({ kind: "a", priority: 2 });
    task = await pushDep.peekAsync("a");
    expect(task.id).toBe(id2);

    const id10 = await pushDep.pushAsync({ kind: "a", priority: 10 });
    task = await pushDep.peekAsync("a");
    expect(task.id).toBe(id10);

    expect.assertions(3);
  });

  it('It should peek a task using priority and dependencies', async () => {
    const pushDep = new InMemoryPushDep();
    const id0 = await pushDep.pushAsync({ kind: "a" });
    const id2 = await pushDep.pushAsync({ kind: "a", priority: 2, dependencyIds: [id0]});
    await pushDep.pushAsync({ kind: "a", priority: 10, dependencyIds: [id2]});

    const task = await pushDep.peekAsync("a");
    expect(task.id).toBe(id0);
    expect.assertions(1);
  });

  it('It should pop nothing', async () => {
    const pushDep = new InMemoryPushDep();
    const task = await pushDep.popAsync("a");
    expect(task).toBeNull();
    expect.assertions(1);
  });

  it('It should pop tasks', async () => {
    const pushDep = new InMemoryPushDep();
    const id0 = await pushDep.pushAsync({ kind: "a" });
    const id2 = await pushDep.pushAsync({ kind: "a", priority: 2, dependencyIds: [id0]});
    const id10 = await pushDep.pushAsync({ kind: "a", priority: 10, dependencyIds: [id2]});
    const ids = [id0, id2, id10];
    let count = await pushDep.countAsync("a");

    expect(count.pending).toBe(3);        

    for (let i = 0; i < ids.length; i++) {
      const task = await pushDep.popAsync("a");
      expect(task.id).toBe(ids[i]);
      count = await pushDep.countAsync("a");
      expect(count.pending).toBe(ids.length - i - 1);
    }

    expect.assertions(ids.length * 2 + 1);
  });

  it('It should start then complete a task', async () => {
    const pushDep = new InMemoryPushDep();
    await pushDep.pushAsync({
      kind: "a"
    });

    const task = await pushDep.startAsync("a");

    let count = await pushDep.countAsync("a");
    expect(count).toEqual({
      pending: 0,
      active: 1,
      completed: 0,
      canceled: 0,
      failed: 0,
      all: 1
    });

    await pushDep.completeAsync(task);

    count = await pushDep.countAsync("a");
    expect(count).toEqual({
      pending: 0,
      active: 0,
      completed: 1,
      canceled: 0,
      failed: 0,
      all: 1
    });

    expect.assertions(2);
  });

  it('It should start then cancel a task', async () => {
    const pushDep = new InMemoryPushDep();
    await pushDep.pushAsync({
      kind: "a"
    });

    const task = await pushDep.startAsync("a");

    let count = await pushDep.countAsync("a");
    expect(count).toEqual({
      pending: 0,
      active: 1,
      completed: 0,
      canceled: 0,
      failed: 0,
      all: 1
    });

    await pushDep.cancelAsync(task);

    count = await pushDep.countAsync("a");
    expect(count).toEqual({
      pending: 0,
      active: 0,
      completed: 0,
      canceled: 1,
      failed: 0,
      all: 1
    });

    expect.assertions(2);
  });

  it('It should start then fail a task', async () => {
    const pushDep = new InMemoryPushDep();
    await pushDep.pushAsync({
      kind: "a"
    });

    const task = await pushDep.startAsync("a");

    let count = await pushDep.countAsync("a");
    expect(count).toEqual({
      pending: 0,
      active: 1,
      completed: 0,
      canceled: 0,
      failed: 0,
      all: 1
    });

    await pushDep.failAsync(task);

    count = await pushDep.countAsync("a");
    expect(count).toEqual({
      pending: 0,
      active: 0,
      completed: 0,
      canceled: 0,
      failed: 1,
      all: 1
    });

    expect.assertions(2);
  });

  it('It should start then repush a task', async () => {
    const pushDep = new InMemoryPushDep();
    await pushDep.pushAsync({
      kind: "a"
    });

    const task = await pushDep.startAsync("a");

    let count = await pushDep.countAsync("a");
    expect(count).toEqual({
      pending: 0,
      active: 1,
      completed: 0,
      canceled: 0,
      failed: 0,
      all: 1
    });

    await pushDep.pushAsync(task);

    count = await pushDep.countAsync("a");
    expect(count).toEqual({
      pending: 1,
      active: 0,
      completed: 0,
      canceled: 0,
      failed: 0,
      all: 1
    });

    expect.assertions(2);
  });

  it('It should repush a pending task', async () => {
    const pushDep = new InMemoryPushDep();
    await pushDep.pushAsync({
      kind: "a"
    });

    const task = await pushDep.popAsync("a");
    await pushDep.pushAsync(task);

    const count = await pushDep.countAsync("a");
    expect(count).toEqual({
      pending: 1,
      active: 0,
      completed: 0,
      canceled: 0,
      failed: 0,
      all: 1
    });

    expect.assertions(1);
  });

  it('It should test kind concurrency', async () => {
    let pushDep = new InMemoryPushDep();
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const i in [1, 2, 3, 4]) {
      await pushDep.pushAsync({ kind: "a" });
      await pushDep.startAsync("a");
    }

    let count = await pushDep.countAsync("a");
    expect(count).toEqual({
      pending: 0,
      active: 4,
      completed: 0,
      canceled: 0,
      failed: 0,
      all: 4
    });

    pushDep = new InMemoryPushDep();
    pushDep.setKindAsync({ name: "a", concurrency: 3 });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const i in [1, 2, 3, 4]) {
      await pushDep.pushAsync({ kind: "a" });
      await pushDep.startAsync("a");
    }

    count = await pushDep.countAsync("a");
    expect(count).toEqual({
      pending: 1,
      active: 3,
      completed: 0,
      canceled: 0,
      failed: 0,
      all: 4
    });

    expect.assertions(2);
  });

});
