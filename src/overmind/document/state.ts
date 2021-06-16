import { derived, RootState } from 'overmind';

type State = {
  schemaId: string;
  schemaName: string;
};

export const state: State = {
  schemaId: '',
  schemaName: derived((state: State, rootState: RootState) => {
    const schema = rootState.editor.schemas.find((sch) => sch.id === state.schemaId);
    if (!schema) return '';
    return schema.name;
  }),
};
