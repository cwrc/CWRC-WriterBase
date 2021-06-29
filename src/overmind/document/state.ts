import { derived } from 'overmind';
import { Context } from '../';

type State = {
  schemaId: string;
  schemaName: string;
};

export const state: State = {
  schemaId: '',
  schemaName: derived((state: State, rootState: Context['state']) => {
    const schema = rootState.editor.schemas.find((sch) => sch.id === state.schemaId);
    if (!schema) return '';
    return schema.name;
  }),
};
