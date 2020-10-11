import $ from 'jquery';
import { getSchemaTags } from './schematags'

const toolbarOptions = [
	'schematags',
	'|',
	'schema-tags',
	'|',
	'tag-person',
	'tag-place',
	'tag-organization',
	'tag-title',
	'tag-date',
	'tag-citation',
	'tag-note',
	'tag-correction',
	'tag-keyword',
	'tag-link',
	'tag-referencing-string',
	'add-translation',
	'|',
	'edit-tag',
	'remove-tag',
	'|',
	// 'add-triple',
	// '|',
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

const configureToolbar = (writer, editor) => {
	const w = writer;

	const buttons = [
		{
            title: 'Tags',
            buttonType: 'menuitem',
			slug: 'schema-tags',
			icon: 'tags',
			text: 'Tags',
			tooltip: 'Schema Tags',
			fetch: (callback) => {
				const items = getSchemaTags({editor})
				callback(items);
			}
		},
		{
            title: 'Tag Person',
            buttonType: 'button',
			slug: 'tag-person',
			icon: 'person',
			tooltip: 'Tag Person',
			entityButton: true,
			entityType: 'person',
			onAction: () => w.tagger.addEntityDialog('person'),
		},
		{
			title: 'Tag Place',
            buttonType: 'button',
			slug: 'tag-place',
			icon: 'place',
			tooltip: 'Tag Place',
			entityButton: true,
			entityType: 'place',
			onAction: () => w.tagger.addEntityDialog('place'),
		},
		{
			title: 'Tag Organization',
            buttonType: 'button',
			slug: 'tag-organization',
			icon: 'organization',
			tooltip: 'Tag Organization',
			entityButton: true,
			entityType: 'org',
			onAction: () => w.tagger.addEntityDialog('org'),
		},
		{
			title: 'Tag Text/Title',
            buttonType: 'button',
			slug: 'tag-title',
			icon: 'title',
			tooltip: 'Tag Text/Title',
			entityButton: true,
			entityType: 'title',
			onAction: () => w.tagger.addEntityDialog('title'),
		},
		{
			title: 'Tag Date',
            buttonType: 'button',
			slug: 'tag-date',
			icon: 'date',
			tooltip: 'Tag Date',
			entityButton: true,
			entityType: 'date',
			onAction: () => w.tagger.addEntityDialog('date'),
		},
		{
			title: 'Tag Citation',
            buttonType: 'button',
			slug: 'tag-citation',
			icon: 'citation',
			tooltip: 'Tag Citation',
			entityButton: true,
			entityType: 'citation',
			onAction: () => w.tagger.addEntityDialog('citation'),
		},
		{
			title: 'Tag Note',
            buttonType: 'button',
			slug: 'tag-note',
			icon: 'note',
			tooltip: 'Tag Note',
			entityButton: true,
			entityType: 'note',
			onAction: () => w.tagger.addEntityDialog('note'),
		},
		{
			title: 'Tag Correction',
            buttonType: 'button',
			slug: 'tag-correction',
			icon: 'correction',
			tooltip: 'Tag Correction',
			entityButton: true,
			entityType: 'correction',
			onAction: () => w.tagger.addEntityDialog('correction'),
		},
		{
			title: 'Tag Keyword',
            buttonType: 'button',
			slug: 'tag-keyword',
			icon: 'keyword',
			tooltip: 'Tag Keyword',
			entityButton: true,
			entityType: 'keyword',
			onAction: () => w.tagger.addEntityDialog('keyword'),
		},
		{
			title: 'Tag Link',
            buttonType: 'button',
			slug: 'tag-link',
			icon: 'link',
			tooltip: 'Tag Link',
			entityButton: true,
			entityType: 'link',
			onAction: () => w.tagger.addEntityDialog('link'),
		},
		{
			title: 'Tag Referencing String',
            buttonType: 'button',
			slug: 'tag-referencing-string',
			icon: 'rs',
			tooltip: 'Tag Referencing String',
			entityButton: true,
			entityType: 'rs',
			onAction: () => w.tagger.addEntityDialog('rs'),
		},
		{
			title: 'Add Translation',
            buttonType: 'button',
			slug: 'add-translation',
			icon: 'translation',
			tooltip: 'Add Translation',
			onAction: () => w.dialogManager.show('translation'),
		},
		{
			title: 'Edit Tag/Entity',
            buttonType: 'button',
			slug: 'edit-tag',
			icon: 'tag-edit',
			tooltip: 'Edit Tag/Entity',
			onAction: () => w.tagger.editTagDialog(),
		},
		{
			title: 'Remove Tag',
            buttonType: 'button',
			slug: 'remove-tag',
			icon: 'tag-remove',
			tooltip: 'Remove Tag',
			onAction: () => w.tagger.removeTag(),
		},
		{
			title: 'Add Relation',
            buttonType: 'button',
			slug: 'add-relation',
			icon: `relation`,
			tooltip: 'Add Relation',
			onAction: () => {
				$('#westTabs').tabs('option', 'active', 2);
				w.dialogManager.show('triple');
			},
		},
		{
            title: 'Toggle Tags',
            buttonType: 'toggle',
			slug: 'toggle-tags',
			icon: 'code',
			tooltip: 'Toggle Tags',
			onAction: (api) => {
				$('body', w.editor.getDoc()).toggleClass('showTags');
                api.setActive(!api.isActive());
            },
		},
		{
			title: 'Show Raw XML',
            buttonType: 'button',
			slug: 'show-raw-xml',
			icon: 'markup-file',
			tooltip: 'Show Raw XML',
			onAction: () => w.selection.showSelection(),
		},
		{
			title: 'Edit Raw XML',
            buttonType: 'button',
			slug: 'edit-raw-xml',
			icon: 'edit',
			tooltip: 'Edit Raw XML',
			onAction: () => w.dialogManager.show('editSource'),
		},
		{
			title: 'Validate',
            buttonType: 'button',
			slug: 'validate',
			icon: 'validate',
			tooltip: 'Validate',
			onAction: () => w.validate(),
		},
		{
			title: 'New',
            buttonType: 'button',
			slug: 'new',
			image: `${w.cwrcRootUrl}img/page_white_text.png`,
			tooltip: 'New',
			onAction: () => w.showSaveDialog(),
		},
		{
			title: 'Save',
            buttonType: 'button',
			slug: 'save',
			icon: 'save',
			tooltip: 'Save',
			onAction: () => w.showSaveDialog(),
		},
		{
			title: 'Save As',
            buttonType: 'button',
			slug: 'save-as',
			image: `${w.cwrcRootUrl}img/save_as.png`,
			tooltip: 'Save As',
			onAction: () => w.showSaveAsDialog(),
		},
		{
			title: 'Save & Exit',
            buttonType: 'button',
			slug: 'save-exit',
			image: `${w.cwrcRootUrl}img/save_exit.png`,
			tooltip: 'Save & Exit',
			onAction: () => w.saveAndExit(),
		},
		{
			title: 'Load',
            buttonType: 'button',
			slug: 'load',
			icon: 'load',
			tooltip: 'Load',
			onAction: () => w.showLoadDialog(),
		},
		{
			title: 'Log out',
            buttonType: 'button',
			slug: 'logout',
			icon: 'sign-out',
			tooltip: 'Log out',
			onAction: () => w.exit(),
		},
		{
			title: 'Fullscreen',
            buttonType: 'button',
			slug: 'fullscreen',
			title: 'Toggle Fullscreen',
			icon: 'fullscreen',
			tooltip: 'Toggle Fullscreen',
			onAction: () => w.layoutManager.toggleFullScreen(),
		},
	];

	toolbarOptions.forEach((option) => {
		if (option === '|') return;
		const button = buttons.find((buttonSetting) => buttonSetting.slug === option);
		if (!button)
			return console.warn(
				`${option} has not settings definition and it was not added to the toolbar.`
            );

        //! DEPRECATED: adjust the location of the tooltip
        // button.onmouseenter = function(e) {
        //     const tt = this.tooltip();
        //     const button = $(this.$el[0]);
        //     const position = w.utilities.getOffsetPosition(button);

        //     position.left += $(tt.$el[0]).outerWidth() * -0.5 + button.outerWidth() * 0.5;
        //     position.top += button.outerHeight();

        //     tt.moveTo(position.left, position.top);
        // };

        if (button.buttonType === 'button') editor.ui.registry.addButton(option, button);
		if (button.buttonType === 'toggle') editor.ui.registry.addToggleButton(option, button);
		if (button.buttonType === 'menuitem') editor.ui.registry.addMenuButton(option, button);

		
	});
};

export { toolbarOptions, configureToolbar };
