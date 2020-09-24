const $ = require('jquery');
window.tinymce = require('tinymce/tinymce');
require('tinymce/icons/default');
require('tinymce/themes/silver');

require('tinymce/plugins/paste');

//TODO: Reassess plugins on tinymce 5.0
require('./tinymce_plugins/cwrc_path.js');
require('./tinymce_plugins/schematags.js');
require('./tinymce_plugins/treepaste.js');
require('./tinymce_plugins/prevent_delete.js');

const { addIconPack } = require('./tinymce/tinymceIconPack.js')
const { toolbarOptions, configureToolbar } = require('./tinymce/tinymceToolbar.js');

//TODO: Find a better way to load TinyMCE SKIN
// replace files on ./css/tinymce
require.context(
    'file-loader?name=[path][name].[ext]&context=node_modules/tinymce!tinymce/skins',
    true,
    /.*/
);

const TinymceWrapper = () => {}

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
TinymceWrapper.init = (config) => {
    const w = config.writer;
    const editorId = config.editorId;
    const layoutContainerId = config.layoutContainerId;

    /**
     * Init tinymce
     */
    tinymce.baseURL = `${w.cwrcRootUrl}/js`; // need for skin
    tinymce.init({
        selector: `#${editorId}`,
        ui_container: `#${layoutContainerId}`,

        skin_url: `${w.cwrcRootUrl}css/tinymce`,
        height: '100%',
        width: '100%',
        content_css: `${w.cwrcRootUrl}css/editor.css`,

        doctype: '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
        element_format: 'xhtml',

        forced_root_block: w.schemaManager.getBlockTag(),
        keep_styles: false, // false, otherwise tinymce interprets our spans as style elements

        paste_postprocess: (plugin, ev) => {

            // const stripTags(index, $node) => {
            //     // remove non-editor tags
            //     if ($node.attr('_tag')) {
            //         $node.children().each(stripTags);
            //     } else {
            //         if ($node.contents().length == 0) {
            //             $node.remove();
            //         } else {
            //             const contents = $node.contents().unwrap();
            //             console.log('stripTags: removing',)
            //             contents.not(':text').each(stripTags);
            //         }
            //     }
            // }

            // stripTags(0, $(ev.node));

            w.tagger.processNewContent(ev.node);

            window.setTimeout(() => {
                // need to fire contentPasted here, after the content is actually within the document
                w.event('contentPasted').publish();
            }, 0);
        },

        valid_elements: '*[*]', // allow everything

        //TODO: Reassess plugins on tinymce 5.0
        plugins: [
            'schematags',   //!We might use the native menu options. If not, rework the plugin
            // 'cwrcpath',  //!This was broken before the upgrade
            'preventdelete', //TODO: need to be tested
            'paste'         //TODO: need to be tested
        ],

        toolbar1: config.buttons1 === undefined ? toolbarOptions.join(' ') : config.buttons1.join(' '),
        // toolbar2: config.buttons2 === undefined ? 'cwrcpath' : config.buttons2,
        // toolbar3: config.buttons3 === undefined ? '' : config.buttons3,
        
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

        setup: (ed) => {
            // link the writer and editor
            w.editor = ed;
            ed.writer = w;

            // custom properties added to the editor
            ed.currentBookmark = null; // for storing a bookmark used when adding a tag
            ed.currentNode = null; // the node that the cursor is currently in
            ed.copiedElement = { selectionType: null, element: null }; // the element that was copied (when first selected through the structure tree)
            ed.copiedEntity = null; // the entity element that was copied
            ed.lastKeyPress = null; // the last key the user pressed

            ed.on('init', (args) => {
                if (w.isReadOnly === true) {
                    w.layoutManager.hideToolbar();
                    ed.setMode('readonly');
                }

                // modify isBlock method to check _tag attributes
                ed.dom.isBlock = (node) => {
                    if (!node) return false;

                    const type = node.nodeType;

                    // If it's a node then check the type and use the nodeName
                    // if (type) {
                    if (type === 1) {
                        const tag = node.getAttribute('_tag') || node.nodeName;
                        return !!(ed.schema.getBlockElements()[tag]);
                    }
                    // }

                    return !!ed.schema.getBlockElements()[node];
                };

                const settings = w.settings.getSettings();
                const body = $(ed.getBody());
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
            ed.on('BeforeAddUndo', (e) => {
                // console.log('before add undo')
            });
            ed.on('NodeChange', onNodeChangeHandler);
            ed.on('copy', onCopyHandler);

            ed.on('contextmenu', (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
        
                if (w.isReadOnly) return;

                const editorPosition = w.utilities.getOffsetPosition(ed.getContentAreaContainer(), window.document.documentElement);

                const $editorBody = $(ed.getDoc().documentElement);
                const editorScrollTop = $editorBody.scrollTop();
                const editorScrollLeft = $editorBody.scrollLeft();

                const adjustLeft = editorPosition.left - editorScrollLeft;
                const adjustTop = editorPosition.top - editorScrollTop;
        
                e.pageX += adjustLeft;
                e.pageY += adjustTop;

                w.tagMenu.show(e, undefined, true);
            });

            addIconPack(ed);
            configureToolbar(w, ed);
        }
    });

    // writer listeners

    w.event('contentChanged').subscribe(() => console.log('contentChanged'));
    w.event('documentLoaded').subscribe(() => {
        w.editor.undoManager.clear();
        w.editor.isNotDirty = true;
        // need to explicitly set focus
        // otherwise w.editor.selection.getBookmark doesn't work until the user clicks inside the editor
        w.editor.getBody().focus();
    });
    w.event('documentSaved').subscribe(() => w.editor.isNotDirty = true);
    w.event('entityAdded').subscribe(() => w.editor.isNotDirty = false);
    w.event('entityRemoved').subscribe(() => w.editor.isNotDirty = false);
    w.event('entityEdited').subscribe(() => w.editor.isNotDirty = false);

    // tinymce handlers
    const fireNodeChange = (nodeEl) => {
        // fire the onNodeChange event
        const parents = [];
        w.editor.dom.getParent(nodeEl, (n) => {
            if (n.nodeName == 'BODY') return true;
            parents.push(n);
        });
        w.editor.fire('NodeChange', { element: nodeEl, parents: parents });
    }

    const onMouseUpHandler = (event) => {
        doHighlightCheck(w.editor, event);
        w.event('selectionChanged').publish();
    }

    const onUndoHandler = (event) => {
        console.log('undoHandler', event);
        w.event('contentChanged').publish();
    }

    const onRedoHandler = (event) => {
        console.log('redoHandler', event);
        w.event('contentChanged').publish();
    }

    const onKeyDownHandler = (event) => {
        w.editor.lastKeyPress = event.which; // store the last key press
        if (w.isReadOnly) {
            if ((tinymce.isMac ? event.metaKey : event.ctrlKey) && event.which == 70) {
                // allow search
                return;
            }
            event.preventDefault();
            return;
        }

        w.event('writerKeydown').publish(event);
    }

    const onKeyUpHandler = (evt) => {
        // nav keys and backspace check
        if (evt.which >= 33 || evt.which <= 40 || evt.which == 8) {
            doHighlightCheck(w.editor, evt);
        }

        // update current entity
        const entityId = w.entitiesManager.getCurrentEntity();
        if (entityId !== null) {
            const content = $('.entityHighlight', w.editor.getBody()).text();
            const entity = w.entitiesManager.getEntity(entityId);
            if (entity.isNote()) {
                entity.setNoteContent($(`#${entityId}`, w.editor.getBody()).html());
            }
            entity.setContent(content);
            w.event('entityEdited').publish(entityId);
        }

        if (w.editor.currentNode) {
            // check if the node still exists in the document
            if (w.editor.currentNode.parentNode === null) {
                let rng = w.editor.selection.getRng(true);
                const parent = rng.commonAncestorContainer.parentNode;
                // trying to type inside a bogus node?
                // (this can happen on webkit when typing "over" a selected structure tag)
                if (parent.getAttribute('data-mce-bogus') != null) {
                    const $parent = $(parent);
                    let collapseToStart = true;

                    let newCurrentNode = $parent.nextAll('[_tag]')[0];
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

                        window.setTimeout(() => {
                            fireNodeChange(newCurrentNode);
                        }, 0);
                    }
                }
            }

            // check if text is allowed in this node
            if (w.editor.currentNode.getAttribute('_textallowed') === 'false') {
                if (tinymce.isMac ? evt.metaKey : evt.ctrlKey) {
                    // don't show message if we got here through undo/redo
                    const node = $('[_textallowed="true"]', w.editor.getBody()).first();
                    let rng = w.editor.selection.getRng(true);
                    rng.selectNodeContents(node[0]);
                    rng.collapse(true);
                    w.editor.selection.setRng(rng);
                } else {
                    if (w.editor.currentNode.getAttribute('_entity') !== 'true') { // exception for entities since the entity parent tag can actually encapsulate several tags
                        w.dialogManager.show('message', {
                            title: 'No Text Allowed',
                            msg: 'Text is not allowed in the current tag: ' + w.editor.currentNode.getAttribute('_tag') + '.',
                            type: 'error'
                        });
                    }

                    //? commented out, seems a bit drastic
                    // remove all text
                    // $(w.editor.currentNode).contents().filter(() => {
                    //     return this.nodeType == 3;
                    // }).remove();
                }
            }
        }

        // enter key
        if (evt.which == 13) {
            const node = w.editor.currentNode; // the new element inserted by tinymce
            if (node == null) {
                console.warn('tinymceWrapper: user pressed enter but no new node found');
            } else {
                if (evt.shiftKey) {
                    // TODO replace linebreaks inserted on shift+enter with schema specific linebreak tag
                    // for now just undo the linebreak in the text
                    node.normalize();
                } else {
                    // empty tag check
                    const $node = $(node);
                    if ($node.text() == '') {
                        $node.text('\uFEFF'); // insert zero-width non-breaking space so empty tag takes up space
                    }
                    w.tagger.processNewContent(node);

                    w.editor.undoManager.add();
                    w.event('contentChanged').publish();
                }
            }
        }

        w.event('writerKeyup').publish(evt);
    }

    const onChangeHandler = (event) => {
        $('br', w.editor.getBody()).remove(); // remove br tags that get added by shift+enter
        // w.event('contentChanged').publish();
    }

    const onNodeChangeHandler = (e) => {
        let el = e.element;
        if (el.nodeType != 1) {
            w.editor.currentNode = w.utilities.getRootTag()[0];
        } else {
            if (el.getAttribute('id') === 'mcepastebin') return;
            if (el.getAttribute('_tag') == null && el.classList.contains('entityHighlight') == false) {

                // TODO review is this is still necessary
                if (el.getAttribute('data-mce-bogus') != null) {
                    // artifact from utilities.selectElementById
                    let sibling;
                    let rng = w.editor.selection.getRng(true);
                    if (rng.collapsed) {
                        // the user's trying to type in a bogus tag
                        // find the closest valid tag and correct the cursor location
                        let backwardDirection = true;
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
                window.setTimeout(() => {
                    fireNodeChange(el);
                }, 0);
            } else {
                w.editor.currentNode = el;
            }
        }

        w.editor.currentBookmark = w.editor.selection.getBookmark(1);

        w.event('nodeChanged').publish(w.editor.currentNode);
    }

    const onCopyHandler = (event) => {
        if (w.editor.copiedElement.element != null) {
            $(w.editor.copiedElement.element).remove();
            w.editor.copiedElement.element = null;
        }

        w.event('contentCopied').publish();
    }

    const doHighlightCheck = (evt) => {
        let range = w.editor.selection.getRng(true);

        // check if inside boundary tag
        const parent = range.commonAncestorContainer;
        if (parent.nodeType === Node.ELEMENT_NODE && parent.hasAttribute('_entity')) {
            w.entitiesManager.highlightEntity(); // remove highlight
            if ((w.editor.dom.hasClass(parent, 'start') && evt.which == 37) ||
                (w.editor.dom.hasClass(parent, 'end') && evt.which != 39)) {
                const prevNode = w.utilities.getPreviousTextNode(parent);
                range.setStart(prevNode, prevNode.length);
                range.setEnd(prevNode, prevNode.length);
            } else {
                const nextNode = w.utilities.getNextTextNode(parent);
                range.setStart(nextNode, 0);
                range.setEnd(nextNode, 0);
            }
            w.editor.selection.setRng(range);
            range = w.editor.selection.getRng(true);
        }

        const entity = $(range.startContainer).parents('[_entity]')[0];
        let id;
        if (entity != null) {
            id = entity.getAttribute('name');
        } else {
            w.entitiesManager.highlightEntity();
            const parentNode = $(w.editor.selection.getNode());
            if (parentNode.attr('_tag')) id = parentNode.attr('id');
            return;
        }

        if (id === w.entitiesManager.getCurrentEntity()) return;

        w.entitiesManager.highlightEntity(id, w.editor.selection.getBookmark());
    }
};

module.exports = TinymceWrapper;
