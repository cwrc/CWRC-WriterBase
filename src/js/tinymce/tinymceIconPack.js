const iconPerson = require('../../icons/user-solid.svg');
const iconPlace = require('../../icons/globe-solid.svg');
const titleIcon = require('../../icons/book-solid.svg');
const iconDate = require('../../icons/calendar-alt-solid.svg');
const iconOrg = require('../../icons/users-solid.svg');
const iconCitation = require('../../icons/address-card-solid.svg');
const iconNote = require('../../icons/sticky-note-solid.svg');
const correctionIcon = require('../../icons/exclamation-mark-solid.svg');
const keywordIcon = require('../../icons/key-solid.svg');
const linkIcon = require('../../icons/link-solid.svg');
const rsIcon = require('../../icons/box-open-solid.svg');
const translationIcon = require('../../icons/language-solid.svg');
const relationIcon = require('../../icons/project-diagram-solid.svg');
const tagEditIcon = require('../../icons/tag-edit-solid.svg');
const tagRemoveIcon = require('../../icons/tag-remove-solid.svg');
const codeIcon = require('../../icons/code-solid.svg');
const markupFileIcon = require('../../icons/file-code-solid.svg');
const editIcon = require('../../icons/edit-solid.svg');
const validateIcon = require('../../icons/clipboard-check-solid.svg');
const saveIcon = require('../../icons/save-solid.svg');
const loadIcon = require('../../icons/folder-open-solid.svg');
const signOutIcon = require('../../icons/sign-out-alt-solid.svg');
const fullscreenIcon = require('../../icons/expand-arrows-alt-solid.svg');


const addIconPack = (editor) => {
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
    editor.ui.registry.addIcon('fullscreen', fullscreenIcon);
}

module.exports = {
    addIconPack
};