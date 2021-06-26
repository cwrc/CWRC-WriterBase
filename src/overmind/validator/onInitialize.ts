import * as Comlink from 'comlink';
import type { CwrcWorkerValidator } from 'cwrc-worker-validator';
import { OnInitialize } from 'overmind';

declare global {
  interface Window {
    workerValidator: Comlink.Remote<CwrcWorkerValidator>;
  }
}

export const onInitialize: OnInitialize = async ({ state }) => {
  const validator = await loadWorkerValidator();
  if (!validator) return;

  window.workerValidator = validator;
  state.validator.hasValidator = true;
};

const loadWorkerValidator = async (): Promise<Comlink.Remote<CwrcWorkerValidator>> => {
  return await new Promise((resolve) => {
    //@ts-ignore
    if (WORKER_ENV === 'development') {
      //? WORKER DEV:
      import(/* webpackChunkName: "ValidatorWorker" */ 'cwrc-worker-validator').then((module) => {
        console.log('DEV-WORKER');
        //@ts-ignore
        const ValidatorWorker = module.default;

        const worker = new ValidatorWorker();
        const validator: Comlink.Remote<CwrcWorkerValidator> = Comlink.wrap(worker);
        resolve(validator);
      });
    } else {
      // console.log('PROD-WORKER');
      //? WORKER PRODUCTION:
      const worker = new Worker('cwrc.worker.js');
      const validator: Comlink.Remote<CwrcWorkerValidator> = Comlink.wrap(worker);
      resolve(validator);
    }
  });
};
