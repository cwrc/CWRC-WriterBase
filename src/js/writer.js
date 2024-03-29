'use strict';

import '../lib/jquery/jquery_3.5_workaround.js';

var $ = require('jquery');

var EventManager = require('./eventManager.js');
var Utilities = require('./utilities.js');
var SchemaManager = require('./schema/schemaManager.js');
import DialogManager from './dialogManager.js';
var EntitiesManager = require('./entities/entitiesManager.js');
var Tagger = require('./tagger.js');
var Converter = require('./conversion/converter.js');
var AnnotationsManager = require('./entities/annotationsManager');
import { settingsDialog } from './dialogs/settings';
import LayoutManager from './layout/layoutManager.js';
import TagContextMenu from './tagContextMenu.js';
var TinymceWrapper = require('./tinymceWrapper.js');

import '../css/build.less';


/**
 * @class CWRCWriter
 * @param {Object} config
 * @param {String} config.container
 * @param {Object} config.storageDialogs
 * @param {Object} config.entityLookupDialogs
 * @param {Object} config.schemas
 * @param {Object} config.modules
 * @param {String} [config.cwrcRootUrl]
 * @param {Boolean} [config.readonly]
 * @param {Boolean} [config.annotator]
 * @param {String} [config.mode]
 * @param {Boolean} [config.allowOverlap]
 * @param {String} [config.buttons1]
 * @param {String} [config.buttons2]
 * @param {String} [config.buttons3]
 
 */
function CWRCWriter(config) {
    config = config || {};

    /**
     * @lends CWRCWriter.prototype
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

    w.triples = []; // triples store

    w.cwrcRootUrl = config.cwrcRootUrl; // the url which points to the root of the cwrcwriter location
    if (w.cwrcRootUrl == null || w.cwrcRootUrl == '') {
        w.cwrcRootUrl = window.location.protocol + '//' + window.location.host + '/' + window.location.pathname.split('/')[1] + '/';
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
    w.annotationMode = w.JSON;

    // can entities overlap?
    w.allowOverlap = false;
    if (config.allowOverlap !== undefined && typeof config.allowOverlap === 'boolean') {
        w.allowOverlap = config.allowOverlap;
    }
    if (w.allowOverlap && w.mode === w.XML) {
        w.allowOverlap = false;
        if (console) console.warn('Mode set to XML and overlap allowed. Disabling overlap since XML doesn\'t allow it.');
    }

    /**
     * Gets a unique ID for use within CWRC-Writer.
     * @param {String} prefix The prefix to attach to the ID.
     * @returns {String} id
     */
    w.getUniqueId = function(prefix) {
        var id = tinymce.DOM.uniqueId(prefix);
        return id;
    };

    /**
     * Loads a document into the editor
     * @fires Writer#loadingDocument
     * @param {String} docUrl An URL pointing to an XML document
     */
    w.loadDocumentURL = function(docUrl) {
        w.converter.loadDocumentURL(docUrl);
    };

    /**
     * Load a document into the editor
     * @fires Writer#loadingDocument
     * @param {Document|String} docXml An XML document or a string representation of such.
     */
    w.loadDocumentXML = function(docXml) {
        w.converter.loadDocumentXML(docXml);
    };

    w.showLoadDialog = function() {
        w.storageDialogs.load(w);
    };

    w.showSaveDialog = function() {
        w.storageDialogs.save(w);
    };

    // TODO temp github implementation
    w.getDocumentURI = function() {
        if (w.storageDialogs.getDocumentURI) {
            return w.storageDialogs.getDocumentURI();
        } else {
            if (w.filePathInGithub) {
                var uri = 'https://github.com/'+w.repoName+'/blob/master'+w.filePathInGithub;
                return uri;
            } else {
                var uri = 'https://github.com/placeholder/blob/master/placeholder.xml';
                return uri;
            }
        }
    };

    w.getUserInfo = function() {
        if (w.storageDialogs.getUserInfo) {
            var userInfo = w.storageDialogs.getUserInfo();
            return {
                id: userInfo.userUrl,
                name: userInfo.userName,
                nick: userInfo.userId
            }
        } else {
            return {
                id: 'http://id.cwrc.ca/user/placeholder',
                name: 'Placeholder',
                nick: 'plchldr'
            }
        }
    };

    w.showSaveAsDialog = function() {
    };

    w.saveAndExit = function() {
    };

    w.exit = function() {
        if (w.storageDialogs.logOut) {
            w.storageDialogs.logOut(w);
        } else {
            console.warn('writer: no exit/logout method found!');
        }
    };

    w.validate = function(callback) {
        if (callback !== undefined) {
            var doCallback = function(isValid) {
                callback.call(w, isValid);
                w.event('documentValidated').unsubscribe(doCallback);    
            }
            w.event('documentValidated').subscribe(doCallback);
        }
        
        w.event('validationRequested').publish();
    }

    /**
     * Get the document contents as XML
     * @param {Function} callback Callback is called with an XML representation of the document
     */
    w.getDocumentXML = function(callback) {
        w.converter.getDocument(false, callback);
    };

    /**
     * Get the document contents as a string
     * @param {Function} callback Callback is called with a string representation of the document
     */
    w.getDocumentString = function(callback) {
        w.converter.getDocument(true, callback);
    };

    /**
     * Set the current document for the editor
     * @param {Document|String} document Can be one of: URL, XML document, XML string
     */
    w.setDocument = function(document) {
        w.converter.setDocument(document);
    };

    /**
     * Get the raw HTML representation of the document
     * @returns {String}
     */
    w.getDocRawContent = function() {
        return w.editor.getContent({ format: 'raw' })
    };

    /**
     * Is the editor read only?
     * @returns {Boolean}
     */
    w.isEditorReadOnly = function() {
        return w.editor.getBody().getAttribute('contenteditable') === 'false';
    }

    /**
     * Destroy the CWRC-Writer
     */
    w.destroy = function() {
        console.info('destroying', w.editor.id);

        try {
            // clear the editor first (large docs can cause the browser to freeze)
            $(w.editor.getBody()).empty();
        } catch (e) {
        }

        window.removeEventListener('beforeunload', handleUnload);

        w.editor.remove();
        w.editor.destroy();

        w.settings.destroy();
        w.utilities.destroy();
        w.dialogManager.destroy();
        w.layoutManager.destroy();
        w.eventManager.destroy();
        w.tagMenu.destroy();
    };

    // Unload functions

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
        } catch (e) {

        }
    });


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

    w.event('processingDocument').subscribe(function() {
        w.triples = [];
    });

    w.event('documentLoaded').subscribe(function(success) {
        if (success) {
            w.isDocLoaded = true;
        } else {
            w.isDocLoaded = false;
        }
    });

    w.event('tinymceInitialized').subscribe(function() {
        // fade out loading mask and do final resizing after tinymce has loaded
        w.layoutManager.$outerLayout.options.onresizeall_end = function() {
            w.layoutManager.$outerLayout.options.onresizeall_end = null;
            w.layoutManager.$loadingMask.fadeOut(350);
        };

        setTimeout(function() {
            w.layoutManager.resizeAll();
            setTimeout(function() {
                w.isInitialized = true;
                w.event('writerInitialized').publish(w);
            }, 350);
        }, 1000);
    });

    w.utilities = new Utilities(w);

    var editorId = w.getUniqueId('editor_');
    w.layoutManager = new LayoutManager(w);
    w.layoutManager.init({
        editorId: editorId,
        modules: config.modules,
        container: $('#' + w.containerId)
    });

    w.schemaManager = new SchemaManager(w, config.schema);
    w.entitiesManager = new EntitiesManager(w);
    w.dialogManager = new DialogManager(w); // needs to load before SettingsDialog
    w.tagger = new Tagger(w);
    w.converter = new Converter(w);
    w.annotationsManager = new AnnotationsManager(w);
    w.settings = settingsDialog(w, {
        helpUrl: config.helpUrl,
        showEntities: true,
        showTags: false
    });

    w.tagMenu = new TagContextMenu(w);

    var layoutContainerId = w.layoutManager.getContainer().attr('id');

    TinymceWrapper.init({
        writer: w,
        editorId: editorId,
        layoutContainerId: layoutContainerId,
        buttons1: config.buttons1,
        buttons2: config.buttons2,
        buttons3: config.buttons3
    });

    return w;
}

export default CWRCWriter;
