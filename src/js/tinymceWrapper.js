'use strict';

var $ = require('jquery');
window.tinymce = require('tinymce');

require('tinymce/themes/modern/theme.js');
require('tinymce/plugins/paste/index.js');
require('./tinymce_plugins/cwrc_contextmenu.js');
require('./tinymce_plugins/cwrc_path.js');
require('./tinymce_plugins/schematags.js');
require('./tinymce_plugins/treepaste.js');
require('./tinymce_plugins/prevent_delete.js');

function TinymceWrapper() {
}

/**
 * Initialize tinymce.
 * @param {Object} config
 * @param {Writer} config.writer
 * @param {String} config.editorId
 * @param {String} config.layoutContainerId
 * @param {String} [config.buttons1]
 * @param {String} [config.buttons2]
 * @param {String} [config.buttons3]
 */
TinymceWrapper.init = function(config) {
    var w = config.writer;
    var editorId = config.editorId;
    var layoutContainerId = config.layoutContainerId;

    /**
     * Init tinymce
     */
    tinymce.baseURL = w.cwrcRootUrl + '/js'; // need for skin
    tinymce.init({
        selector: '#' + editorId,

        ui_container: '#' + layoutContainerId,

        skin_url: w.cwrcRootUrl + 'css/tinymce',

        content_css: w.cwrcRootUrl + 'css/editor.css',

        contextmenu_never_use_native: true,

        doctype: '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
        element_format: 'xhtml',

        forced_root_block: w.utilities.getBlockTag(),
        keep_styles: false, // false, otherwise tinymce interprets our spans as style elements

        paste_postprocess: function(plugin, ev) {

            // function stripTags(index, $node) {
            //     // remove non-editor tags
            //     if ($node.attr('_tag')) {
            //         $node.children().each(stripTags);
            //     } else {
            //         if ($node.contents().length == 0) {
            //             $node.remove();
            //         } else {
            //             var contents = $node.contents().unwrap();
            //             console.log('stripTags: removing',)
            //             contents.not(':text').each(stripTags);
            //         }
            //     }
            // }

            // stripTags(0, $(ev.node));

            w.tagger.processPastedContent(ev.node);

            window.setTimeout(function() {
                // need to fire contentPasted here, after the content is actually within the document
                w.event('contentPasted').publish();
            }, 0);
        },

        valid_elements: '*[*]', // allow everything

        plugins: 'schematags,cwrc_contextmenu,cwrcpath,preventdelete,paste',
        toolbar1: config.buttons1 == undefined ? 'schematags,|,addperson,addplace,adddate,addorg,addcitation,addnote,addtitle,addcorrection,addkeyword,addlink,|,editTag,removeTag,|,addtriple,|,toggletags,viewmarkup,editsource,|,validate,savebutton,loadbutton,|,fullscreen' : config.buttons1,
        toolbar2: config.buttons2 == undefined ? 'cwrcpath' : config.buttons2,
        toolbar3: config.buttons3 == undefined ? '' : config.buttons3,
        menubar: false,
        elementpath: false,
        statusbar: false,

        branding: false,

        // disables style keyboard shortcuts
        formats: {
            bold: {},
            italic: {},
            underline: {}
        },

        setup: function(ed) {
            // link the writer and editor
            w.editor = ed;
            ed.writer = w;

            // custom properties added to the editor
            ed.currentBookmark = null; // for storing a bookmark used when adding a tag
            ed.currentNode = null; // the node that the cursor is currently in
            ed.contextMenuPos = null; // the position of the context menu (used to position related dialog box)
            ed.copiedElement = { selectionType: null, element: null }; // the element that was copied (when first selected through the structure tree)
            ed.copiedEntity = null; // the entity element that was copied
            ed.lastKeyPress = null; // the last key the user pressed

            ed.on('init', function(args) {
                if (w.isReadOnly === true) {
                    ed.plugins.cwrc_contextmenu.disabled = true;
                    w.layoutManager.hideToolbar();
                    ed.setMode('readonly');
                }
                if (w.isAnnotator === true) {
                    ed.plugins.cwrc_contextmenu.disabled = false;
                    ed.plugins.cwrc_contextmenu.entityTagsOnly = true;
                }

                // modify isBlock method to check _tag attributes
                ed.dom.isBlock = function(node) {
                    if (!node) {
                        return false;
                    }

                    var type = node.nodeType;

                    // If it's a node then check the type and use the nodeName
                    if (type) {
                        if (type === 1) {
                            var tag = node.getAttribute('_tag') || node.nodeName;
                            return !!(ed.schema.getBlockElements()[tag]);
                        }
                    }

                    return !!ed.schema.getBlockElements()[node];
                };

                var settings = w.settings.getSettings();
                var body = $(ed.getBody());
                if (settings.showEntities) body.addClass('showEntities');
                if (settings.showTags) body.addClass('showTags');

                // highlight tracking
                body.on('keydown', onKeyDownHandler).on('keyup', onKeyUpHandler);
                // attach mouseUp to doc because body doesn't always extend to full height of editor panel
                $(ed.iframeElement.contentDocument).on('mouseup', onMouseUpHandler);

                w.event('tinymceInitialized').publish(w);
            });
            ed.on('Change', onChangeHandler);
            ed.on('Undo', onUndoHandler);
            ed.on('Redo', onRedoHandler);
            ed.on('BeforeAddUndo', function(e) {
                // console.log('before add undo')
            });
            ed.on('NodeChange', onNodeChangeHandler);
            ed.on('copy', onCopyHandler);

            function addButtonToEditor(buttonId, settings) {
                // adjust the location of the tooltip
                settings.onmouseenter = function(e) {
                    var tt = this.tooltip();
                    var button = $(this.$el[0]);
                    var position = w.utilities.getOffsetPosition(button);
        
                    position.left += $(tt.$el[0]).outerWidth() * -0.5 + button.outerWidth() * 0.5;
                    position.top += button.outerHeight();
        
                    tt.moveTo(position.left, position.top);
                };
                w.editor.addButton(buttonId, settings);
            };

            addButtonToEditor('addperson', {
                title: 'Tag Person', image: w.cwrcRootUrl + 'img/user.png', entityButton: true,
                onclick: function() {
                    w.tagger.addEntityDialog('person');
                }
            });
            addButtonToEditor('addplace', {
                title: 'Tag Place', image: w.cwrcRootUrl + 'img/world.png', entityButton: true,
                onclick: function() {
                    w.tagger.addEntityDialog('place');
                }
            });
            addButtonToEditor('adddate', {
                title: 'Tag Date', image: w.cwrcRootUrl + 'img/calendar.png', entityButton: true,
                onclick: function() {
                    w.tagger.addEntityDialog('date');
                }
            });
            addButtonToEditor('addevent', {
                title: 'Tag Event', image: w.cwrcRootUrl + 'img/cake.png', entityButton: true,
                onclick: function() {
                    w.tagger.addEntityDialog('event');
                }
            });
            addButtonToEditor('addorg', {
                title: 'Tag Organization', image: w.cwrcRootUrl + 'img/group.png', entityButton: true,
                onclick: function() {
                    w.tagger.addEntityDialog('org');
                }
            });
            addButtonToEditor('addcitation', {
                title: 'Tag Citation', image: w.cwrcRootUrl + 'img/vcard.png', entityButton: true,
                onclick: function() {
                    w.tagger.addEntityDialog('citation');
                }
            });
            addButtonToEditor('addnote', {
                title: 'Tag Note', image: w.cwrcRootUrl + 'img/note.png', entityButton: true,
                onclick: function() {
                    w.tagger.addEntityDialog('note');
                }
            });
            addButtonToEditor('addcorrection', {
                title: 'Tag Correction', image: w.cwrcRootUrl + 'img/error.png', entityButton: true,
                onclick: function() {
                    w.tagger.addEntityDialog('correction');
                }
            });
            addButtonToEditor('addkeyword', {
                title: 'Tag Keyword', image: w.cwrcRootUrl + 'img/key.png', entityButton: true,
                onclick: function() {
                    w.tagger.addEntityDialog('keyword');
                }
            });
            addButtonToEditor('addlink', {
                title: 'Tag Link', image: w.cwrcRootUrl + 'img/link.png', entityButton: true,
                onclick: function() {
                    w.tagger.addEntityDialog('link');
                }
            });
            addButtonToEditor('addtitle', {
                title: 'Tag Text/Title', image: w.cwrcRootUrl + 'img/book.png', entityButton: true,
                onclick: function() {
                    w.tagger.addEntityDialog('title');
                }
            });
            addButtonToEditor('editTag', {
                title: 'Edit Tag', image: w.cwrcRootUrl + 'img/tag_blue_edit.png',
                onclick: function() {
                    w.tagger.editTagDialog();
                }
            });
            addButtonToEditor('removeTag', {
                title: 'Remove Tag', image: w.cwrcRootUrl + 'img/tag_blue_delete.png',
                onclick: function() {
                    w.tagger.removeTag();
                }
            });
            addButtonToEditor('newbutton', {
                title: 'New', image: w.cwrcRootUrl + 'img/page_white_text.png',
                onclick: function() {
                    w.showSaveDialog();
                }
            });
            addButtonToEditor('savebutton', {
                title: 'Save', image: w.cwrcRootUrl + 'img/save.png',
                onclick: function() {
                    w.showSaveDialog();
                }
            });
            addButtonToEditor('saveasbutton', {
                title: 'Save As', image: w.cwrcRootUrl + 'img/save_as.png',
                onclick: function() {
                    w.showSaveAsDialog();
                }
            });
            addButtonToEditor('saveexitbutton', {
                title: 'Save & Exit', image: w.cwrcRootUrl + 'img/save_exit.png',
                onclick: function() {
                    w.saveAndExit();
                }
            });
            addButtonToEditor('loadbutton', {
                title: 'Load', image: w.cwrcRootUrl + 'img/folder_page.png',
                onclick: function() {
                    w.showLoadDialog();
                }
            });

            addButtonToEditor('viewmarkup', {
                title: 'View Markup', image: w.cwrcRootUrl + 'img/page_white_code.png',
                onclick: function() {
                    w.selection.showSelection();
                }
            });
            addButtonToEditor('toggletags', {
                title: 'Toggle Tags', image: w.cwrcRootUrl + 'img/tag.png',
                onclick: function() {
                    $('body', w.editor.getDoc()).toggleClass('showTags');
                    this.active($('body', w.editor.getDoc()).hasClass('showTags'));
                }
            });

            addButtonToEditor('editsource', {
                title: 'Edit Source', image: w.cwrcRootUrl + 'img/page_white_edit.png',
                onclick: function() {
                    w.dialogManager.show('editSource');
                }
            });
            addButtonToEditor('validate', {
                title: 'Validate', image: w.cwrcRootUrl + 'img/validate.png',
                onclick: function() {
                    w.validate();
                }
            });
            addButtonToEditor('addtriple', {
                title: 'Add Relation', image: w.cwrcRootUrl + 'img/chart_org.png',
                onclick: function() {
                    $('#westTabs').tabs('option', 'active', 2);
                    w.dialogManager.show('triple');
                }
            });
            addButtonToEditor('fullscreen', {
                name: 'fullscreen', title: 'Toggle Fullscreen', image: w.cwrcRootUrl + 'img/arrow_out.png',
                onclick: function() {
                    w.layoutManager.toggleFullScreen();
                }
            });

        }
    });

    $(document.body).mousedown(function(e) {
        hideContextMenus(e);
    });

    // writer listeners

    w.event('contentChanged').subscribe(function() {
        console.log('contentChanged');
    });

    w.event('documentLoaded').subscribe(function() {
        w.editor.undoManager.clear();
        w.editor.isNotDirty = true;
    });
    w.event('documentSaved').subscribe(function() {
        w.editor.isNotDirty = true;
    });

    w.event('entityAdded').subscribe(function() {
        w.editor.isNotDirty = false;
    });
    w.event('entityRemoved').subscribe(function() {
        w.editor.isNotDirty = false;
    });
    w.event('entityEdited').subscribe(function() {
        w.editor.isNotDirty = false;
    });


    // tinymce handlers

    function fireNodeChange(nodeEl) {
        // fire the onNodeChange event
        var parents = [];
        w.editor.dom.getParent(nodeEl, function(n) {
            if (n.nodeName == 'BODY')
                return true;

            parents.push(n);
        });
        w.editor.fire('NodeChange', { element: nodeEl, parents: parents });
    };

    function onMouseUpHandler(evt) {
        hideContextMenus(evt);
        doHighlightCheck(w.editor, evt);
        w.event('selectionChanged').publish();
    };

    function onUndoHandler(event) {
        console.log('undoHandler', event);
        w.event('contentChanged').publish();
    };

    function onRedoHandler(event) {
        console.log('redoHandler', event);
        w.event('contentChanged').publish();
    };

    function onKeyDownHandler(evt) {
        w.editor.lastKeyPress = evt.which; // store the last key press
        if (w.isReadOnly) {
            if ((tinymce.isMac ? evt.metaKey : evt.ctrlKey) && evt.which == 70) {
                // allow search
                return;
            }
            evt.preventDefault();
            return;
        }

        w.event('writerKeydown').publish(evt);
    };

    function onKeyUpHandler(evt) {
        // nav keys and backspace check
        if (evt.which >= 33 || evt.which <= 40 || evt.which == 8) {
            doHighlightCheck(w.editor, evt);
        }

        // update current entity
        var entityId = w.entitiesManager.getCurrentEntity();
        if (entityId !== null) {
            var content = $('.entityHighlight', w.editor.getBody()).text();
            var entity = w.entitiesManager.getEntity(entityId);
            if (entity.isNote()) {
                entity.setNoteContent($('#' + entityId, w.editor.getBody()).html());
            }
            entity.setContent(content);
            // TODO update entitiesList
        }

        if (w.editor.currentNode) {
            // check if the node still exists in the document
            if (w.editor.currentNode.parentNode === null) {
                var rng = w.editor.selection.getRng(true);
                var parent = rng.commonAncestorContainer.parentNode;
                // trying to type inside a bogus node?
                // (this can happen on webkit when typing "over" a selected structure tag)
                if (parent.getAttribute('data-mce-bogus') != null) {
                    var $parent = $(parent);
                    var collapseToStart = true;

                    var newCurrentNode = $parent.nextAll('[_tag]')[0];
                    if (newCurrentNode == null) {
                        newCurrentNode = $parent.parent().nextAll('[_tag]')[0];
                        if (newCurrentNode == null) {
                            collapseToStart = false;
                            newCurrentNode = $parent.prevAll('[_tag]')[0];
                        }
                    }

                    if (newCurrentNode != null) {
                        rng.selectNodeContents(newCurrentNode);
                        rng.collapse(collapseToStart);
                        w.editor.selection.setRng(rng);

                        window.setTimeout(function() {
                            fireNodeChange(newCurrentNode);
                        }, 0);
                    }
                }
            }

            // check if text is allowed in this node
            if (w.editor.currentNode.getAttribute('_textallowed') == 'false') {
                if (tinymce.isMac ? evt.metaKey : evt.ctrlKey) {
                    // don't show message if we got here through undo/redo
                    var node = $('[_textallowed="true"]', w.editor.getBody()).first();
                    var rng = w.editor.selection.getRng(true);
                    rng.selectNodeContents(node[0]);
                    rng.collapse(true);
                    w.editor.selection.setRng(rng);
                } else {
                    w.dialogManager.show('message', {
                        title: 'No Text Allowed',
                        msg: 'Text is not allowed in the current tag: ' + w.editor.currentNode.getAttribute('_tag') + '.',
                        type: 'error'
                    });

                    // remove all text
                    $(w.editor.currentNode).contents().filter(function() {
                        return this.nodeType == 3;
                    }).remove();
                }
            }

            // replace br's inserted on shift+enter
            if (evt.shiftKey && evt.which == 13) {
                var node = w.editor.currentNode;
                if ($(node).attr('_tag') == 'lb') node = node.parentNode;
                var tagName = w.utilities.getTagForEditor('lb');
                $(node).find('br').replaceWith('<' + tagName + ' _tag="lb"></' + tagName + '>');
            }
        }

        // enter key
        if (evt.which == 13) {
            // find the element inserted by tinymce
            var idCounter = tinymce.DOM.counter - 1;
            var newTag = $('#struct_' + idCounter, w.editor.getBody());
            if (newTag.text() == '') {
                newTag.text('\uFEFF'); // insert zero-width non-breaking space so empty tag takes up space
            }
            //            if (!w.utilities.isTagBlockLevel(newTag.attr('_tag'))) {
            //                w.utilities.selectElementById(newTag.attr('id'), true);
            //            }
        }

        w.event('writerKeyup').publish(evt);
    };

    function onChangeHandler(event) {
        $('br', w.editor.getBody()).remove(); // remove br tags that get added by shift+enter
        // w.event('contentChanged').publish();
    };

    function onNodeChangeHandler(e) {
        var el = e.element;
        if (el.nodeType != 1) {
            w.editor.currentNode = w.utilities.getRootTag()[0];
        } else {
            if (el.getAttribute('id') == 'mcepastebin') {
                return;
            }
            if (el.getAttribute('_tag') == null && el.classList.contains('entityHighlight') == false) {
                // TODO review is this is still necessary
                if (el.getAttribute('data-mce-bogus') != null) {
                    // artifact from utilities.selectElementById
                    var sibling;
                    var rng = w.editor.selection.getRng(true);
                    if (rng.collapsed) {
                        // the user's trying to type in a bogus tag
                        // find the closest valid tag and correct the cursor location
                        var backwardDirection = true;
                        if (w.editor.lastKeyPress == 36 || w.editor.lastKeyPress == 37 || w.editor.lastKeyPress == 38) {
                            sibling = $(el).prevAll('[_tag]')[0];
                            backwardDirection = false;
                        } else {
                            sibling = $(el).nextAll('[_tag]')[0];
                            if (sibling == null) {
                                sibling = $(el).parent().nextAll('[_tag]')[0];
                            }
                        }
                        if (sibling != null) {
                            rng.selectNodeContents(sibling);
                            rng.collapse(backwardDirection);
                            w.editor.selection.setRng(rng);
                        }
                    } else {
                        // the structure is selected
                        sibling = $(el).next('[_tag]')[0];
                    }
                    if (sibling != null) {
                        el = sibling;
                    } else {
                        el = el.parentNode;
                    }
                } else if (el == w.editor.getBody()) {
                    return;
                } else {
                    el = el.parentNode;
                }

                // use setTimeout to add to the end of the onNodeChange stack
                window.setTimeout(function() {
                    fireNodeChange(el);
                }, 0);
            } else {
                w.editor.currentNode = el;
            }
        }

        w.editor.currentBookmark = w.editor.selection.getBookmark(1);

        w.event('nodeChanged').publish(w.editor.currentNode);
    };

    function onCopyHandler(event) {
        if (w.editor.copiedElement.element != null) {
            $(w.editor.copiedElement.element).remove();
            w.editor.copiedElement.element = null;
        }

        w.event('contentCopied').publish();
    };

    function hideContextMenus(evt) {
        var target = $(evt.target);
        // hide structure tree menu
        // TODO move to structure tree
        if ($.vakata && $.vakata.context && target.parents('.vakata-context').length === 0) {
            $.vakata.context.hide();
        }

    };

    function doHighlightCheck(evt) {
        var range = w.editor.selection.getRng(true);

        // check if inside boundary tag
        var parent = range.commonAncestorContainer;
        if (parent.nodeType === Node.ELEMENT_NODE && parent.hasAttribute('_entity')) {
            w.entitiesManager.highlightEntity(); // remove highlight
            if ((w.editor.dom.hasClass(parent, 'start') && evt.which == 37) ||
                (w.editor.dom.hasClass(parent, 'end') && evt.which != 39)) {
                var prevNode = w.utilities.getPreviousTextNode(parent);
                range.setStart(prevNode, prevNode.length);
                range.setEnd(prevNode, prevNode.length);
            } else {
                var nextNode = w.utilities.getNextTextNode(parent);
                range.setStart(nextNode, 0);
                range.setEnd(nextNode, 0);
            }
            w.editor.selection.setRng(range);
            range = w.editor.selection.getRng(true);
        }

        var entity = $(range.startContainer).parents('[_entity]')[0];
        var id;
        if (entity != null) {
            id = entity.getAttribute('name');
        } else {
            w.entitiesManager.highlightEntity();
            var parentNode = $(w.editor.selection.getNode());
            if (parentNode.attr('_tag')) {
                id = parentNode.attr('id');
            }
            return;
        }

        if (id === w.entitiesManager.getCurrentEntity()) return;

        w.entitiesManager.highlightEntity(id, w.editor.selection.getBookmark());
    };
}

module.exports = TinymceWrapper;
