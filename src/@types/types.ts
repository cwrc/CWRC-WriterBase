import { Editor } from 'tinymce/tinymce';

export interface Editor_CWRC extends Editor {
  writer?: any;
  currentBookmark?: any;
  currentNode?: Node | undefined;
  copiedElement?: {
    selectionType?: any;
    element?: Element | undefined;
  };
  copiedEntity?: any;
  lastKeyPress?: string;
}

//ENTITY
export enum EntityType {
  PERSON = 'person',
  PLACE = 'place',
  ORGANIZATION = 'organization',
  ORG = 'org',
  REFERENCING_STRING = 'referencing_string',
  RS = 'rs',
  TITLE = 'title',
  CITATION = 'citation',
  NOTE = 'note',
  DATE = 'date',
  CORRECTION = 'correction',
  KEYWORD = 'keyword',
  LINK = 'link',
}

//UI
export interface ContextMenuState {
  show: boolean;
  position?: {
    posX: number;
    posY: number;
  };
  eventSource?: string;
  tagId?: string | string[];
  useSelection?: boolean;
  allowsTagAround?: boolean;
  element?: HTMLElement | null;
  hasContentSelection?: boolean;
  isEntity?: boolean;
  isMultiple?: boolean;
  rng?: Range;
  tagName?: string | null;
}
export interface Notify {
  open: boolean;
  message: string;
  hasUndo?: boolean;
}
//SCHEMA
export interface Schema {
  id?: string;
  name: string;
  schemaMappingsId?: string;
  xmlUrl: string | string[];
  cssUrl: string | string[];
}
