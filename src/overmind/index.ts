import { IContext } from 'overmind';
import {
  createActionsHook,
  createEffectsHook,
  createReactionHook,
  createStateHook,
} from 'overmind-react';
import { namespaced } from 'overmind/config';
import * as document from './document';
import * as editor from './editor';
import * as ui from './ui';
import * as validator from './validator';

export const config = namespaced({
  document,
  editor,
  ui,
  validator,
});

export type Context = IContext<typeof config>;

export const useAppState = createStateHook<Context>();
export const useActions = createActionsHook<Context>();
export const useEffects = createEffectsHook<Context>();
export const useReaction = createReactionHook<Context>();
