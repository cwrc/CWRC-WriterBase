import tinymce, { Editor } from 'tinymce/tinymce';

import iconCitation from '../../icons/address-card-solid.svg';
import titleIcon from '../../icons/book-solid.svg';
import rsIcon from '../../icons/box-open-solid.svg';
import iconDate from '../../icons/calendar-alt-solid.svg';
import validateIcon from '../../icons/clipboard-check-solid.svg';
import codeIcon from '../../icons/code-solid.svg';
import editIcon from '../../icons/edit-solid.svg';
import correctionIcon from '../../icons/exclamation-mark-solid.svg';
// import fullscreenIcon from '../../icons/expand-arrows-alt-solid.svg';
import markupFileIcon from '../../icons/file-code-solid.svg';
import loadIcon from '../../icons/folder-open-solid.svg';
import iconPlace from '../../icons/globe-solid.svg';
import keywordIcon from '../../icons/key-solid.svg';
import translationIcon from '../../icons/language-solid.svg';
import linkIcon from '../../icons/link-solid.svg';
import relationIcon from '../../icons/project-diagram-solid.svg';
import saveIcon from '../../icons/save-solid.svg';
import signOutIcon from '../../icons/sign-out-alt-solid.svg';
import iconNote from '../../icons/sticky-note-solid.svg';
import tagEditIcon from '../../icons/tag-edit-solid.svg';
import tagRemoveIcon from '../../icons/tag-remove-solid.svg';
import iconsTags from '../../icons/tags-solid.svg';
import iconPerson from '../../icons/user-solid.svg';
import iconOrg from '../../icons/users-solid.svg';

export const addIconPack = (editor: Editor) => {
  editor.ui.registry.addIcon('tags', iconsTags);
  editor.ui.registry.addIcon('person', iconPerson);
  editor.ui.registry.addIcon('place', iconPlace);
  editor.ui.registry.addIcon('title', titleIcon);
  editor.ui.registry.addIcon('date', iconDate);
  editor.ui.registry.addIcon('organization', iconOrg);
  editor.ui.registry.addIcon('citation', iconCitation);
  editor.ui.registry.addIcon('note', iconNote);
  editor.ui.registry.addIcon('correction', correctionIcon);
  editor.ui.registry.addIcon('keyword', keywordIcon);
  editor.ui.registry.addIcon('link', linkIcon);
  editor.ui.registry.addIcon('rs', rsIcon);
  editor.ui.registry.addIcon('translation', translationIcon);
  editor.ui.registry.addIcon('relation', relationIcon);
  editor.ui.registry.addIcon('tag-edit', tagEditIcon);
  editor.ui.registry.addIcon('tag-remove', tagRemoveIcon);
  editor.ui.registry.addIcon('code', codeIcon);
  editor.ui.registry.addIcon('markup-file', markupFileIcon);
  editor.ui.registry.addIcon('edit', editIcon);
  editor.ui.registry.addIcon('validate', validateIcon);
  editor.ui.registry.addIcon('save', saveIcon);
  editor.ui.registry.addIcon('load', loadIcon);
  editor.ui.registry.addIcon('sign-out', signOutIcon);
  // editor.ui.registry.addIcon('fullscreen', fullscreenIcon);
};