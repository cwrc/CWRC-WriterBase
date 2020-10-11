import $ from 'jquery';

let _editor = null;

/**
 * Gets the menu items for all tags in the schema.
 * @param action {String} The action to perform: "add" or "change".
 * @returns {Array} The array of tags.
 */
const getSchemaTags = ({ editor, action = 'add' }) => {
	_editor = editor;
	// action = action === undefined ? "add" : action;

	const menuItems = [];
	// var imageUrl = editor.writer.cwrcRootUrl+'img/';
	const schemaElements = editor.writer.schemaManager.schema.elements;

	const items = filterMenu(schemaElements);

	items.forEach((tag) => {
		const type = 'menuitem';
		const fullName = editor.writer.schemaManager.getFullNameForTag(tag);
		let text = tag;
		if (fullName !== '') text = `${text} (${fullName})`;

		menuItems.push({
			type,
			text,
			action,
			onAction: () => {
				action === 'add'
					? editor.writer.tagger.addTagDialog(tag, action)
					: editor.writer.tagger.changeTagDialog(tag);
			},
		});
	});

	if (menuItems.length === 0) {
		menuItems.push({
			type,
			text: 'No tags available for current parent tag.',
			disabled: true,
			onAction: () => {},
		});
	}

	return menuItems;
};

const filterMenu = (schemaElements) => {
	let node;
	let filterKey;

	// get the node from currentBookmark if available, otherwise use currentNode
	if (_editor.currentBookmark !== null) {
		node = _editor.currentBookmark.rng.commonAncestorContainer;
		while (node.nodeType === 3) {
			node = node.parentNode;
		}
	} else {
		node = _editor.currentNode;
	}

	if (node.nodeType === 9) {
		node = $('body > [_tag]', node)[0]; // we're at the document level so select the root instead
	}

	filterKey = node.getAttribute('_tag');

	if (filterKey === null) {
		// probably in an entity
		let id = node.getAttribute('id');
		if (id === 'entityHighlight') {
			id = _editor.writer.entitiesManager.getCurrentEntity();
			filterKey = _editor.writer.entitiesManager.getEntity(id).getTag();
		} else {
			console.warn('schematags: in unknown tag', node);
		}
	}

	let validKeys = [];

	if (filterKey !== _editor.writer.schemaManager.getHeader()) {
		const children = _editor.writer.schemaManager.getChildrenForTag(filterKey);
		validKeys = children.map((child) => child.name);
	}

	const filteredElements = schemaElements.filter((tag) => validKeys.indexOf(tag) !== -1);

	return filteredElements;
};

export {
    getSchemaTags
}