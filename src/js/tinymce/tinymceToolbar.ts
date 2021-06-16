import $ from 'jquery';
import { Editor } from 'tinymce';

const toolbarOptions = [
  'tags',
  '|',
  'tag-person',
  'tag-place',
  'tag-organization',
  'tag-title',
  'tag-referencing-string',
  'tag-citation',
  'tag-note',
  'tag-date',
  'tag-correction',
  'tag-keyword',
  'tag-link',
  'add-translation',
  '|',
  'edit-tag',
  'remove-tag',
  '|',
  'toggle-tags',
  'show-raw-xml',
  'edit-raw-xml',
  '|',
  'validate',
  'save',
  'load',
  'logout',
  '|',
  'fullscreen',
];

const configureToolbar = (writer: any, editor: Editor) => {
  const toogleButtons = [
    {
      slug: 'toggle-tags',
      icon: 'code',
      tooltip: 'Toggle Tags',
      onAction: (api: any) => {
        $('body', writer.editor.getDoc()).toggleClass('showTags');
        api.setActive(!api.isActive());
      },
    },
    {
      slug: 'fullscreen',
      icon: 'fullscreen',
      tooltip: 'Toggle Fullscreen',
      onAction: (api: any) => {
        writer.layoutManager.toggleFullScreen();
        api.setActive(!api.isActive());
      },
    },
  ];

  const buttons = [
    {
      text: 'Tags',
      slug: 'tags',
      icon: 'tags',
      tooltip: 'Tags',
      onAction: () => {
        const $button = $('.tox-tbtn').filter(
          (_index, element) => $(element).attr('title') === 'Tags'
        );

        const buttonOffset = $button.offset();
        const buttonHeight = $button.height() ?? 0;

        const posX = buttonOffset ? buttonOffset.left : 0;
        const posY = buttonOffset ? buttonOffset.top + buttonHeight : 0;

        writer.overmindActions.ui.showContextMenu({
          show: true,
          eventSource: 'ribbon',
          position: { posX, posY },
          useSelection: true,
        });
      },
    },
    {
      slug: 'tag-person',
      icon: 'person',
      tooltip: 'Tag Person',
      entityButton: true,
      entityType: 'person',
      onAction: () => writer.tagger.addEntityDialog('person'),
    },
    {
      slug: 'tag-place',
      icon: 'place',
      tooltip: 'Tag Place',
      entityButton: true,
      entityType: 'place',
      onAction: () => writer.tagger.addEntityDialog('place'),
    },
    {
      slug: 'tag-organization',
      icon: 'organization',
      tooltip: 'Tag Organization',
      entityButton: true,
      entityType: 'org',
      onAction: () => writer.tagger.addEntityDialog('org'),
    },
    {
      slug: 'tag-title',
      icon: 'title',
      tooltip: 'Tag Text/Title',
      entityButton: true,
      entityType: 'title',
      onAction: () => writer.tagger.addEntityDialog('title'),
    },
    {
      slug: 'tag-date',
      icon: 'date',
      tooltip: 'Tag Date',
      entityButton: true,
      entityType: 'date',
      onAction: () => writer.tagger.addEntityDialog('date'),
    },
    {
      slug: 'tag-citation',
      icon: 'citation',
      tooltip: 'Tag Citation',
      entityButton: true,
      entityType: 'citation',
      onAction: () => writer.tagger.addEntityDialog('citation'),
    },
    {
      slug: 'tag-note',
      icon: 'note',
      tooltip: 'Tag Note',
      entityButton: true,
      entityType: 'note',
      onAction: () => writer.tagger.addEntityDialog('note'),
    },
    {
      slug: 'tag-correction',
      icon: 'correction',
      tooltip: 'Tag Correction',
      entityButton: true,
      entityType: 'correction',
      onAction: () => writer.tagger.addEntityDialog('correction'),
    },
    {
      slug: 'tag-keyword',
      icon: 'keyword',
      tooltip: 'Tag Keyword',
      entityButton: true,
      entityType: 'keyword',
      onAction: () => writer.tagger.addEntityDialog('keyword'),
    },
    {
      slug: 'tag-link',
      icon: 'link',
      tooltip: 'Tag Link',
      entityButton: true,
      entityType: 'link',
      onAction: () => writer.tagger.addEntityDialog('link'),
    },
    {
      slug: 'tag-referencing-string',
      icon: 'rs',
      tooltip: 'Tag Referencing String',
      entityButton: true,
      entityType: 'rs',
      onAction: () => writer.tagger.addEntityDialog('rs'),
    },
    {
      slug: 'add-translation',
      icon: 'translation',
      tooltip: 'Add Translation',
      onAction: () => writer.dialogManager.show('translation'),
    },
    {
      slug: 'edit-tag',
      icon: 'tag-edit',
      tooltip: 'Edit Tag/Entity',
      onAction: () => writer.tagger.editTagDialog(),
    },
    {
      slug: 'remove-tag',
      icon: 'tag-remove',
      tooltip: 'Remove Tag',
      onAction: () => writer.tagger.removeTag(),
    },
    {
      slug: 'add-relation',
      icon: `relation`,
      tooltip: 'Add Relation',
      onAction: () => {
        //@ts-ignore
        $('#westTabs').tabs('option', 'active', 2);
        writer.dialogManager.show('triple');
      },
    },
    {
      slug: 'show-raw-xml',
      icon: 'markup-file',
      tooltip: 'Show Raw XML',
      onAction: () => writer.selection.showSelection(),
    },
    {
      slug: 'edit-raw-xml',
      icon: 'edit',
      tooltip: 'Edit Raw XML',
      onAction: () => writer.dialogManager.show('editSource'),
    },
    {
      slug: 'validate',
      icon: 'validate',
      tooltip: 'Validate',
      onAction: () => writer.validate(),
    },
    {
      slug: 'new',
      // image: `${writer.cwrcRootUrl}img/page_white_text.png`,
      tooltip: 'New',
      onAction: () => writer.showSaveDialog(),
    },
    {
      slug: 'save',
      icon: 'save',
      tooltip: 'Save',
      onAction: () => writer.showSaveDialog(),
    },
    {
      slug: 'save-as',
      // image: `${writer.cwrcRootUrl}img/save_as.png`,
      tooltip: 'Save As',
      onAction: () => writer.showSaveAsDialog(),
    },
    {
      slug: 'save-exit',
      // image: `${writer.cwrcRootUrl}img/save_exit.png`,
      tooltip: 'Save & Exit',
      onAction: () => writer.saveAndExit(),
    },
    {
      slug: 'load',
      icon: 'load',
      tooltip: 'Load',
      onAction: () => writer.showLoadDialog(),
    },
    {
      slug: 'logout',
      icon: 'sign-out',
      tooltip: 'Log out',
      onAction: () => writer.exit(),
    },
  ];

  toogleButtons.map((button) => {
    editor.ui.registry.addToggleButton(button.slug, button);
  });

  buttons.map((button) => {
    editor.ui.registry.addButton(button.slug, button);
  });
};

export { configureToolbar, toolbarOptions };
