import $ from 'jquery';
import 'jquery-contextmenu';

function TagContextMenu(writer) {
    this.w = writer;
    this.container = `#${writer.containerId}`;
    this.selector = `#${this.w.layoutManager.$containerid}`; //`#${writer.containerId}`;

    // these properties are set in the show method
    this.tagId = null;
    this.isEntity = false;
    this.isMultiple = false;
    this.useSelection = false;

    // dynamically built context menu
    $.contextMenu({
        selector: this.selector,
        trigger: 'none',
        build: ($trigger, event) => {
            return {
                appendTo: `#${this.w.layoutManager.$containerid}`,
                className: 'tagContextMenu cwrc',
                animation: {
                    duration: 0,
                    show: 'show',
                    hide: 'hide'
                },
                items: getItems.call(this),
                callback: (key, options, event) => {
                    // general callback used for addTagDialog and changeTagDialog
                    const $li = $(event.target).closest('li.context-menu-item');
                    const action = $li.data('action');

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
            }

        }
    });
}

TagContextMenu.prototype = {
    constructor: TagContextMenu,

    /**
     * Show the tag contextmenu
     * @param {Event} event The original contextmenu event
     * @param {String|Array} tagId The id of the tag. Can be undefined and will be determined by tagger.getCurrentTag. Can be an array to allow for merge action.
     * @param {Boolean} useSelection 
     */
    show: function (event, tagId, useSelection) {
        event.preventDefault();
        event.stopImmediatePropagation();

        if (this.w.isReadOnly || this.w.isEditorReadOnly()) return;

        if (tagId !== undefined && Array.isArray(tagId)) {
            this.isMultiple = true;
            this.isEntity = false;
            this.useSelection = false;
        } else {
            this.isMultiple = false;

            let tag = this.w.tagger.getCurrentTag(tagId)[0];
            if (tagId === undefined) tagId = tag.getAttribute('id');

            let tagName = tag.getAttribute('_tag');
            if (tagName == this.w.schemaManager.getRoot() || tagName == this.w.schemaManager.getHeader()) return;
            this.isEntity = tag.getAttribute('_entity') !== null;
            this.useSelection = useSelection === undefined ? false : useSelection;
        }

        this.tagId = tagId;

        $(this.selector).contextMenu({
            x: event.pageX,
            y: event.pageY
        });
    },

    /**
     * Destroy the tag contextmenu
     */
    destroy: function () {
        $(this.container).contextMenu('destroy');
    }
}

// custom menu item types

// used for tracking the parent menu's action type
$.contextMenu.types.cwrcTag = function (item, parentMenu, root) {
    if (item.icon) this.addClass(`${root.classNames.icon} ${root.classNames.icon}-${item.icon}`);
    $(`<span>${item.name}</span>`).appendTo(this);

    this.data('action', parentMenu.tagAction);
};

function getItems() {
    const items = {};

    if (this.tagId == null) {
        console.warn('tagContextMenu: no tagId!');
        return {};
    }

    if (this.w.isAnnotator) {
        addEntities.call(this, items);
        return items;
    }

    const tag = $('#' + this.tagId, this.w.editor.getBody())[0];

    const needsChildTags = this.isMultiple === false;
    const needsSiblingTags = this.isMultiple === false;
    const needsParentTags = this.isMultiple === true || this.useSelection === false;

    let childTags = {};
    let siblingTags = {};
    let parentTags = {};

    if (needsChildTags) childTags = getChildrenForTag.call(this, tag);
    if (needsSiblingTags) siblingTags = getSiblingsForTag.call(this, tag);
    if (needsParentTags) parentTags = getInsertAroundTags.call(this, tag);

    if (this.isMultiple) {
        items.add_tag_around = {
            name: 'Insert Tag Around',
            icon: 'tag_add',
            tagAction: 'around',
            items: function () {
                return parentTags;
            }()
        }

        items.sep0 = '---';

        items.merge_tags = {
            name: 'Merge Tags',
            icon: 'tag_merge',
            callback: () => {
                const tags = $(`'#${this.tagId.join(',#')}`, this.w.editor.getBody());
                this.w.tagger.mergeTags(tags);
            }
        }

        return items;
    }

    if (this.useSelection) {
        items.add_tag = {
            name: 'Insert Tag',
            icon: 'tag_add',
            tagAction: 'add',
            items: function () {
                return childTags;
            }()
        }
        if (this.w.schemaManager.isSchemaCustom() === false) {
            addEntities.call(this, items);
        }

        items.sep0 = '---';
    }

    if (!this.useSelection) {

        items.add_tag_before = {
            name: 'Insert Tag Before',
            icon: 'tag_add',
            tagAction: 'before',
            items: function () {
                return siblingTags;
            }()
        }

        items.add_tag_after = {
            name: 'Insert Tag After',
            icon: 'tag_add',
            tagAction: 'after',
            items: function () {
                return siblingTags;
            }()
        }

        items.add_tag_around = {
            name: 'Insert Tag Around',
            icon: 'tag_add',
            tagAction: 'around',
            items: function () {
                return parentTags;
            }()
        }

        items.add_tag_inside = {
            name: 'Insert Tag Inside',
            icon: 'tag_add',
            tagAction: 'inside',
            items: function () {
                return childTags;
            }()
        }

        items.sep1 = '---';
    }

    items.edit_tag = {
        name: 'Edit Tag/Entity',
        icon: 'tag_edit',
        callback: () => this.w.tagger.editTagDialog(this.tagId)
    }

    if (!this.isEntity) {
        const tagName = tag.getAttribute('_tag');
        if (this.w.schemaManager.isTagEntity(tagName)) {
            items.convert_tag = {
                name: 'Convert to Entity',
                icon: 'tag_edit',
                callback: () => this.w.schemaManager.mapper.convertTagToEntity(tag, true)
            }
        }
    }

    items.change_tag = {
        name: 'Change Tag',
        icon: 'tag_edit',
        tagAction: 'change',
        items: function () {
            return siblingTags;
        }()
    }

    if (this.isEntity) {
        items.copy_entity = {
            name: 'Copy Entity',
            icon: 'tag_copy',
            callback: () => this.w.tagger.copyTag(this.tagId)
        }
    } else {
        items.copy_tag = {
            name: 'Copy Tag and Contents',
            icon: 'tag_copy',
            callback: () => this.w.tagger.copyTag(this.tagId)
        }
    }

    if (this.w.editor.copiedElement.element !== null) {
        items.paste_tag = {
            name: 'Paste Tag',
            icon: 'tag_paste',
            callback: () => this.w.tagger.pasteTag()
        }
    } else if (this.w.editor.copiedEntity !== null) {
        items.paste_entity = {
            name: 'Paste Entity',
            icon: 'tag_paste',
            callback: () => this.w.tagger.pasteEntity()
        }
    }

    if (this.useSelection) {
        items.split_tag = {
            name: 'Split Tag',
            icon: 'tag_split',
            callback: () => this.w.tagger.splitTag()
        }
    }

    items.sep2 = '---';

    if (this.isEntity) {
        items.remove_entity = {
            name: 'Remove Entity',
            icon: 'tag_remove',
            callback: () => this.w.tagger.removeEntity(this.tagId)
        }
    }

    items.remove_tag = {
        name: 'Remove Tag',
        icon: 'tag_remove',
        callback: () => this.w.tagger.removeStructureTag(this.tagId, false)
    }

    items.remove_content = {
        name: 'Remove Content Only',
        icon: 'tag_remove',
        callback: () => this.w.tagger.removeStructureTagContents(this.tagId)
    }

    items.remove_all = {
        name: 'Remove All',
        icon: 'tag_remove',
        callback: () => this.w.tagger.removeStructureTag(this.tagId, true)
    }

    return items;
}

function addEntities(items) {
    items.add_entity = {
        name: 'Insert Entity',
        icon: 'tag_add',
        className: 'entities',
        items: {
            add_person: {
                name: 'Tag Person',
                icon: 'person',
                callback: () => this.w.tagger.addEntityDialog('person')
            },
            add_place: {
                name: 'Tag Place',
                icon: 'place',
                callback: () => this.w.tagger.addEntityDialog('place')
            },
            add_date: {
                name: 'Tag Date',
                icon: 'date',
                callback: () => this.w.tagger.addEntityDialog('date')
            },
            add_org: {
                name: 'Tag Organization',
                icon: 'org',
                callback: () => this.w.tagger.addEntityDialog('org')
            },
            add_citation: {
                name: 'Tag Citation',
                icon: 'citation',
                callback: () => this.w.tagger.addEntityDialog('citation')
            },
            add_note: {
                name: 'Tag Note',
                icon: 'note',
                callback: () => this.w.tagger.addEntityDialog('note')
            },
            add_title: {
                name: 'Tag Text/Title',
                icon: 'title',
                callback: () => this.w.tagger.addEntityDialog('title')
            },
            add_correction: {
                name: 'Tag Correction',
                icon: 'correction',
                callback: () => this.w.tagger.addEntityDialog('correction')
            },
            add_keyword: {
                name: 'Tag Keyword',
                icon: 'keyword',
                callback: () => this.w.tagger.addEntityDialog('keyword')
            },
            add_link: {
                name: 'Tag Link',
                icon: 'link',
                callback: () => this.w.tagger.addEntityDialog('link')
            },
            add_rs: {
                name: 'Tag RS',
                icon: 'rs',
                callback: () => this.w.tagger.addEntityDialog('rs')
            }
        }
    }

    // filter the entities and only show those we have mappings for
    // TODO cache so we don't do this filtering every time
    const entityMappings = this.w.schemaManager.mapper.getMappings().entities;
    for (let key in items.add_entity.items) {
        const entityType = items.add_entity.items[key].icon;
        if (entityMappings[entityType] === undefined) {
            delete items.add_entity.items[key];
        }
    }

}

function getChildrenForTag(tag) {
    const dfd = $.Deferred();

    setTimeout(() => {
        const path = this.w.utilities.getElementXPath(tag);
        const validKeys = this.w.schemaManager.getChildrenForPath(path);

        dfd.resolve(getSubmenu(validKeys));
    }, 0);

    return dfd.promise();
}

function getParentsForTag(tag) {
    const dfd = $.Deferred();

    setTimeout(() => {
        const path = this.w.utilities.getElementXPath(tag);
        const validKeys = this.w.schemaManager.getParentsForPath(path);

        dfd.resolve(getSubmenu(validKeys));
    }, 0);

    return dfd.promise();
}

function getSiblingsForTag(tag) {
    const dfd = $.Deferred();

    setTimeout(() => {
        const parentTag = $(tag).parents('[_tag]');
        const path = this.w.utilities.getElementXPath(parentTag[0]);
        const validKeys = this.w.schemaManager.getChildrenForPath(path);

        dfd.resolve(getSubmenu(validKeys));
    }, 0);

    return dfd.promise();
}

function getInsertAroundTags(tag) {
    const dfd = $.Deferred();

    setTimeout(() => {
        // valid parents of the tag
        const parentpath = this.w.utilities.getElementXPath(tag);
        const parentKeys = this.w.schemaManager.getParentsForPath(parentpath);

        // valid children of the parent of the tag
        const parentTag = $(tag).parents('[_tag]');
        const parentChildrenpath = this.w.utilities.getElementXPath(parentTag[0]);
        const parentChildrenKeys = this.w.schemaManager.getChildrenForPath(parentChildrenpath);

        const validKeys = [];

        // find common keys
        for (let i = 0; i < parentKeys.length; i++) {
            const pk = parentKeys[i];
            for (let j = 0; j < parentChildrenKeys.length; j++) {
                const pck = parentChildrenKeys[j];
                if (pk.name == pck.name) {
                    validKeys.push(pk);
                    break;
                }
            }
        }

        dfd.resolve(getSubmenu(validKeys));
    }, 0);

    return dfd.promise();
}

const getSubmenu = (tags) => {
    const submenu = {};

    if (tags.length === 0) {
        submenu['no_tags'] = {
            name: 'No Tags Available',
            icon: 'no_tags'
        };
        return submenu;
    }

    function handleKeyUp(e) {
        const query = this.value;
        e.data.$menu.find('li').each((index, el) => {
            if (index > 0) {
                const label = $(el).children('span')[0].firstChild.data;
                (query === '' || label.indexOf(query) !== -1) ? $(el).show(): $(el).hide();
            }
        });
    }

    submenu['tag_filter'] = {
        name: 'Filter Tags',
        type: 'text',
        events: {
            keyup: handleKeyUp
        }
    };

    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        const key = tag.name;
        let label = tag.name;
        if (tag.fullName !== '') {
            label += ` <span class="fullName">(${tag.fullName})</span>`;
        }
        submenu[key] = {
            name: label,
            type: 'cwrcTag',
            icon: 'tag'
        };
    }

    return submenu;
}

export default TagContextMenu;