/**
 * Serialises every database operation through a tiny promise queue.
 *
 * SQLite is a single connection: without this, a transaction opened by one
 * request could swallow statements issued by another request that happens to
 * run in between. Cheap insurance for the dev database.
 */
export class Mutex {
  #tail = Promise.resolve();

  run(task) {
    const result = this.#tail.then(task, task);
    this.#tail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}

export default Mutex;
