import { Schema } from '@src/@types/types';
import $ from 'jquery';
import Cookies from 'js-cookie';
import { Context } from 'overmind';

const DIALOG_PREFS_COOKIE_NAME = 'cwrc-writer-base-dialog-preferences';

export const writerInitSettings = ({ state }: Context, config: string) => {
  // const configJson = JSON.parse(config);
  const { container, cwrcRootUrl, helpUrl, schema, services, storageDialogs } = JSON.parse(config);

  const settings = {
    container,
    cwrcRootUrl,
    helpUrl,
    schemaProxyUrl: schema.schemaProxyUrl,
    schemas: schema.schemas,
    nerveUrl: services.nerve.url,
    storageUrl: storageDialogs.setServerURL,
  };

  state.editor.settings = settings;

  state.editor.schemas = schema.schemas;
};

export const applyInitialSettings = ({ state, actions }: Context) => {
  actions.editor.setFontSize(state.editor.currentFontSize);
  const body = window.writer.editor.getBody();
  if (state.editor.showEntities) $(body).addClass('showEntities');
  if (state.editor.showTags) $(body).addClass('showTags');
};

export const setFontSize = ({ state }: Context, value: string) => {
  const styles = { fontSize: value };
  window.writer.editor.dom.setStyles(window.writer.editor.dom.getRoot(), styles);
  state.editor.currentFontSize = value;
};

export const showTags = ({ state }: Context, value: boolean) => {
  $('body', window.writer.editor.getDoc()).toggleClass('showTags');
  state.editor.showTags = value;
};

export const showEntities = ({ state }: Context, value: boolean) => {
  $('body', window.writer.editor.getDoc()).toggleClass('showEntities');
  state.editor.showEntities = value;
};

export const toggleAdvancedSettings = ({ state }: Context, value: boolean) => {
  state.editor.advancedSettings = value;
};

export const setReadonly = ({ state }: Context, value: boolean) => {
  state.editor.isReadonly = value;
};

export const setEditorMode = ({ state }: Context, editorMode: string) => {
  const writer = window.writer;

  if (editorMode !== 'xmlrdfoverlap') {
    writer.entitiesManager.removeOverlappingEntities();
    writer.entitiesManager.convertBoundaryEntitiesToTags();
  }

  switch (editorMode) {
    case 'xml':
      state.editor.mode = 1;
      state.editor.allowOverlap = false;
      writer.mode = writer.XML;
      writer.allowOverlap = false;
      break;
    case 'xmlrdf':
      state.editor.mode = 0;
      state.editor.allowOverlap = false;
      writer.mode = writer.XMLRDF;
      writer.allowOverlap = false;
      break;
    case 'xmlrdfoverlap':
      state.editor.mode = 0;
      state.editor.allowOverlap = true;
      writer.mode = writer.XMLRDF;
      writer.allowOverlap = true;
      break;
    case 'rdf':
      state.editor.mode = 2;
      state.editor.allowOverlap = true;
      writer.mode = writer.RDF;
      writer.allowOverlap = true;
  }

  state.editor.editorMode = editorMode;

  return state.editor.editorModes.find((edMode) => edMode.value === editorMode);
};

export const getEditorModeByKey = ({ state }: Context, key: number) => {
  return state.editor.editorModes.find((editorMode) => editorMode.key === key);
};

export const getEditorModeByValue = ({ state }: Context, value: string) => {
  return state.editor.editorModes.find((editorMode) => editorMode.value === value);
};

export const setAnnotationrMode = ({ state }: Context, value: number) => {
  window.writer.annotationMode = value;
  state.editor.annotationMode = value;
  return state.editor.annotationModes.find((annotationMode) => annotationMode.value === value);
};

export const addShema = ({ state }: Context, newSchema: Schema) => {
  const schemaId: string = window.writer.schemaManager.addSchema(newSchema);
  const schema: Schema = { ...newSchema, id: schemaId };
  state.editor.schemas = [...state.editor.schemas, schema];
  return schema;
};

export const resetDialogWarnings = ({ state }: Context) => {
  Cookies.remove(DIALOG_PREFS_COOKIE_NAME, { path: '' });
};

export const resetPreferences = ({ state, actions }: Context) => {
  if (state.editor.currentFontSize !== '11pt') actions.editor.setFontSize('11pt');
  if (state.editor.showTags !== false) actions.editor.showTags(false);
  if (state.editor.showEntities !== true) actions.editor.showEntities(true);
  if (state.editor.editorMode !== 'xmlrdfoverlap') actions.editor.setEditorMode('xmlrdf');
  if (state.editor.annotationMode !== 3) actions.editor.setAnnotationrMode(3);

  actions.ui.resetPreferences();
};

export const getSettings = ({ state }: Context, config?: string) => {
  return {
    isAdvanced: true,
    fontSize: state.editor.currentFontSize,
    showEntities: state.editor.showEntities,
    showTags: state.editor.showTags,
    mode: state.editor.mode,
    editorMode: state.editor.editorMode,
    annotationMode: state.editor.annotationMode,
    allowOverlap: state.editor.allowOverlap,

    schemaId: state.document.schemaId,
  };
};

export const setIsAnnotator = ({ state }: Context, value: boolean) => {
  state.editor.isAnnotator = value;
};
