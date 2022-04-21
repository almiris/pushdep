import { InMemoryPushDep } from "src/core/InMemoryPushDep";

describe('InMemoryPushDep tests', () => {

  beforeEach(async () => {
  });

  it('Should add a task to an InMemoryPushDep', async () => {
      const pushDep = new InMemoryPushDep();
      const id = await pushDep.pushAsync({
          kind: "a"
      });
      
      expect(id).not.toBeNull();
      expect(id.length).toBe(36);
      expect(pushDep.tasks.a).not.toBeNull();
      expect(pushDep.tasks.a.length).toBe(1);
      expect.assertions(4);
  });
});
