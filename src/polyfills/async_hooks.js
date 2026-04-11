export class AsyncLocalStorage {
  getStore() {
    return undefined;
  }
  run(store, callback) {
    return callback();
  }
}

export default { AsyncLocalStorage };
