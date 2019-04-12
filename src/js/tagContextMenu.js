'use strict';

var $ = require('jquery');
require('jquery-contextmenu');

function TagContextMenu(writer) {
    this.w = writer;
    this.selector = '#'+writer.containerId;

    // these properties are set in the show method
    this.tagId = null;
    this.isEntity = false;
    this.isMultiple = false;
    this.useSelection = false;

    // dynamically built context menu
    $.contextMenu({
        selector: this.selector,
        trigger: 'none',
        build: function($trigger, event) {
            return {
                appendTo: '#'+this.w.containerId,
                className: 'cwrc',
                animation: {duration: 0, show: 'show', hide: 'hide'},
                items: getItems.call(this),
                callback: function(key, options, event) {
                    // general callback used for addTagDialog and changeTagDialog
                    var $li = $(event.target).closest('li.context-menu-item');
                    var action = $li.data('action');
                    if (action === undefined) {
                        return;
                    }

                    this.w.editor.currentBookmark = this.w.editor.selection.getBookmark(1);
                    
                    switch(action) {
                        case 'change':
                            this.w.tagger.changeTagDialog(key, this.tagId);
                            break;
                        default:
                            this.w.editor.currentBookmark.tagId = this.tagId;
                            this.w.tagger.addTagDialog(key, action, this.tagId);
                            break;
                    }
                }.bind(this)
            }

        }.bind(this)
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
    show: function(event, tagId, useSelection) {
        event.preventDefault();
        event.stopImmediatePropagation();
        
        if (this.w.isReadOnly || this.w.isEditorReadOnly()) {
            return;
        }

        if (tagId !== undefined && Array.isArray(tagId)) {
            this.isMultiple = true;
            this.isEntity = false;
            this.useSelection = false;
        } else {
            this.isMultiple = false;

            var tag = this.w.tagger.getCurrentTag(tagId)[0];
            if (tagId === undefined) {
                tagId = tag.getAttribute('id');
            }

            var tagName = tag.getAttribute('_tag');
            if (tagName == this.w.schemaManager.getRoot() || tagName == this.w.schemaManager.getHeader()) return;
            this.isEntity = tag.getAttribute('_entity') !== null;
            this.useSelection = useSelection === undefined ? false : useSelection;
        }

        this.tagId = tagId;

        $(this.selector).contextMenu({
            x: event.pageX,
            y: event.pageY
        });
    }
}

// custom menu item types

// used for tracking the parent menu's action type
$.contextMenu.types.cwrcTag = function(item, parentMenu, root) {
    if (item.icon) {
        this.addClass(root.classNames.icon+' '+root.classNames.icon+'-'+item.icon);
    }
    $('<span>'+item.name+'</span>').appendTo(this);

    this.data('action', parentMenu.tagAction);
};

function getItems() {
    var items = {};

    if (this.tagId == null) {
        console.warn('tagContextMenu: no tagId!');
        return {};
    }

    if (this.w.isAnnotator) {
        addEntities.call(this, items);
        return items;
    }

    var tag = $('#'+this.tagId, this.w.editor.getBody())[0];

    var needsChildTags = this.isMultiple === false;
    var needsSiblingTags = this.isMultiple === false;
    var needsParentTags = this.isMultiple === true || this.useSelection === false;

    var childTags = {};
    var siblingTags = {};
    var parentTags = {};
    if (needsChildTags) {
        childTags = getChildrenForTag.call(this, tag);
    }
    if (needsSiblingTags) {
        siblingTags = getSiblingsForTag.call(this, tag);
    }
    if (needsParentTags) {
        parentTags = getInsertAroundTags.call(this, tag);
    }

    if (this.isMultiple) {
        items.add_tag_around = {
            name: 'Insert Tag Around',
            icon: 'tag_add',
            tagAction: 'around',
            items: function() { return parentTags; }()
        }
        items.sep0 = '---';
        items.merge_tags = {
            name: 'Merge Tags',
            icon: 'tag_merge',
            callback: function() {
                var tags = $('#'+this.tagId.join(',#'), this.w.editor.getBody());
                this.w.tagger.mergeTags(tags);
            }.bind(this)
        }
        return items;
    }

    if (this.useSelection) {
        items.add_tag = {
            name: 'Insert Tag',
            icon: 'tag_add',
            tagAction: 'add',
            items: function() { return childTags; }()
        }
        addEntities.call(this, items);
        items.sep0 = '---';
    }

    if (!this.useSelection) {
        items.add_tag_before = {
            name: 'Insert Tag Before',
            icon: 'tag_add',
            tagAction: 'before',
            items: function() { return siblingTags; }()
        }
        items.add_tag_after = {
            name: 'Insert Tag After',
            icon: 'tag_add',
            tagAction: 'after',
            items: function() { return siblingTags; }()
        }
        items.add_tag_around = {
            name: 'Insert Tag Around',
            icon: 'tag_add',
            tagAction: 'around',
            items: function() { return parentTags; }()
        },
        items.add_tag_inside = {
            name: 'Insert Tag Inside',
            icon: 'tag_add',
            tagAction: 'inside',
            items: function() { return childTags; }()
        }
        items.sep1 = '---';
    }

    items.edit_tag = {
        name: 'Edit Tag',
        icon: 'tag_edit',
        callback: function() {
            this.w.tagger.editTagDialog(this.tagId);
        }.bind(this)
    }
    if (!this.isEntity) {
        var tagName = tag.getAttribute('_tag');
        if (this.w.schemaManager.isTagEntity(tagName)) {
            items.convert_tag = {
                name: 'Convert to Entity',
                icon: 'tag_edit',
                callback: function() {
                    this.w.tagger.convertTagToEntity($(tag));
                }.bind(this)
            }
        }
    }
    items.change_tag = {
        name: 'Change Tag',
        icon: 'tag_edit',
        tagAction: 'change',
        items: function() { return siblingTags; }()
    }
    if (this.isEntity) {
        items.copy_entity = {
            name: 'Copy Entity',
            icon: 'tag_copy',
            callback: function() {
                this.w.tagger.copyTag(this.tagId);
            }.bind(this)
        }
    } else {
        items.copy_tag = {
            name: 'Copy Tag and Contents',
            icon: 'tag_copy',
            callback: function() {
                this.w.tagger.copyTag(this.tagId);
            }.bind(this)
        }
    }
    if (this.w.editor.copiedElement.element !== null) {
        items.paste_tag = {
            name: 'Paste Tag',
            icon: 'tag_paste',
            callback: function() {
                this.w.tagger.pasteTag();
            }.bind(this)
        }
    } else if (this.w.editor.copiedEntity !== null) {
        items.paste_entity = {
            name: 'Paste Entity',
            icon: 'tag_paste',
            callback: function() {
                this.w.tagger.pasteEntity();
            }.bind(this)
        }
    }
    if (this.useSelection) {
        items.split_tag = {
            name: 'Split Tag',
            icon: 'tag_split',
            callback: function() {
                this.w.tagger.splitTag();
            }.bind(this)
        }
    }
    items.sep2 = '---';
    items.remove_tag = {
        name: 'Remove Tag Only',
        icon: 'tag_remove',
        callback: function() {
            this.w.tagger.removeStructureTag(this.tagId, false);
        }.bind(this)
    }
    items.remove_content = {
        name: 'Remove Content Only',
        icon: 'tag_remove',
        callback: function() {
            this.w.tagger.removeStructureTagContents(this.tagId);
        }.bind(this)
    }
    items.remove_all = {
        name: 'Remove Tag and All Content',
        icon: 'tag_remove',
        callback: function() {
            this.w.tagger.removeStructureTag(this.tagId, true);
        }.bind(this)
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
                callback: function() {
                    this.w.tagger.addEntityDialog('person');
                }.bind(this)
            },
            add_place: {
                name: 'Tag Place',
                icon: 'place',
                callback: function() {
                    this.w.tagger.addEntityDialog('place');
                }.bind(this)
            },
            add_date: {
                name: 'Tag Date',
                icon: 'date',
                callback: function() {
                    this.w.tagger.addEntityDialog('date');
                }.bind(this)
            },
            add_org: {
                name: 'Tag Organization',
                icon: 'org',
                callback: function() {
                    this.w.tagger.addEntityDialog('org');
                }.bind(this)
            },
            add_citation: {
                name: 'Tag Citation',
                icon: 'citation',
                callback: function() {
                    this.w.tagger.addEntityDialog('citation');
                }.bind(this)
            },
            add_note: {
                name: 'Tag Note',
                icon: 'note',
                callback: function() {
                    this.w.tagger.addEntityDialog('note');
                }.bind(this)
            },
            add_title: {
                name: 'Tag Text/Title',
                icon: 'title',
                callback: function() {
                    this.w.tagger.addEntityDialog('title');
                }.bind(this)
            },
            add_correction: {
                name: 'Tag Correction',
                icon: 'correction',
                callback: function() {
                    this.w.tagger.addEntityDialog('correction');
                }.bind(this)
            },
            add_keyword: {
                name: 'Tag Keyword',
                icon: 'keyword',
                callback: function() {
                    this.w.tagger.addEntityDialog('keyword');
                }.bind(this)
            },
            add_link: {
                name: 'Tag Link',
                icon: 'link',
                callback: function() {
                    this.w.tagger.addEntityDialog('link');
                }.bind(this)
            }
        }
    }
}

function getChildrenForTag(tag) {
    var dfd = $.Deferred();

    setTimeout(function() {
        var path = this.w.utilities.getElementXPath(tag);
        var validKeys = this.w.schemaManager.getChildrenForPath(path);

        dfd.resolve(getSubmenu(validKeys));
    }.bind(this), 0);

    return dfd.promise();
}

function getParentsForTag(tag) {
    var dfd = $.Deferred();

    setTimeout(function() {
        var path = this.w.utilities.getElementXPath(tag);
        var validKeys = this.w.schemaManager.getParentsForPath(path);

        dfd.resolve(getSubmenu(validKeys));
    }.bind(this), 0);

    return dfd.promise();
}

function getSiblingsForTag(tag) {
    var dfd = $.Deferred();

    setTimeout(function() {
        var parentTag = $(tag).parents('[_tag]');
        var path = this.w.utilities.getElementXPath(parentTag[0]);
        var validKeys = this.w.schemaManager.getChildrenForPath(path);

        dfd.resolve(getSubmenu(validKeys));
    }.bind(this), 0);

    return dfd.promise();
}

function getInsertAroundTags(tag) {
    var dfd = $.Deferred();

    setTimeout(function() {
        // valid parents of the tag
        var path = this.w.utilities.getElementXPath(tag);
        var parentKeys = this.w.schemaManager.getParentsForPath(path);

        // valid children of the parent of the tag
        var parentTag = $(tag).parents('[_tag]');
        var path = this.w.utilities.getElementXPath(parentTag[0]);
        var parentChildrenKeys = this.w.schemaManager.getChildrenForPath(path);

        var validKeys = [];

        // find common keys
        for (var i = 0; i < parentKeys.length; i++) {
            var pk = parentKeys[i];
            for (var j = 0; j < parentChildrenKeys.length; j++) {
                var pck = parentChildrenKeys[j];
                if (pk.name == pck.name) {
                    validKeys.push(pk);
                    break;
                }
            }
        }

        dfd.resolve(getSubmenu(validKeys));
    }.bind(this), 0);

    return dfd.promise();
}

function getSubmenu(tags) {
    var submenu = {};
    if (tags.length === 0) {
        submenu['no_tags'] = {
            name: 'No Tags Available',
            icon: 'no_tags'
        };
    } else {
        submenu['tag_filter'] = {
            name: 'Filter Tags',
            type: 'text',
            events: {
                keyup: function(e) {
                    var query = this.value;
                    e.data.$menu.find('li').each(function(index, el) {
                        if (index > 0) {
                            var label = $(el).children('span')[0].firstChild.data;
                            if (query === '' || label.indexOf(query) !== -1) {
                                $(el).show();
                            } else {
                                $(el).hide();
                            }
                        }
                    });
                }
            }
        };
        for (var i = 0; i < tags.length; i++) {
            var tag = tags[i];
            var key = tag.name;
            var label = tag.name;
            if (tag.fullName !== '') {
                label += ' <span class="fullName">('+tag.fullName+')</span>';
            }
            submenu[key] = {
                name: label,
                type: 'cwrcTag',
                icon: 'tag'
            };
        }
    }
    return submenu;
}

module.exports = TagContextMenu;
