import { Context } from 'overmind';

export const setInitialStateSchema = ({ state }: Context, id: string) => {
  state.document.schemaId = id;
};

export const setSchema = ({ state }: Context, id: string) => {
  window.writer.event('schemaChanged').publish(id);

  state.document.schemaId = id;
  return state.editor.schemas.find((schema) => schema.id === id);
};
