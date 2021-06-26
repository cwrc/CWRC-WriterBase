import { IConfig } from 'overmind';
import { createHook } from 'overmind-react';
import { namespaced } from 'overmind/config';
import * as document from './document';
import * as editor from './editor';
import * as ui from './ui';
import * as validator from './validator';

export const useApp = createHook();

export const config = namespaced({
  document,
  editor,
  ui,
  validator,
});

declare module 'overmind' {
  interface Config extends IConfig<typeof config> {}
}
