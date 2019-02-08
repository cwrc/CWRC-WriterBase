'use strict';

var $ = require('jquery');
var fscreen = require('fscreen')['default'];
window.tinymce = require('tinymce');

require('tinymce/themes/modern/theme.js');
require('./tinymce_plugins/cwrc_contextmenu.js');
require('./tinymce_plugins/cwrc_path.js');
require('./tinymce_plugins/schematags.js');
require('./tinymce_plugins/treepaste.js');
require('./tinymce_plugins/prevent_delete.js');

var EventManager = require('./eventManager.js');
var Utilities = require('./utilities.js');
var SchemaManager = require('./schema/schemaManager.js');
var DialogManager = require('./dialogManager.js');
var EntitiesManager = require('./entitiesManager.js');
var Tagger = require('./tagger.js');
var Converter = require('./conversion/converter.js');
var AnnotationsManager = require('./annotationsManager.js');
var SettingsDialog = require('./dialogs/settings.js');
var LayoutManager = require('./layout/layoutManager.js');

/**
 * @class CWRCWriter
 * @param {Object} config
 */
function CWRCWriter(config) {
    config = config || {};
    
    /**
     * @lends Writer.prototype
     */
    var w = {};
    
    w.initialConfig = config;
    
    w.containerId;
    if (config.container === undefined) {
        alert('Error: no container supplied for CWRCWriter!');
        return;
    } else {
        w.containerId = config.container;
    }
    
    w.editor = null; // reference to the tinyMCE instance we're creating, set in setup
    
    w.structs = {}; // structs store
    
    w.triples = []; // triples store
    // store deleted tags in case of undo
    // TODO add garbage collection for this
    w.deletedEntities = {};
    w.deletedStructs = {};
    
    w.cwrcRootUrl = config.cwrcRootUrl; // the url which points to the root of the cwrcwriter location
    w.validationUrl = config.validationUrl || 'https://validator.services.cwrc.ca/validator/validate.html';// url for the xml validation
    if (w.cwrcRootUrl == null || w.cwrcRootUrl == '') {
        w.cwrcRootUrl = window.location.protocol+'//'+window.location.host+'/'+window.location.pathname.split('/')[1]+'/';
        console.info('using default cwrcRootUrl', w.cwrcRootUrl);
    }
    
    w.currentDocId = null;
    
    // is the editor initialized
    w.isInitialized = false;

    // has a doc been loaded
    w.isDocLoaded = false;
    
    // is the editor in readonly mode
    w.isReadOnly = false;
    if (config.readonly !== undefined && typeof config.readonly === 'boolean') {
        w.isReadOnly = config.readonly;
    }
    
    // is the editor in annotate (entities) only mode
    w.isAnnotator = false;
    if (config.annotator !== undefined && typeof config.annotator === 'boolean') {
        w.isAnnotator = config.annotator;
    }
    
    // true if this writer is embedded in a parent writer, i.e. for note entities
    w.isEmbedded = false;
    if (config.embedded !== undefined && typeof config.embedded === 'boolean') {
        w.isEmbedded = config.embedded;
    }
    
    // possible editor modes
    w.XMLRDF = 0; // XML + RDF
    w.XML = 1; // XML only
    w.RDF = 2; // RDF only (not currently used)
    
    w.JSON = 3; // annotation type
    
    // editor mode
    w.mode = w.XMLRDF;
    if (config.mode !== undefined) {
        if (config.mode === 'xml') {
            w.mode = w.XML;
        } else if (config.mode === 'rdf') {
            w.mode = w.RDF;
        }
    }
    
    // what format to produce annotations in (XML or JSON)
    w.annotationMode = w.XML;
    
    // can entities overlap?
    w.allowOverlap = false;
    if (config.allowOverlap !== undefined && typeof config.allowOverlap === 'boolean') {
        w.allowOverlap = config.allowOverlap;
    }
    if (w.allowOverlap && w.mode === w.XML) {
        w.allowOverlap = false;
        if (console) console.warn('Mode set to XML and overlap allowed. Disabling overlap since XML doesn\'t allow it.');
    }
    
    // possible results when trying to add entity
    w.NO_SELECTION = 0;
    w.NO_COMMON_PARENT = 1;
    w.OVERLAP = 2;
    w.VALID = 3;
    
    /**
     * Gets a unique ID for use within CWRC-Writer.
     * @param {String} prefix The prefix to attach to the ID.
     * @returns {String} id
     */
    w.getUniqueId = function(prefix) {
        var id = tinymce.DOM.uniqueId(prefix);
        return id;
    };
    
    // needed to instantiate writer in notes
    w._getClass = function() {
        return CWRCWriter;
    };
    
    /**
     * Selects an element in the editor
     * @param id The id of the element to select
     * @param selectContentsOnly Whether to select only the contents of the element (defaults to false)
     */
    w.selectElementById = function(id, selectContentsOnly) {
        selectContentsOnly = selectContentsOnly == null ? false : selectContentsOnly;
        
        w.removeHighlights();
        
        if ($.isArray(id)) {
            // TODO add handling for multiple ids
            id = id[id.length-1];
        }
        
        var node = $('#'+id, w.editor.getBody());
        var nodeEl = node[0];
        if (nodeEl != null) {
            // show the element if it's inside a note
            node.parents('.noteWrapper').removeClass('hide');

            w.editor.currentStruct = id;
            var rng = w.editor.dom.createRng();
            if (selectContentsOnly) {
                if (tinymce.isWebKit) {
                    if (nodeEl.firstChild == null) {
                        node.append('\uFEFF');
                    }
                    rng.selectNodeContents(nodeEl);
                } else {
                    rng.selectNodeContents(nodeEl);
                }
            } else {
                $('[data-mce-bogus]', node.parent()).remove();
                rng.selectNode(nodeEl);
            }
            
            w.editor.selection.setRng(rng);
            
            // scroll node into view
            var nodeTop = 0;
            if (node.is(':hidden')) {
                node.show();
                nodeTop = node.position().top;
                node.hide();
            } else {
                nodeTop = node.position().top;
            }
            var newScrollTop = nodeTop - $(w.editor.getContentAreaContainer()).height()*0.25;
            $(w.editor.getDoc()).scrollTop(newScrollTop);
            
            // using setRng triggers nodeChange event so no need to call it manually
//            _fireNodeChange(nodeEl);
            
            // need focus to happen after timeout, otherwise it doesn't always work (in FF)
            window.setTimeout(function() {
                w.editor.focus();
                w.event('tagSelected').publish(id, selectContentsOnly);
            }, 0);
        }
    };
    
    w.removeHighlights = function() {
        w.entitiesManager.highlightEntity();
    };
    
    /**
     * Loads a document into the editor
     * @fires Writer#loadingDocument
     * @param {String} docUrl An URL pointing to an XML document
     */
    w.loadDocumentURL = function(docUrl) {
        w.currentDocId = docUrl;
        w.event('loadingDocument').publish();
        $.ajax({
            url: docUrl,
            type: 'GET',
            success: function(doc, status, xhr) {
                window.location.hash = '';
                w.converter.processDocument(doc);
            },
            error: function(xhr, status, error) {
                w.currentDocId = null;
                w.dialogManager.show('message', {
                    title: 'Error',
                    msg: 'An error occurred and '+docUrl+' was not loaded.',
                    type: 'error'
                });
                w.event('documentLoaded').publish(false, null);
            },
            dataType: 'xml'
        });
    };
    
    /**
     * Load a document into the editor
     * @fires Writer#loadingDocument
     * @param docXml The XML content of the document
     * @param schemaURI The URI for the corresponding schema
     */
    w.loadDocumentXML = function(docXml, schemaURI) {
        w.event('loadingDocument').publish();
        if (typeof docXml === 'string') {
            docXml = w.utilities.stringToXML(docXml);
        }
        w.converter.processDocument(docXml);
    };

    w.showLoadDialog = function() {
        w.storageDialogs.load(w)
    };
    
    w.showSaveDialog = function() {
        w.storageDialogs.save(w);
    };
    
    w.showSaveAsDialog = function() {
//        w.storageDialogs.saveAs(w);
    };
    
    w.saveAndExit = function() {
        
    };
    
    w.closeDocument = function() {
//        if (w.editor.isDirty()) {
//        } else {
//            w.storageDialogs.load(w)
//        }
    };

    w.validate = function(callback) {
        var docText = w.converter.getDocumentContent(false);
        var schemaUrl = w.schemaManager.schemas[w.schemaManager.schemaId].url;
        
        w.event('validationInitiated').publish();
        
        $.ajax({
            url: w.validationUrl,
            type: 'POST',
            dataType: 'xml',
            data: {
                sch: schemaUrl,
                type: 'RNG_XML',
                content: docText
            },
            success: function(data, status, xhr) {
                var valid = $('status', data).text() == 'pass';
                w.event('documentValidated').publish(valid, data, docText);
                if (callback) {
                    callback.call(w, valid);
                }
            },
            error: function() {
                if (callback) {
                    callback.call(w, null);
                } else {
                    w.dialogManager.show('message', {
                        title: 'Error',
                        msg: 'An error occurred while trying to validate the document.',
                        type: 'error'
                    });
                }
            }
        });
    };
    
    /**
     * Destroy the CWRC-Writer
     */
    w.destroy = function() {
        console.info('destroying', w.editor.id);
        
        try {
            // clear the editor first (large docs can cause the browser to freeze)
            w.utilities.getRootTag().remove();
        } catch(e) {
        }
        
        window.removeEventListener('beforeunload', handleUnload);
        
        w.editor.remove();
        w.editor.destroy();
        
        w.settings.destroy();
        w.utilities.destroy();
        w.dialogManager.destroy();
        w.layoutManager.destroy();
        w.eventManager.destroy();
    };
    
    /**
     * Get the current document from the editor
     * @param {Boolean} [asString=false] True to return a string
     * @returns {Document|String} The XML document
     */
    w.getDocument = function(asString) {
        var docString = w.converter.getDocumentContent(true);
        if (asString === true) {
            return docString;
        } else {
            var doc = null;
            try {
                var parser = new DOMParser();
                doc = parser.parseFromString(docString, 'application/xml');
            } catch(e) {
                w.dialogManager.show('message', {
                    title: 'Error',
                    msg: 'There was an error getting the document:'+e,
                    type: 'error'
                });
            }
            return doc;
        }
    };

    /**
     * Set the current document for the editor
     * @param {Document|String} document Can be one of: URL, XML document, XML string
     */
    w.setDocument = function(document) {
        if (typeof document === 'string' && document.indexOf('http') === 0) {
            w.loadDocumentURL(document);
        } else {
            w.loadDocumentXML(document);
        }
    };

    /**
     * Get the raw HTML representation of the document
     * @returns {String}
     */
    w.getDocRawContent = function() {
        return w.editor.getContent({format: 'raw'})
    };

    w.getButtonByName = function(name) {
        var buttons = w.editor.buttons,
            toolbarObj = w.editor.theme.panel.find('toolbar *');

        if (buttons[name] === undefined)
            return false;

        var settings = buttons[name], result = false, length = 0;

        tinymce.each(settings, function(v, k) {
            length++;
        });

        tinymce.each(toolbarObj, function(v, k) {
            if (v.type != 'button' || v.settings === undefined)
                return;

            var i = 0;

            tinymce.each(v.settings, function(v, k) {
                if (settings[k] == v)
                    i++;
            });

            if (i != length)
                return;

            result = v;

            return false;
        });

        return result;
    };
    
    
    w.toggleFullScreen = function() {
        if (fscreen.fullscreenEnabled) {
            if (fscreen.fullscreenElement !== null) {
                fscreen.exitFullscreen();
            } else {
                var el = w.layoutManager.getContainer()[0];
                fscreen.requestFullscreen(el);
            }
        }
    };
    
    w.isFullScreen = function() {
        if (fscreen.fullscreenEnabled && fscreen.fullscreenElement !== null) {
            return true;
        } else {
            return false;
        }
    }
    
    fscreen.addEventListener('fullscreenchange', function() {
        var fscreenButton = w.editor.theme.panel.find('button#fullscreen');
        if (fscreenButton.length == 1) {
            if (fscreen.fullscreenElement !== null) {
                fscreenButton[0].$el.find('i').css('background-image', 'url("'+w.cwrcRootUrl+'img/arrow_in.png")');
            } else {
                fscreenButton[0].$el.find('i').css('background-image', 'url("'+w.cwrcRootUrl+'img/arrow_out.png")');
            }
        }
        if (w.isReadOnly || w.isAnnotator) {
            var $fscreenLink = w.layoutManager.getHeaderButtonsParent().find('.fullscreenLink');
            if ($fscreenLink.length == 1) {
                if (fscreen.fullscreenElement !== null) {
                    $fscreenLink.removeClass('out').addClass('in');
                    $fscreenLink.text('Exit Fullscreen');
                } else {
                    $fscreenLink.removeClass('in').addClass('out');
                    $fscreenLink.text('Fullscreen');
                }
            }
        }
    });
    
    function _fireNodeChange(nodeEl) {
        // fire the onNodeChange event
        var parents = [];
        w.editor.dom.getParent(nodeEl, function(n) {
            if (n.nodeName == 'BODY')
                return true;

            parents.push(n);
        });
        w.editor.fire('NodeChange', {element: nodeEl, parents: parents});
    };
    
    function _onMouseUpHandler(evt) {
        _hideContextMenus(evt);
        _doHighlightCheck(w.editor, evt);
        w.event('selectionChanged').publish();
    };
    
    function _onKeyDownHandler(evt) {
        w.editor.lastKeyPress = evt.which; // store the last key press
        if (w.isReadOnly) {
            if ((tinymce.isMac ? evt.metaKey : evt.ctrlKey) && evt.which == 70) {
                // allow search
                return;
            }
            evt.preventDefault();
            return;
        }
        // TODO move to keyup
        // redo/undo listener
        if ((tinymce.isMac ? evt.metaKey : evt.ctrlKey) && (evt.which == 89 || evt.which == 90)) {
            var doUpdate = w.tagger.findNewAndDeletedTags();
            if (doUpdate) {
                w.event('contentChanged').publish(w.editor);
            }
        }
        
        w.event('writerKeydown').publish(evt);
    };
    
    function _onKeyUpHandler(evt) {
        // nav keys and backspace check
        if (evt.which >= 33 || evt.which <= 40 || evt.which == 8) {
            _doHighlightCheck(w.editor, evt);
        }

        // update current entity
        var entityId = w.entitiesManager.getCurrentEntity();
        if (entityId !== null) {
            var content = $('.entityHighlight', w.editor.getBody()).text();
            var entity = w.entitiesManager.getEntity(entityId);
            if (entity.isNote()) {
                entity.setNoteContent($('#'+entityId, w.editor.getBody()).html());
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
                        
                        window.setTimeout(function(){
                            _fireNodeChange(newCurrentNode);
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
                        msg: 'Text is not allowed in the current tag: '+w.editor.currentNode.getAttribute('_tag')+'.',
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
                $(node).find('br').replaceWith('<'+tagName+' _tag="lb"></'+tagName+'>');
            }
        }
        
        // delete keys check
        // need to do this here instead of in onchangehandler because that one doesn't update often enough
        if (evt.which == 8 || evt.which == 46) {
            var doUpdate = w.tagger.findNewAndDeletedTags();
            if (doUpdate) {
                w.event('contentChanged').publish(w.editor);
            }
        }
        
        // enter key
        if (evt.which == 13) {
            // find the element inserted by tinymce
            var idCounter = tinymce.DOM.counter-1;
            var newTag = $('#struct_'+idCounter, w.editor.getBody());
            if (newTag.text() == '') {
                newTag.text('\uFEFF'); // insert zero-width non-breaking space so empty tag takes up space
            }
//            if (!w.utilities.isTagBlockLevel(newTag.attr('_tag'))) {
//                w.selectElementById(newTag.attr('id'), true);
//            }
        }
        
        w.event('writerKeyup').publish(evt);
    };
    
    function _onChangeHandler(event) {
        if (w.editor.isDirty()) {
            $('br', w.editor.getBody()).remove();
            
            var doUpdate = w.tagger.findNewAndDeletedTags();
            if (doUpdate) {
                w.event('contentChanged').publish(w.editor);
            }
        }
    };
    
    function _onNodeChangeHandler(e) {
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
                    // artifact from selectElementById
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
                window.setTimeout(function(){
                    _fireNodeChange(el);
                }, 0);
            } else {
                w.editor.currentNode = el;
            }
        }
        
        w.editor.currentBookmark = w.editor.selection.getBookmark(1);
        
        w.event('nodeChanged').publish(w.editor.currentNode);
    };
    
    function _onCopyHandler(event) {
        if (w.editor.copiedElement.element != null) {
            $(w.editor.copiedElement.element).remove();
            w.editor.copiedElement.element = null;
        }
        
        w.event('contentCopied').publish();
    };
    
    function _hideContextMenus(evt) {
        var target = $(evt.target);
        // hide structure tree menu
        // TODO move to structure tree
        if ($.vakata && $.vakata.context && target.parents('.vakata-context').length === 0) {
            $.vakata.context.hide();
        }
        
    };
    
    function _doHighlightCheck(evt) {
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
                w.editor.currentStruct = id;
            }
            return;
        }
        
        if (id === w.entitiesManager.getCurrentEntity()) return;
        
        w.entitiesManager.highlightEntity(id, w.editor.selection.getBookmark());
    };
    
    // INIT
    if (config.storageDialogs != null) {
        w.storageDialogs = config.storageDialogs
    } else {
        alert('Error: you must specify a storage dialogs class in the CWRCWriter config to allow loading and saving documents.');
    }
    if (config.entityLookupDialogs != null) {
        w.entityLookupDialogs = config.entityLookupDialogs;
    } else {
        alert('Error: you must specify entity lookups in the CWRCWriter config for full functionality!');
    }
    
    w.eventManager = new EventManager(w);

    w.event('documentLoaded').subscribe(function(success) {
        w.editor.undoManager.clear();
        w.editor.isNotDirty = true;
        if (success) {
            w.isDocLoaded = true;
        } else {
            w.isDocLoaded = false;
        }
    });
    w.event('documentSaved').subscribe(function() {
        w.editor.isNotDirty = true;
    });

    w.utilities = new Utilities(w);
    w.utilities.addCSS('css/style.css');
    w.utilities.addCSS('css/editor.css'); // needed to style note popups
    
    var editorId = w.getUniqueId('editor_');
    w.layoutManager = new LayoutManager(w, {
        name: 'CWRC-Writer 1.0',
        editorId: editorId,
        modules: config.modules,
        container: $('#'+w.containerId)
    });
    
    w.schemaManager = new SchemaManager(w, {schemas: config.schemas});
    w.entitiesManager = new EntitiesManager(w);
    w.dialogManager = new DialogManager(w); // needs to load before SettingsDialog
    w.tagger = new Tagger(w);
    w.converter = new Converter(w);
    w.annotationsManager = new AnnotationsManager(w);
    w.settings = new SettingsDialog(w, {
        showEntities: true,
        showTags: false
    });
    
    $(document.body).mousedown(function(e) {
        _hideContextMenus(e);
    });
    
    var handleUnload = function(e) {
        if ((w.isReadOnly === false || w.isAnnotator === true) && window.location.hostname != 'localhost') {
            if (tinymce.get(editorId).isDirty()) {
                var msg = 'You have unsaved changes.';
                (e || window.event).returnValue = msg;
                return msg;
            }
        }
    };
    
    window.addEventListener('beforeunload', handleUnload);

    $(window).on('unload', function(e) {
        try {
            // clear the editor first (large docs can cause the browser to freeze)
            w.utilities.getRootTag().remove();
        } catch(e) {
            
        }
    });

    var addButtonToEditor = function(buttonId, settings) {
        // adjust the location of the tooltip
        settings.onmouseenter = function(e) {
            var tt = this.tooltip();
            var button = $(this.$el[0]);
            var position = w.utilities.getOffsetPosition(button);
            
            position.left += $(tt.$el[0]).outerWidth()*-0.5 + button.outerWidth()*0.5;
            position.top += button.outerHeight();
            
            tt.moveTo(position.left, position.top);
        };
        w.editor.addButton(buttonId, settings);
    };
    
    var layoutContainerId = w.layoutManager.getContainer().attr('id');
    tinymce.Env.container = w.layoutManager.getContainer()[0]; // need to explicitly set container for embedded cwrc writers
    
    /**
     * Init tinymce
     */
    tinymce.baseURL = w.cwrcRootUrl+'/js'; // need for skin
    tinymce.init({
        selector: '#'+editorId,
        
        ui_container: '#'+layoutContainerId,
        
        skin_url: w.cwrcRootUrl+'css/tinymce',
        
        content_css: w.cwrcRootUrl+'css/editor.css',
        
        contextmenu_never_use_native: true,
        
        doctype: '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
        element_format: 'xhtml',
        
        forced_root_block: w.utilities.getBlockTag(),
        keep_styles: false, // false, otherwise tinymce interprets our spans as style elements
        
        paste_postprocess: function(plugin, ev) {
            function stripTags(index, node) {
                if (node.hasAttribute('_tag') || node.hasAttribute('_entity') ||
                    node.nodeName.toLowerCase() == 'p' && node.nodeName.toLowerCase() == 'br') {
                    $(node).children().each(stripTags);
                } else {
                    if ($(node).contents().length == 0) {
                        $(node).remove();
                    } else {
                        var contents = $(node).contents().unwrap();
                        contents.not(':text').each(stripTags);
                    }
                }
            }
            
            function replaceTags(index, node) {
                if (node.nodeName.toLowerCase() == 'p') {
                    var tagName = w.utilities.getTagForEditor('p');
                    $(node).contents().unwrap().wrapAll('<'+tagName+' _tag="p"></'+tagName+'>').not(':text').each(replaceTags);
                } else if (node.nodeName.toLowerCase() == 'br') {
                    var tagName = w.utilities.getTagForEditor('br');
                    $(node).replaceWith('<'+tagName+' _tag="lb"></'+tagName+'>');
                }
            }
            
            $(ev.node).children().each(stripTags);
            $(ev.node).children().each(replaceTags);
            
            window.setTimeout(function() {
                // need to fire contentPasted here, after the content is actually within the document
                w.event('contentPasted').publish();
            }, 0);
        },
        
        valid_elements: '*[*]', // allow everything
        
        plugins: 'schematags,cwrc_contextmenu,cwrcpath,preventdelete', //paste
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
            ed.currentStruct = null; // the id of the currently selected structural tag
            ed.currentBookmark = null; // for storing a bookmark used when adding a tag
            ed.currentNode = null; // the node that the cursor is currently in
            ed.contextMenuPos = null; // the position of the context menu (used to position related dialog box)
            ed.copiedElement = {selectionType: null, element: null}; // the element that was copied (when first selected through the structure tree)
            ed.copiedEntity = null; // the entity element that was copied
            ed.lastKeyPress = null; // the last key the user pressed
            
            if (w.isReadOnly === true) {
                ed.on('PreInit', function(e) {
                    ed.getBody().removeAttribute('contenteditable');
                });
            }
            
            ed.on('init', function(args) {
                if (w.isReadOnly === true) {
                    ed.plugins.cwrc_contextmenu.disabled = true;
                    w.layoutManager.hideToolbar();
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
                body.on('keydown',_onKeyDownHandler).on('keyup',_onKeyUpHandler);
                // attach mouseUp to doc because body doesn't always extend to full height of editor panel
                $(ed.iframeElement.contentDocument).on('mouseup', _onMouseUpHandler);
                
                w.isInitialized = true;
                w.event('writerInitialized').publish(w);
            });
            ed.on('Change',_onChangeHandler);
            ed.on('Undo Redo',_onChangeHandler);
            ed.on('NodeChange',_onNodeChangeHandler);
            ed.on('copy', _onCopyHandler);
            
            addButtonToEditor('addperson', {title: 'Tag Person', image: w.cwrcRootUrl+'img/user.png', entityButton: true,
                onclick : function() {
                    w.tagger.addEntity('person');
                }
            });
            addButtonToEditor('addplace', {title: 'Tag Place', image: w.cwrcRootUrl+'img/world.png', entityButton: true,
                onclick : function() {
                    w.tagger.addEntity('place');
                }
            });
            addButtonToEditor('adddate', {title: 'Tag Date', image: w.cwrcRootUrl+'img/calendar.png', entityButton: true,
                onclick : function() {
                    w.tagger.addEntity('date');
                }
            });
            addButtonToEditor('addevent', {title: 'Tag Event', image: w.cwrcRootUrl+'img/cake.png', entityButton: true,
                onclick : function() {
                    w.tagger.addEntity('event');
                }
            });
            addButtonToEditor('addorg', {title: 'Tag Organization', image: w.cwrcRootUrl+'img/group.png', entityButton: true,
                onclick : function() {
                    w.tagger.addEntity('org');
                }
            });
            addButtonToEditor('addcitation', {title: 'Tag Citation', image: w.cwrcRootUrl+'img/vcard.png', entityButton: true,
                onclick : function() {
                    w.tagger.addEntity('citation');
                }
            });
            addButtonToEditor('addnote', {title: 'Tag Note', image: w.cwrcRootUrl+'img/note.png', entityButton: true,
                onclick : function() {
                    w.tagger.addEntity('note');
                }
            });
            addButtonToEditor('addcorrection', {title: 'Tag Correction', image: w.cwrcRootUrl+'img/error.png', entityButton: true,
                onclick : function() {
                    w.tagger.addEntity('correction');
                }
            });
            addButtonToEditor('addkeyword', {title: 'Tag Keyword', image: w.cwrcRootUrl+'img/key.png', entityButton: true,
                onclick : function() {
                    w.tagger.addEntity('keyword');
                }
            });
            addButtonToEditor('addlink', {title: 'Tag Link', image: w.cwrcRootUrl+'img/link.png', entityButton: true,
                onclick : function() {
                    w.tagger.addEntity('link');
                }
            });
            addButtonToEditor('addtitle', {title: 'Tag Text/Title', image: w.cwrcRootUrl+'img/book.png', entityButton: true,
                onclick : function() {
                    w.tagger.addEntity('title');
                }
            });
            addButtonToEditor('editTag', {title: 'Edit Tag', image: w.cwrcRootUrl+'img/tag_blue_edit.png',
                onclick : function() {
                    w.tagger.editTag();
                }
            });
            addButtonToEditor('removeTag', {title: 'Remove Tag', image: w.cwrcRootUrl+'img/tag_blue_delete.png',
                onclick : function() {
                    if (w.entitiesManager.getCurrentEntity() != null) {
                        w.tagger.removeEntity(w.entitiesManager.getCurrentEntity(), false);
                    } else if (w.editor.currentStruct != null) {
                        w.tagger.removeStructureTag(w.editor.currentStruct, false);
                    }
                }
            });
            addButtonToEditor('newbutton', {title: 'New', image: w.cwrcRootUrl+'img/page_white_text.png',
                onclick: function() {
                  w.showSaveDialog();
                }
            });
            addButtonToEditor('savebutton', {title: 'Save', image: w.cwrcRootUrl+'img/save.png',
                onclick: function() {
                   w.showSaveDialog();
                }
            });
            addButtonToEditor('saveasbutton', {title: 'Save As', image: w.cwrcRootUrl+'img/save_as.png',
                onclick: function() {
                    w.showSaveAsDialog();
                }
            });
            addButtonToEditor('saveexitbutton', {title: 'Save & Exit', image: w.cwrcRootUrl+'img/save_exit.png',
                onclick: function() {
                    w.saveAndExit();
                }
            });
            addButtonToEditor('loadbutton', {title: 'Load', image: w.cwrcRootUrl+'img/folder_page.png',
                onclick: function() {
                    w.showLoadDialog();
                }
            });
            
            addButtonToEditor('viewmarkup', {title: 'View Markup', image: w.cwrcRootUrl+'img/page_white_code.png',
                onclick: function() {
                    w.selection.showSelection();
                }
            });
            addButtonToEditor('toggletags', {title: 'Toggle Tags', image: w.cwrcRootUrl+'img/tag.png',
                onclick: function() {
                    $('body', w.editor.getDoc()).toggleClass('showTags');
                    this.active($('body', w.editor.getDoc()).hasClass('showTags'));
                }
            });
            
            addButtonToEditor('editsource', {title: 'Edit Source', image: w.cwrcRootUrl+'img/page_white_edit.png',
                onclick: function() {
                    w.dialogManager.show('editSource');
                }
            });
            addButtonToEditor('validate', {title: 'Validate', image: w.cwrcRootUrl+'img/validate.png',
                onclick: function() {
                    w.validate();
                }
            });
            addButtonToEditor('addtriple', {title: 'Add Relation', image: w.cwrcRootUrl+'img/chart_org.png',
                onclick: function() {
                    $('#westTabs').tabs('option', 'active', 2);
                    w.dialogManager.show('triple');
                }
            });
            addButtonToEditor('fullscreen', {name: 'fullscreen', title: 'Toggle Fullscreen', image: w.cwrcRootUrl+'img/arrow_out.png',
                onclick: function() {
                    w.toggleFullScreen();
                }
            });

        }
    });
    
    return w;
};

module.exports = CWRCWriter;