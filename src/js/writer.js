'use strict';

var $ = require('jquery');

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
var TagContextMenu = require('./tagContextMenu.js');
var TinymceWrapper = require('./tinymceWrapper.js');

/**
 * @class CWRCWriter
 * @param {Object} config
 * @param {String} config.container
 * @param {Object} config.storageDialogs
 * @param {Object} config.entityLookupDialogs
 * @param {Object} config.schemas
 * @param {Object} config.modules
 * @param {String} [config.cwrcRootUrl]
 * @param {String} [config.validationUrl]
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
    w.validationUrl = config.validationUrl || 'https://validator.services.cwrc.ca/validator/validate.html';// url for the xml validation
    if (w.cwrcRootUrl == null || w.cwrcRootUrl == '') {
        w.cwrcRootUrl = window.location.protocol + '//' + window.location.host + '/' + window.location.pathname.split('/')[1] + '/';
        console.info('using default cwrcRootUrl', w.cwrcRootUrl);
    }

    // add css asap
    var cssLink = $('<link type="text/css" rel="stylesheet" href="' + w.cwrcRootUrl + 'css/cwrc-writer.css" />').appendTo(document.head);
    // cssLink.on('load', function(e) {
    // });

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

    // what format to produce annotations in(XML or JSON)
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
     * @param {Boolean} [convertEntities] Whether to convert entities, defaults to true
     */
    w.loadDocumentURL = function(docUrl, convertEntities) {
        w.converter.loadDocumentURL(docUrl, convertEntities);
    };

    /**
     * Load a document into the editor
     * @fires Writer#loadingDocument
     * @param {Document|String} docXml An XML document or a string representation of such.
     * @param {Boolean} [convertEntities] Whether to convert entities, defaults to true
     */
    w.loadDocumentXML = function(docXml, convertEntities) {
        w.converter.loadDocumentXML(docXml, convertEntities);
    };

    w.showLoadDialog = function() {
        w.storageDialogs.load(w);
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
     * Get the current document from the editor
     * @param {Boolean} [asString=false] True to return a string
     * @returns {Document|String} The XML document
     */
    w.getDocument = function(asString) {
        return w.converter.getDocument(asString);
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
        name: 'CWRC-Writer 1.0',
        editorId: editorId,
        modules: config.modules,
        container: $('#' + w.containerId)
    });

    w.schemaManager = new SchemaManager(w, { schemas: config.schemas });
    w.entitiesManager = new EntitiesManager(w);
    w.dialogManager = new DialogManager(w); // needs to load before SettingsDialog
    w.tagger = new Tagger(w);
    w.converter = new Converter(w);
    w.annotationsManager = new AnnotationsManager(w);
    w.settings = new SettingsDialog(w, {
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
};

module.exports = CWRCWriter;