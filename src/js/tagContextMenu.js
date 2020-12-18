import $ from 'jquery';
import 'jquery-contextmenu';
import { sortBy } from 'lodash';
import schemaNavigator from './schema/schemaNavigator4';

//Search box
$.contextMenu.types.search = function(item, opt) {
	$(`<label for="contextmenu_search" class="contextmenu_search">
            <input type="input" id="contextmenu_search" placeholder="Search">
            <i class="fas fa-search contextmenu_search__icon"></i>
		</label>`).appendTo(this);

	this.addClass('contextmenu_search_container');
	this.on('contextmenu:focus', (event) => event.stopImmediatePropagation());
	this.on('keyup', (e) => item.events.keyup(e, opt));
};

// eslint-disable-next-line no-unused-vars
const logStyle =
	'color: #333; font-weight: bold; background-color: #ededed;padding: 5px; border-radius: 5px';

class TagContextMenu {
	constructor(writer) {
		this.w = writer;
		this.container = `#${writer.containerId}`;
		this.selector = `#${writer.layoutManager.$containerid}`; //`#${writer.containerId}`;

		// these properties are set in the show method
		this.tagId = null;
		this.isEntity = false;
		this.isMultiple = false;
		this.useSelection = false;

		this.node = null;
		this.element = null;
		this.context = {};

		// dynamically built context menu
		$.contextMenu({
			selector: this.selector,
			trigger: 'none',
			// eslint-disable-next-line no-unused-vars
			build: ($trigger, event) => {
				return {
					appendTo: `#${this.w.layoutManager.$containerid}`,
					className: 'tagContextMenu cwrc',
					animation: { duration: 0, show: 'show', hide: 'hide' },
					items: this.#getItems(),
					callback: (key, options, event) => {
						// general callback
						console.log({ key, options, event });
					},
				};
			},
		});
	}

	/**
	 * Show the tag contextmenu
	 * @param {Event} event The original contextmenu event
	 * @param {String|Array} tagId The id of the tag. Can be undefined and will be determined by tagger.getCurrentTag. Can be an array to allow for merge action.
	 * @param {Boolean} useSelection
	 */
	show({ event, tagId, useSelection }) {
		event.preventDefault();
		event.stopImmediatePropagation();

		if (this.w.isReadOnly || this.w.isEditorReadOnly()) return;

		this.node = this.w.editor.currentBookmark.rng.commonAncestorContainer;
		// console.log(this.w.editor.currentBookmark.rng);

		this.element = this.node.nodeType === 1 ? this.node : this.node.parentElement;
		this.tagId = this.element.id;

		if (tagId !== undefined && Array.isArray(tagId)) {
			this.isMultiple = true;
			this.isEntity = false;
			this.useSelection = false;
		} else {
			this.isMultiple = false;
			let tagName = this.element.getAttribute('_tag');
			if (
				tagName === this.w.schemaManager.getRoot() ||
				tagName === this.w.schemaManager.getHeader()
			) {
				return;
			}

			this.isEntity = this.element.getAttribute('_entity') !== null;
			this.useSelection = useSelection === undefined ? false : useSelection;
		}

		this.#processContext();

		$(this.selector).contextMenu({
			x: event.pageX,
			y: event.pageY,
		});
	}

	/**
	 * Destroy the tag contextmenu
	 */
	destroy() {
		$(this.container).contextMenu('destroy');
	}

	//--- PRIVATE METHODS ---//
	#processContext() {
		const needsChildTags = this.isMultiple === false;
		const needsSiblingTags = this.isMultiple === false;
		const needsParentTags = this.isMultiple === true || this.useSelection === false;

		let childTags = {};
		let siblingTags = {};
		let parentTags = {};

		if (needsChildTags) childTags = this.#getChildrenForTag(this.element);
		if (needsSiblingTags || needsParentTags)
			siblingTags = this.#getSiblingsForTag(this.element);
		if (needsParentTags) parentTags = this.#getParentsForTag(this.element);

		this.context = { childTags, siblingTags, parentTags };
	}

	#getItems() {
		if (this.w.isAnnotator) {
			this.#getEntitiesOptions(items);
			return items;
		}

		const { childTags, siblingTags, parentTags } = this.context;
		const items = {};

		if (this.isMultiple) {
			items.add_tag_around = {
				name: 'Add Tag Around',
				icon: 'fas fa-plus-circle',
				className: 'context-menu-item-new',
				items: (() => {
					const filteredOptions = this.#filterTagsAround({
						parentTags,
						childrenForParent: siblingTags,
					});
					const options = this.#simplifyAndSortTags(filteredOptions);
					const submenu = this.#getSubmenu({ options, action: 'around' });
					return submenu;
				})(),
			};

			items.sep0 = '---';

			items.merge_tags = {
				name: 'Merge Tags',
				icon: 'fas fa-code-branch',
				className: 'context-menu-item-new',
				callback: () => {
					const tags = $(`'#${this.tagId.join(',#')}`, this.w.editor.getBody());
					this.w.tagger.mergeTags(tags);
				},
			};

			return items;
		}

		if (this.useSelection) {
			items.add_tag = {
				name: 'Add Tag',
				icon: 'fas fa-plus-circle',
				className: 'context-menu-item-new',
				items: (() => {
					const filteredOptions = this.#filterChildren({ tags: childTags });
					const options = this.#simplifyAndSortTags(filteredOptions);
					const submenu = this.#getSubmenu({ options, action: 'add' });
					return submenu;
				})(),
			};

			if (this.w.schemaManager.isSchemaCustom() === false) {
				this.#getEntitiesOptions(items);
			}

			items.sep0 = '---';
		}

		if (!this.useSelection) {
			items.add_tag_before = {
				name: 'Add Tag Before',
				icon: 'fas fa-plus-circle',
				className: 'context-menu-item-new',
				items: (() => {
					const filteredOptions = this.#filterSiblings({
						tags: siblingTags,
						action: 'before',
					});
					const options = this.#simplifyAndSortTags(filteredOptions);
					const submenu = this.#getSubmenu({ options, action: 'before' });
					return submenu;
				})(),
			};

			items.add_tag_after = {
				name: 'Add Tag After',
				icon: 'fas fa-plus-circle',
				className: 'context-menu-item-new',
				items: (() => {
					const filteredOptions = this.#filterSiblings({
						tags: siblingTags,
						action: 'after',
					});
					const options = this.#simplifyAndSortTags(filteredOptions);
					const submenu = this.#getSubmenu({ options, action: 'after' });
					return submenu;
				})(),
			};

			items.add_tag_around = {
				name: 'Add Tag Around',
				icon: 'fas fa-plus-circle',
				className: 'context-menu-item-new',
				items: (() => {
					const filteredOptions = this.#filterTagsAround({
						parentTags,
						childrenForParent: siblingTags,
					});
					const options = this.#simplifyAndSortTags(filteredOptions);
					const submenu = this.#getSubmenu({ options, action: 'around' });
					return submenu;
				})(),
			};

			items.add_tag_inside = {
				name: 'Add Tag Inside',
				icon: 'fas fa-plus-circle',
				className: 'context-menu-item-new',
				items: (() => {
					const filteredOptions = this.#filterTagsInside({ tags: childTags });
					const options = this.#simplifyAndSortTags(filteredOptions);
					const submenu = this.#getSubmenu({ options, action: 'inside' });
					return submenu;
				})(),
			};

			items.sep1 = '---';
		}

		items.edit_tag = {
			name: 'Edit Tag/Entity Annotation',
			icon: 'fas fa-edit',
			className: 'context-menu-item-new',
			callback: () => this.w.tagger.editTagDialog(this.tagId),
		};

		if (!this.isEntity) {
			const tagName = this.element.getAttribute('_tag');
			if (this.w.schemaManager.isTagEntity(tagName)) {
				items.convert_tag = {
					name: 'Convert to Entity Annotation',
					icon: 'fas fa-edit',
					className: 'context-menu-item-new',
					callback: () =>
						this.w.schemaManager.mapper.convertTagToEntity(this.element, true),
				};
			}
		}

		// ! Change tag should considers the filters applied to tag availability.
		// e.g. if the tag in question is part of a OPTIONAL CHOICE patterns, the filter would have removed other options in this patterns
		// That is, filter should be applied depending onf the case of use and context.
		items.change_tag = {
			name: 'Change Tag',
			icon: 'fas fa-edit',
			className: 'context-menu-item-new',
			items: (() => {
				const filteredOptions = this.#filterSiblings({
					tags: siblingTags,
					action: 'change',
				});
				const options = this.#simplifyAndSortTags(filteredOptions);
				const submenu = this.#getSubmenu({ options, action: 'change' });
				return submenu;
			})(),
		};

		if (this.isEntity) {
			items.copy_entity = {
				name: 'Copy Entity',
				icon: 'far fa-clone',
				className: 'context-menu-item-new',
				callback: () => this.w.tagger.copyTag(this.tagId),
			};
		} else {
			items.copy_tag = {
				name: 'Copy Tag and Contents',
				icon: 'fas fa-clone',
				className: 'context-menu-item-new',
				callback: () => this.w.tagger.copyTag(this.tagId),
			};
		}

		if (this.w.editor.copiedElement.element !== null) {
			items.paste_tag = {
				name: 'Paste Tag',
				icon: 'fas fa-clone',
				className: 'context-menu-item-new',
				callback: () => this.w.tagger.pasteTag(),
			};
		} else if (this.w.editor.copiedEntity !== null) {
			items.paste_entity = {
				name: 'Paste Entity',
				icon: 'fas fa-clone',
				className: 'context-menu-item-new',
				callback: () => this.w.tagger.pasteEntity(),
			};
		}

		if (this.useSelection) {
			items.split_tag = {
				name: 'Split Tag',
				icon: 'fas fa-code-branch',
				className: 'context-menu-item-new',
				callback: () => this.w.tagger.splitTag(),
			};
		}

		items.sep2 = '---';

		if (this.isEntity) {
			items.remove_entity = {
				name: 'Remove Entity',
				icon: 'fas fa-minus-circle',
				className: 'context-menu-item-new',
				callback: () => this.w.tagger.removeEntity(this.tagId),
			};
		}

		items.remove_tag = {
			name: 'Remove Tag',
			icon: 'fas fa-minus-circle',
			className: 'context-menu-item-new',
			callback: () => this.w.tagger.removeStructureTag(this.tagId, false),
		};

		items.remove_content = {
			name: 'Remove Content Only',
			icon: 'fas fa-minus-circle',
			className: 'context-menu-item-new',
			callback: () => this.w.tagger.removeStructureTagContents(this.tagId),
		};

		items.remove_all = {
			name: 'Remove All',
			icon: 'fas fa-minus-circle',
			className: 'context-menu-item-new',
			callback: () => this.w.tagger.removeStructureTag(this.tagId, true),
		};

		return items;
	}

	#getEntitiesOptions(items) {
		const entityMappings = this.w.schemaManager.mapper.getMappings().entities;
		const menu = {};

		Object.entries(entityMappings).forEach(([key, value]) => {
			const name = value.label
				? value.label
				: `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
			menu[key] = {
				name,
				icon: `fas ${key}`,
				className: `entities context-menu-item-new ${key}`,
				callback: () => this.w.tagger.addEntityDialog(key),
			};
		});

		items.add_entity = {
			name: 'Add Entity Annotation',
			icon: 'fas fa-plus-circle',
			className: 'entities context-menu-item-new',
			items: menu,
		};
	}

	#getSubmenu = ({ options, action }) => {
		const submenu = {};

		if (options.length === 0) {
			submenu['no_tags'] = {
				name: 'No Tags Available',
				disabled: true,
				className: 'context-menu-item-new submenu',
			};
			return submenu;
		}

		const handleKeyUp = (e, opt) => {
			const query = e.target.value;
			const collection = Object.entries(opt.items);

			const result = collection.filter(([key, itemValue]) => {
				const { name, type, $node } = itemValue;
				if (type === 'search' || key === 'noresult') return;

				const match = query === '' || name.toLowerCase().indexOf(query.toLowerCase()) != -1;

				itemValue.visible = match ? true : false;
				itemValue.visible = match ? $node.show() : $node.hide();

				return match;
			});

			// show/hide noResult
			let noResultItem = collection.find(([key]) => key === 'noresult');
			const [, noResultValue] = noResultItem;
			noResultValue.visible = result.length === 0 ? true : false;
			noResultValue.visible =
				result.length === 0 ? noResultValue.$node.show() : noResultValue.$node.hide();
		};

		if (options.length > 7) {
			submenu['search'] = {
				type: 'search',
				callback: () => false,
				events: { keyup: handleKeyUp },
			};
		}

		options.forEach(({ name, fullName }) => {
			const label = fullName ? `${name} <span class="fullName">(${fullName})</span>` : name;

			submenu[name] = {
				name: label,
				isHtmlName: true,
				className: 'context-menu-item-new submenu',
				visible: true,
			};

			if (action)
				submenu[name].callback = (key) => {
					this.#actionCallback({ key, action });
				};
		});

		submenu['noresult'] = {
			name: 'No result',
			className: 'context-menu-item-new submenu',
			disabled: true,
			visible: false,
		};

		return submenu;
	};

	#actionCallback({ key, action }) {
		// general callback used for addTagDialog and changeTagDialog
		if (action === undefined) return;

		this.w.editor.currentBookmark = this.w.editor.selection.getBookmark(1);

		switch (action) {
			case 'change':
				this.w.tagger.changeTagDialog(key, this.tagId);
				break;
			default:
				this.w.editor.currentBookmark.tagId = this.tagId;
				this.w.tagger.addTagDialog(key, action, this.tagId);
				break;
		}
	}

	#getChildrenForTag(tag) {
		// console.log('%cChildren for Tag', logStyle);
		const path = this.w.utilities.getElementXPath(tag);
		const children = schemaNavigator.getChildrenForPath(path);
		// console.log('%c------', logStyle);
		return children;
	}

	#getParentsForTag(tag) {
		const path = this.w.utilities.getElementXPath(tag);
		const parentsForTag = schemaNavigator.getParentsForPath(path);
		return parentsForTag;
	}

	#getSiblingsForTag(tag) {
		const parentPath = this.w.utilities.getElementXPath(tag.parentElement);
		const childrenForParent = schemaNavigator.getChildrenForPath(parentPath);
		return childrenForParent;
	}

	#filterChildren({ tags }) {
		if (!this.w._settings.filterTags.useDocumentTags) return tags;

		const localContextTags = this.#getLocalContextTags(this.node, this.element);
		if (localContextTags.length === 0) return tags;

		const filteredTags = schemaNavigator.filterByPresentTags(tags, localContextTags);
		return filteredTags;
	}

	#filterSiblings({ tags, action }) {
		if (!this.w._settings.filterTags.useDocumentTags) return tags;

		const parentContextTags = this.#getLocalContextTags(
			this.element,
			this.element.parentElement
		);
		if (parentContextTags.length === 0) return tags;

		let filteredTags = schemaNavigator.filterByPresentTags(tags, parentContextTags);

		if (!this.w._settings.filterTags.useStructuralOrder) return filteredTags;

		if (action) {
			if (action === 'change') {
				filteredTags = this.#limitByPosition({ filteredTags, direction: 'both' });
			} else {
				filteredTags = this.#limitByPosition({ filteredTags, direction: action });
			}
		}

		return filteredTags;
	}

	#filterTagsAround({ parentTags, childrenForParent }) {
		

		const parentContextTags = this.#getLocalContextTags(
			this.element,
			this.element.parentElement
		);

		let filteredChildrenForParent = childrenForParent;
		if (parentContextTags.length > 0  && this.w._settings.filterTags.useDocumentTags === true) {
			filteredChildrenForParent = schemaNavigator.filterByPresentTags(
				childrenForParent,
				parentContextTags
			);
		}

		let limitedTags = filteredChildrenForParent.filter((cTag) =>
			parentTags.find((pTag) => pTag.attributes.name === cTag.attributes.name)
		);

		if (!this.w._settings.filterTags.useStructuralOrder) return limitedTags;

		limitedTags = this.#limitByPosition({ filteredTags: limitedTags, direction: 'both' });

		return limitedTags;
	}

	#filterTagsInside({ tags }) {
		if (!this.w._settings.filterTags.useDocumentTags) return tags;

		const localContextTags = this.#getLocalContextTags(this.node, this.element);
		if (localContextTags.length === 0) return tags;

		let filteredTags = tags;

		for (let i = 0; i < localContextTags.length; i++) {
			const { node } = localContextTags[i];
			const path = this.w.utilities.getElementXPath(node);
			const parentsForTag = schemaNavigator.getParentsForPath(path);

			filteredTags = filteredTags.filter((fTag) =>
				parentsForTag.find((pTag) => pTag.attributes.name === fTag.attributes.name)
			);

			if (filteredTags.length === 0) break;
		}

		return filteredTags;
	}

	#limitByPosition({ filteredTags, direction }) {
		const currentTag = this.context.siblingTags.find(
			(siblings) => siblings.attributes.name === this.element.getAttribute('_tag')
		);
		const nextSibling = this.context.siblingTags.find(
			(siblings) =>
				siblings.attributes.name === this.element.nextElementSibling?.getAttribute('_tag')
		);
		const previousSibling = this.context.siblingTags.find(
			(siblings) =>
				siblings.attributes.name ===
				this.element.previousElementSibling?.getAttribute('_tag')
		);

		filteredTags = filteredTags.filter((tag) => {
			//current
			if (
				tag.pattern.index === currentTag.pattern.index &&
				(currentTag.pattern.name === 'oneOrMore' ||
					currentTag.pattern.name === 'zeroOrMore')
			)
				return tag;

			// before
			if (
				(direction === 'before' || direction === 'both') &&
				tag.pattern.index < currentTag.pattern.index
			) {
				if (tag.pattern.index === previousSibling?.pattern.index) return tag;
				if (!previousSibling) return tag;
			}

			// after
			if (
				(direction === 'after' || direction === 'both') &&
				tag.pattern.index > currentTag.pattern.index
			) {
				if (tag.pattern.index === nextSibling?.pattern.index) return tag;
				if (!nextSibling) return tag;
			}
		});

		return filteredTags;
	}

	#getLocalContextTags(ref, parent) {
		//previous and next sibling
		const previousElementSiblingID = ref?.previousElementSibling?.id;
		const nextElementSiblingID = ref?.nextElementSibling?.id;

		//parent Children
		const parentElementChildren = Object.entries(parent.children);

		//Locate tag relative to the cursors or selection: -1 [BEFORE] | 1 [AFTER]
		let relativePosition = previousElementSiblingID ? -1 : 1; //before cursor

		//Collect children
		// const parentChildren = Object.entries(parentElementChildren);
		let collection = parentElementChildren.map(([, childValue]) => {
			// get child ID & TagName
			const childId = childValue.id;
			const tagName = childValue.getAttribute('_tag');

			//check relative position.
			if (ref.nodeType === 1 && ref.id === childId) relativePosition = 0;
			if (nextElementSiblingID === childId) relativePosition = 1;

			return {
				id: childId,
				node: childValue,
				siblingRelativeIndex: relativePosition,
				tagName,
			};
		});

		//absolute position
		let before = collection.filter(({ position }) => position < 0).length;
		let after = 1;

		collection = collection.map((child) => {
			let p = 0;
			if (child.siblingRelativeIndex < 0) {
				p = before * child.position;
				before--;
			}
			if (child.siblingRelativeIndex > 0) {
				p = after * child.position;
				after++;
			}
			child.siblingRelativeIndex = p;
			return child;
		});

		return collection;
	}

	#simplifyAndSortTags(tags) {
		tags = tags.map(({ fullName = '', attributes: { name: name } }) => ({
			name,
			fullName,
		}));

		tags = sortBy(tags, ['name']);

		return tags;
	}
}

export default TagContextMenu;
