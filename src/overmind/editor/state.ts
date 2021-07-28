import { Schema } from '@src/@types/types';
import { derived } from 'overmind';

type State = {
  advancedSettings: boolean;
  allowOverlap: boolean;
  annotationMode: number;
  annotationModeLabel: string;
  annotationModes: {
    value: number;
    label: string;
  }[];
  currentFontSize: string;
  editorMode: string;
  editorModeLabel: string;
  editorModes: {
    key: number;
    value: string;
    label: string;
  }[];
  fontSizeOptions: string[];
  isAnnotator: boolean;
  isReadonly: boolean;
  mode: number;
  schemas: Schema[];
  schemaProxyXmlEndpoint?: string;
  schemaProxyCssEndpoint?: string;
  settings?: any;
  showEntities: boolean;
  showTags: boolean;
};

export const state: State = {
  advancedSettings: true,
  allowOverlap: false,
  annotationMode: 3,
  annotationModes: [
    { value: 1, label: 'RDF/XML' },
    { value: 3, label: 'JSON-LD' },
  ],
  annotationModeLabel: derived((state: State) => {
    const annotatonMode = state.annotationModes.find((mode) => mode.value === state.annotationMode);
    if (!annotatonMode) return '';
    return annotatonMode.label;
  }),
  currentFontSize: '11pt',
  editorMode: 'xmlrdf',
  editorModeLabel: derived((state: State) => {
    const editMode = state.editorModes.find((mode) => mode.value === state.editorMode);
    if (!editMode) return '';
    return editMode.label;
  }),
  editorModes: [
    { key: 1, value: 'xml', label: 'XML only (no overlap)' },
    { key: 0, value: 'xmlrdf', label: 'XML and RDF (no overlap)' },
    { key: 0, value: 'xmlrdfoverlap', label: 'XML and RDF (overlapping entities)' },
    { key: 2, value: 'rdf', label: 'RDF only' },
  ],
  fontSizeOptions: ['8pt', '9pt', '10pt', '11pt', '12pt', '13pt', '14pt', '16pt', '18pt'],
  isAnnotator: false,
  isReadonly: false,
  mode: 0,
  showEntities: true,
  showTags: false,
  schemas: [],
};
