'use strict';

var tinymce = require('tinymce');
var $ = require('jquery');

tinymce.PluginManager.add('cwrc_contextmenu', function(editor) {
    var menu, items, contextmenuNeverUseNative = editor.settings.contextmenu_never_use_native;
    
    var isNativeOverrideKeyEvent = function (e) {
        return e.ctrlKey && !contextmenuNeverUseNative;
    };

    var isMacWebKit = function () {
        return tinymce.Env.mac && tinymce.Env.webkit;
    };

    /**
     * This takes care of a os x native issue where it expands the selection
     * to the word at the caret position to do "lookups". Since we are overriding
     * the context menu we also need to override this expanding so the behavior becomes
     * normalized. Firefox on os x doesn't expand to the word when using the context menu.
     */
    editor.on('mousedown', function (e) {
        if (isMacWebKit() && e.button === 2 && !isNativeOverrideKeyEvent(e)) {
            if (editor.selection.isCollapsed()) {
                editor.once('contextmenu', function (e) {
                    editor.selection.placeCaretAt(e.clientX, e.clientY);
                });
            }
        }
    });
    
    editor.plugins.cwrc_contextmenu = {
        disabled: false,
        entityTagsOnly: false
    };
    
    editor.on('contextmenu', function(e) {

        if (isNativeOverrideKeyEvent(e)) {
            return;
        }

        e.preventDefault();
        
        if (editor.plugins.cwrc_contextmenu.disabled === true) {
            return;
        }

        // render menu
        if (!menu) {
            // get the filtered tag menus and add them
            var insertFilterPanel = {
                action: 'add'
            };
            editor.execCommand('getFilterMenu', insertFilterPanel);
            
            var changeFilterPanel = {
                action: 'change'
            };
            editor.execCommand('getFilterMenu', changeFilterPanel);
            
            items.splice(1, 0, {
                text: 'Insert Tag',
                category: 'xmlTags',
                type: 'cwrcpanelbutton',
        
                popoverAlign: ['tr-tl','tl-tr','br-bl','bl-br'],
                panel: insertFilterPanel,
                classes: 'cwrc',
                icon: 'cwrc',
                image: editor.writer.cwrcRootUrl+'img/tag_blue_add.png',
                onMouseOver: function(e) {
//                    $(e.control.getEl()).find('button').after('<div class="mce-caret"></div>');
                    e.control.parent().items().each(function(ctrl) {
                        if (ctrl !== e.control) {
                            ctrl.hideMenu();
                        }
                    });
                    e.control.showPanel();
                    
                    var parent = $(e.control.$el[0]);
                    var parentWidth = parent.outerWidth();
                    var position = editor.writer.utilities.getOffsetPosition(parent);
                    
                    var childRect = e.control.panel.layoutRect();
                    if (parentWidth + position.left + childRect.w > $(editor.getContentAreaContainer()).outerWidth()) {
                        e.control.panel.moveBy(-childRect.w+1, -parent.outerHeight());
                    } else {
                        e.control.panel.moveBy(parentWidth+1, -parent.outerHeight());
                    }
                }
            },{
                text: '|'
            },{
                text: 'Change Tag',
                category: 'modifyTag',
                type: 'cwrcpanelbutton',

                popoverAlign: ['tr-tl','tl-tr','br-bl','bl-br'],
                panel: changeFilterPanel,
                classes: 'cwrc',
                icon: 'cwrc',
                image: editor.writer.cwrcRootUrl+'img/tag_blue_edit.png',
                onMouseOver: function(e) {
//                  $(e.control.getEl()).find('button').after('<div class="mce-caret"></div>');
                  e.control.parent().items().each(function(ctrl) {
                      if (ctrl !== e.control) {
                          ctrl.hideMenu();
                      }
                  });
                  e.control.showPanel();
                  
                  var parent = $(e.control.$el[0]);
                  var parentWidth = parent.outerWidth();
                  var position = editor.writer.utilities.getOffsetPosition(parent);
                  
                  var childRect = e.control.panel.layoutRect();
                  if (parentWidth + position.left + childRect.w > $(editor.getContentAreaContainer()).outerWidth()) {
                      e.control.panel.moveBy(-childRect.w+1, -parent.outerHeight());
                  } else {
                      e.control.panel.moveBy(parentWidth+1, -parent.outerHeight());
                  }
              }
            });
            
            menu = tinymce.ui.Factory.create('cwrcmenu', {
                style: 'max-height: none !important;',
                minWidth: 195,
                classes: 'cwrc',
                items: items,
                context: 'contextmenu'
            });
            menu.renderTo(menu.getContainerElm());
            
            editor.on('remove', function() {
                menu.remove();
                menu = null;
            });
        }
        
        // enable/disable items based on current editor state
        var currentTag = editor.writer.tagger.getCurrentTag();
        
        if (tinymce.isMac) {
            // fix for when user right clicks on a tag that doesn't already have focus
            if (currentTag.struct != null) {
                if (currentTag.struct[0] != e.target) {
                    currentTag.struct = $(e.target);
                }
            } else if (currentTag.entity != null) {
                if (currentTag.entity[0] != e.target) {
                    currentTag.entity = $(e.target);
                }
            }
        }
        
        var isTagEntity = false;
        if (currentTag.struct != null) {
            var tagName = currentTag.struct.attr('_tag');
            if (tagName) {
                isTagEntity = editor.writer.utilities.isTagEntity(tagName);
            }
        }
        
        var isSchemaCustom = editor.writer.schemaManager.isSchemaCustom();
        
        menu.items().each(function(item) {
            item.show();
            if (item.settings.category !== undefined) {
                if (isSchemaCustom && item.settings.category.toLowerCase().indexOf('entity') !== -1) {
                    item.hide();
                }
                if (item.settings.category !== 'tagEntity' && editor.plugins.cwrc_contextmenu.entityTagsOnly === true) {
                    item.hide();
                }
                if (item.settings.category === 'convertEntity' && isTagEntity === false) {
                    item.hide();
                }
                if (item.settings.category === 'modifyStruct' && currentTag.struct === null) {
                    item.hide();
                }
                if (item.settings.category === 'modifyTag' && currentTag.entity === null && currentTag.struct === null) {
                    item.hide();
                }
                if (item.settings.category === 'editTag' && currentTag.struct === null) {
                    item.hide();
                }
                if (item.settings.category === 'editEntity' && currentTag.entity === null) {
                    item.hide();
                }
                if (item.settings.category === 'pasteTag' && editor.copiedElement.element === null) {
                    item.hide();
                }
                if (item.settings.category === 'pasteEntity' && editor.entityCopy === null) {
                    item.hide();
                }
                if (item.settings.category === 'copyTag' && currentTag.struct === null) {
                    item.hide();
                }
                if (item.settings.category === 'copyEntity' && currentTag.entity === null) {
                    item.hide();
                }
            }
        });
        
        menu.show();

        var position = editor.writer.utilities.getOffsetPosition(editor.getContentAreaContainer());
        position.left += e.pageX;
        position.top += e.pageY;
        
        var container = editor.writer.layoutManager.getContainer();
        var x = editor.writer.utilities.constrain(position.left, container.outerWidth(), menu.layoutRect().w);
        var y = editor.writer.utilities.constrain(position.top, container.outerHeight(), menu.layoutRect().h);

        menu.moveTo(x, y);
    });
    
    items = [{
        text: 'Insert Entity',
        image: editor.writer.cwrcRootUrl+'img/tag_blue_add.png',
        category: 'tagEntity',
        classes: 'cwrc',
        icon: 'cwrc',
        menu: {
            type: 'cwrcmenu',
            classes: 'cwrc',
            onmove: function(e) {
                var parent = $(e.control.parent().$el[0]);
                var parentWidth = parent.outerWidth();
                var position = editor.writer.utilities.getOffsetPosition(parent);
                
                var childRect = e.control.layoutRect();
                if (parentWidth + position.left + childRect.w > $(editor.getContentAreaContainer()).outerWidth()) {
                    position.left -= childRect.w-2;
                } else {
                    position.left += parent.outerWidth();
                }
                
                e.control.layoutRect({x: position.left, y: position.top}).repaint();
            },
            items: [{
                text: 'Tag Person',
                icon: 'icon', // need an icon entry for any of the images to show
                image: editor.writer.cwrcRootUrl+'img/user.png',
                classes: 'cwrc',
                category: 'tagEntity',
                onclick : function() {
                    editor.writer.tagger.addEntity('person');
                }
            },{
                text: 'Tag Place',
                image: editor.writer.cwrcRootUrl+'img/world.png',
                classes: 'cwrc',
                category: 'tagEntity',
                onclick : function() {
                    editor.writer.tagger.addEntity('place');
                }
            },{
                text: 'Tag Date',
                image: editor.writer.cwrcRootUrl+'img/calendar.png',
                category: 'tagEntity',
                onclick : function() {
                    editor.writer.tagger.addEntity('date');
                }
            },{
                text: 'Tag Organization',
                image: editor.writer.cwrcRootUrl+'img/group.png',
                category: 'tagEntity',
                onclick : function() {
                    editor.writer.tagger.addEntity('org');
                }
            },{
                text: 'Tag Citation',
                image: editor.writer.cwrcRootUrl+'img/vcard.png',
                category: 'tagEntity',
                onclick : function() {
                    editor.writer.tagger.addEntity('citation');
                }
            },{
                text: 'Tag Note',
                image: editor.writer.cwrcRootUrl+'img/note.png',
                category: 'tagEntity',
                onclick : function() {
                    editor.writer.tagger.addEntity('note');
                }
            },{
                text: 'Tag Text/Title',
                image: editor.writer.cwrcRootUrl+'img/book.png',
                category: 'tagEntity',
                onclick : function() {
                    editor.writer.tagger.addEntity('title');
                }
            },{
                text: 'Tag Correction',
                image: editor.writer.cwrcRootUrl+'img/error.png',
                category: 'tagEntity',
                onclick : function() {
                    editor.writer.tagger.addEntity('correction');
                }
            },{
                text: 'Tag Keyword',
                image: editor.writer.cwrcRootUrl+'img/key.png',
                category: 'tagEntity',
                onclick : function() {
                    editor.writer.tagger.addEntity('keyword');
                }
            },{
                text: 'Tag Link',
                image: editor.writer.cwrcRootUrl+'img/link.png',
                category: 'tagEntity',
                onclick : function() {
                    editor.writer.tagger.addEntity('link');
                }
            }]
        }
    },{
        text: 'Convert to Entity',
        image: editor.writer.cwrcRootUrl+'img/tag_blue_edit.png',
        category: 'convertEntity',
        onclick : function() {
            var currentTag = editor.writer.tagger.getCurrentTag();
            editor.writer.tagger.convertTagToEntity(currentTag.struct);
        }
    },{
        text: 'Edit Tag',
        image: editor.writer.cwrcRootUrl+'img/tag_blue_edit.png',
        category: 'editTag',
        onclick : function() {
            editor.execCommand('editTag', null);
        }
    },{
        text: 'Edit Entity',
        image: editor.writer.cwrcRootUrl+'img/tag_blue_edit.png',
        category: 'editEntity',
        onclick : function() {
            editor.execCommand('editTag', null);
        }
    },{
        text: 'Split Tag',
        image: editor.writer.cwrcRootUrl+'img/arrow_divide.png',
        category: 'modifyStruct',
        onclick : function() {
            editor.execCommand('splitTag');
        }
    },{
        text: 'Copy Tag & Contents',
        image: editor.writer.cwrcRootUrl+'img/tag_blue_copy.png',
        category: 'copyTag',
        onclick : function() {
            editor.execCommand('copyTag');
        }
    },{
        text: 'Copy Entity',
        image: editor.writer.cwrcRootUrl+'img/tag_blue_copy.png',
        category: 'copyEntity',
        onclick : function() {
            editor.execCommand('copyTag');
        }
    },{
        text: 'Paste Tag',
        image: editor.writer.cwrcRootUrl+'img/tag_blue_paste.png',
        category: 'pasteTag',
        onclick : function() {
            editor.execCommand('pasteTag');
        }
    },{
        text: 'Paste Entity',
        image: editor.writer.cwrcRootUrl+'img/tag_blue_paste.png',
        category: 'pasteEntity',
        onclick : function() {
            editor.execCommand('pasteEntity');
        }
    },{
      text: '|'  
    },{
        text: 'Remove Tag Only',
        image: editor.writer.cwrcRootUrl+'img/tag_blue_delete.png',
        category: 'modifyTag',
        onclick : function() {
            editor.writer.tagger.removeStructureTag(null, false);
        }
    },{
        text: 'Remove Content Only',
        image: editor.writer.cwrcRootUrl+'img/tag_blue_delete.png',
        category: 'modifyTag',
        onclick : function() {
            editor.writer.tagger.removeStructureTagContents(null);
        }
    },{
        text: 'Remove Tag and All Content',
        image: editor.writer.cwrcRootUrl+'img/tag_blue_delete.png',
        category: 'modifyTag',
        onclick : function() {
            editor.writer.tagger.removeStructureTag(null, t);
        }
    }];
});
