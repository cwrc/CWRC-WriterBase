'use strict';

var $ = require('jquery');
require('jquery-contextmenu');

function TagContextMenu(writer) {
    this.w = writer;

    this.selector = '#'+writer.containerId;

    this.tagId = null;
    this.tag = null;
    this.isEntity = false;
    this.useSelection = false;

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

    show: function(event, tagId, useSelection) {
        event.preventDefault();
        event.stopImmediatePropagation();
        
        console.log('show', tagId);

        var tag = this.w.tagger.getCurrentTag(tagId)[0];

        var tagName = tag.getAttribute('_tag');
        if (tagName == this.w.schemaManager.getRoot() || tagName == this.w.schemaManager.getHeader()) return;

        this.tagId = tagId;
        this.tag = tag;
        this.isEntity = tag.getAttribute('_entity') !== null;
        this.useSelection = useSelection === undefined ? false : useSelection;
        
        // TODO
        // // find common keys between parent and sibling
        // for (var i = parentKeys.length-1; i >= 0; i--) {
        //     var pk = parentKeys[i];
        //     var match = false;
        //     for (var j = 0; j < siblingKeys.length; j++) {
        //         var sk = siblingKeys[j];
        //         if (pk.name == sk.name) {
        //             match = true;
        //             break;
        //         }
        //     }
        //     if (!match) {
        //         parentKeys.splice(i, 1);
        //     }
        // }

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

// adds a filter to a submenu
$.contextMenu.types.filterMenu = function(item, parentMenu, root) {
    if (item.icon) {
        this.addClass(root.classNames.icon+' '+root.classNames.icon+'-'+item.icon);
    }
    $('<span>'+item.name+'</span>').appendTo(this);
    item.appendTo = item.$node;
    this.data('contextMenu', item).addClass('context-menu-submenu');
    item.callback = null;

    var $parentLi = this;

    // submenu
    if ('function' === typeof item.items.then) {
        $.contextMenu.op.processPromises(item, root, item.items);
        // item.items.then(function(submenuItems) {
        //     var ul = $parentLi.children('ul');
        //     addFilter(ul);
        // });
    } else {
        $.contextMenu.op.create(item, root);
    }
};

function addFilter($ul) {
    console.log($ul[0])
}

function getItems() {
    var items = {};

    // TODO merge

    var childTags = getChildrenForTag.call(this, this.tag);
    var siblingTags = getSiblingsForTag.call(this, this.tag);
    var parentTags = getParentsForTag.call(this, this.tag);

    if (this.useSelection) {
        items.add_tag = {
            name: 'Insert Tag',
            icon: 'tag_add',
            tagAction: 'add',
            type: 'filterMenu',
            items: function() { return childTags; }()
        }
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
        items.sep0 = '---';
    }

    if (!this.useSelection) {
        items.add_tag_before = {
            name: 'Insert Tag Before',
            icon: 'tag_add',
            tagAction: 'before',
            type: 'filterMenu',
            items: function() { return siblingTags; }()
        }
        items.add_tag_after = {
            name: 'Insert Tag After',
            icon: 'tag_add',
            tagAction: 'after',
            type: 'filterMenu',
            items: function() { return siblingTags; }()
        }
        items.add_tag_around = {
            name: 'Insert Tag Around',
            icon: 'tag_add',
            tagAction: 'around',
            type: 'filterMenu',
            items: function() { return parentTags; }()
        },
        items.add_tag_inside = {
            name: 'Insert Tag Inside',
            icon: 'tag_add',
            tagAction: 'inside',
            type: 'filterMenu',
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
        var tagName = this.tag.getAttribute('_tag');
        if (this.w.utilities.isTagEntity(tagName)) {
            items.convert_tag = {
                name: 'Convert to Entity',
                icon: 'tag_edit',
                callback: function() {
                    this.w.tagger.convertTagToEntity(this.w.tagger.getCurrentTag());
                }.bind(this)
            }
        }
    }
    items.change_tag = {
        name: 'Change Tag',
        icon: 'tag_edit',
        tagAction: 'change',
        type: 'filterMenu',
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

function getChildrenForTag(tag) {
    var dfd = $.Deferred();

    setTimeout(function() {
        var path = this.w.utilities.getElementXPath(tag);
        var tagName = tag.getAttribute('_tag');
        var validKeys = this.w.utilities.getChildrenForTag({tag: tagName, path: path, type: 'element', returnType: 'array'});

        dfd.resolve(getSubmenu(validKeys));
    }.bind(this), 10);

    return dfd.promise();
}

function getParentsForTag(tag) {
    var dfd = $.Deferred();

    setTimeout(function() {
        var path = this.w.utilities.getElementXPath(tag);
        var tagName = tag.getAttribute('_tag');
        var validKeys = this.w.utilities.getParentsForTag({tag: tagName, path: path, returnType: 'array'});

        dfd.resolve(getSubmenu(validKeys));
    }.bind(this), 10);

    return dfd.promise();
}

function getSiblingsForTag(tag) {
    var dfd = $.Deferred();

    setTimeout(function() {
        var parentTag = $(tag).parents('[_tag]');
        var path = this.w.utilities.getElementXPath(parentTag[0]);
        var tagName = parentTag.attr('_tag');
        var validKeys = this.w.utilities.getChildrenForTag({tag: tagName, path: path, type: 'element', returnType: 'array'});

        dfd.resolve(getSubmenu(validKeys));
    }.bind(this), 10);

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
