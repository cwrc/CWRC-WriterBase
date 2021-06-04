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
