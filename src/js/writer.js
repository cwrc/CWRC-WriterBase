import $ from 'jquery';
import '../lib/jquery/jquery_3.5_workaround.js';

const EventManager = require('./eventManager.js');
import Utilities from './utilities';
import SchemaManager from './schema/schemaManager';
import DialogManager from './dialogManager';
const EntitiesManager = require('./entities/entitiesManager.js');
const Tagger = require('./tagger.js');
const Converter = require('./conversion/converter.js');
const AnnotationsManager = require('./entities/annotationsManager');
import LayoutManager from './layout/layoutManager.js';
import TinymceWrapper from './tinymceWrapper';
import { spawn, Worker } from 'threads'; //https://threads.js.org/


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
function Writer(config) {
    config = config || {};

    /**
     * @lends CWRCWriter.prototype
     */
    const w = {};

    w.initialConfig = config;
    //html container
    if (config.container === undefined) {
        alert('Error: no container supplied for CWRCWriter!');
        return;
    }
    
    w.containerId = config.container;
    w.editor = null;                    // reference to the tinyMCE instance we're creating, set in setup
    w.triples = [];                     // triples store

    w.cwrcRootUrl = config.cwrcRootUrl; // the url which points to the root of the cwrcwriter location
    if (w.cwrcRootUrl === null || w.cwrcRootUrl === '') {
        w.cwrcRootUrl = `${window.location.protocol}//${window.location.host}/${window.location.pathname.split('/')[1]}/`;
        if (w.cwrcRootUrl.endsWith('//')) w.cwrcRootUrl = w.cwrcRootUrl.slice(0, -1);
        console.info('using default cwrcRootUrl', w.cwrcRootUrl);
    }

    w.currentDocId = null;
    w.isInitialized = false;             // is the editor initialized
    w.isDocLoaded = false;               // has a doc been loaded

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
    w.XMLRDF = 0;                       // XML + RDF
    w.XML = 1;                          // XML only
    w.RDF = 2;                          // RDF only (not currently used)
    w.JSON = 3;                         // annotation type

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
    w.getUniqueId = (prefix) => {
        // eslint-disable-next-line no-undef
        const id = tinymce.DOM.uniqueId(prefix);
        return id;
    };

    /**
     * Loads a document into the editor
     * @fires Writer#loadingDocument
     * @param {String} docUrl An URL pointing to an XML document
     */
    w.loadDocumentURL = (docUrl) => {
        w.converter.loadDocumentURL(docUrl);
    };

    /**
     * Load a document into the editor
     * @fires Writer#loadingDocument
     * @param {Document|String} docXml An XML document or a string representation of such.
     */
    w.loadDocumentXML = (docXml) => w.converter.loadDocumentXML(docXml);

    w.showLoadDialog = () => w.storageDialogs.load(w);
    w.showSaveDialog = () => w.storageDialogs.save(w);

    // TODO temp github implementation
    w.getDocumentURI = () => {
        if (w.storageDialogs.getDocumentURI) return w.storageDialogs.getDocumentURI();
            
        if (w.filePathInGithub) {
            return `https://github.com/${w.repoName}/blob/master${w.filePathInGithub}`;
        } else {
            return 'https://github.com/placeholder/blob/master/placeholder.xml';
        }
    };

    w.getUserInfo = () => {
        if (w.storageDialogs.getUserInfo) {
            const userInfo = w.storageDialogs.getUserInfo();
            return {
                id: userInfo.userUrl,
                name: userInfo.userName,
                nick: userInfo.userId
            };
        } 

        return {
            id: 'http://id.cwrc.ca/user/placeholder',
            name: 'Placeholder',
            nick: 'plchldr'
        };
    };

    //Function to override
    w.showSaveAsDialog = function() {};
    w.saveAndExit = function() {};

    w.exit = () => {
        if (w.storageDialogs.logOut) {
            w.storageDialogs.logOut(w);
        } else {
            console.warn('writer: no exit/logout method found!');
        }
    };

    w.validate = (callback) => {
        if (callback !== undefined) {
            const doCallback = (isValid) => {
                callback.call(w, isValid);
                w.event('documentValidated').unsubscribe(doCallback);    
            };
            w.event('documentValidated').subscribe(doCallback);
        }
        
        w.event('validationRequested').publish();
    };

    /**
     * Get the document contents as XML
     * @param {Function} callback Callback is called with an XML representation of the document
     */
    w.getDocumentXML = (callback) => {
        w.converter.getDocument(false, callback);
    };

    /**
     * Get the document contents as a string
     * @param {Function} callback Callback is called with a string representation of the document
     */
    w.getDocumentString = (callback) => {
        w.converter.getDocument(true, callback);
    };

    /**
     * Set the current document for the editor
     * @param {Document|String} document Can be one of: URL, XML document, XML string
     */
    w.setDocument = (document) => {
        w.converter.setDocument(document);
    };

    /**
     * Get the raw HTML representation of the document
     * @returns {String}
     */
    w.getDocRawContent = () => {
        return w.editor.getContent({ format: 'raw' });
    };

    /**
     * Is the editor read only?
     * @returns {Boolean}
     */
    w.isEditorReadOnly = () => {
        return w.editor.getBody().getAttribute('contenteditable') === 'false';
    };

    /**
     * Destroy the CWRC-Writer
     */
    w.destroy = () => {
        console.info('destroying', w.editor.id);

        try {
            // clear the editor first (large docs can cause the browser to freeze)
            $(w.editor.getBody()).empty();
        } catch (e) {
            console.log(e);
        }

        window.removeEventListener('beforeunload', handleUnload);

        w.editor.remove();
        w.editor.destroy();

        w.utilities.destroy();
        w.dialogManager.destroy();
        w.layoutManager.destroy();
        w.eventManager.destroy();
    };

    // Unload functions

    const handleUnload = (e) => {
        if ((w.isReadOnly === false || w.isAnnotator === true) && window.location.hostname !== 'localhost') {
            // eslint-disable-next-line no-undef
            if (tinymce.get(editorId).isDirty()) {
                const msg = 'You have unsaved changes.';
                (e || window.event).returnValue = msg;
                return msg;
            }
        }
    };

    window.addEventListener('beforeunload', handleUnload);

    $(window).on('unload', () => {
        try {
            // clear the editor first (large docs can cause the browser to freeze)
            w.utilities.getRootTag().remove();
        } catch (e) {
            console.log(e);
        }
    });


    // INIT
    w._settings = {
        filterTags: {
            useDocumentTags: true,
            useStructuralOrder: true
        }
    };

    if (config.storageDialogs !== null) {
        w.storageDialogs = config.storageDialogs.module;
    } else {
        alert('Error: you must specify a storage dialogs class in the CWRCWriter config to allow loading and saving documents.');
    }

    if (config.entityLookupDialogs !== null) {
        w.entityLookupDialogs = config.entityLookupDialogs;
    } else {
        alert('Error: you must specify entity lookups in the CWRCWriter config for full functionality!');
    }

    w.eventManager = new EventManager(w);

    w.event('processingDocument').subscribe(() => {
        w.triples = [];
    });

    w.event('documentLoaded').subscribe((success) => {
        w.isDocLoaded = success ? true : false;
    });

    w.event('tinymceInitialized').subscribe(async() => {
        // fade out loading mask and do final resizing after tinymce has loaded
        w.layoutManager.$outerLayout.options.onresizeall_end = () => {
            w.layoutManager.$outerLayout.options.onresizeall_end = null;
            w.layoutManager.$loadingMask.fadeOut(350);
        };

        w.workerValidator = await loadWorkerValidator();

        setTimeout(() => {
            w.layoutManager.resizeAll();
            setTimeout(() => {
                w.isInitialized = true;
                w.event('writerInitialized').publish(w);
            }, 350);
        }, 1000);
    });

    w.utilities = new Utilities(w);

    const editorId = w.getUniqueId('editor_');
    w.layoutManager = new LayoutManager(w);
    w.layoutManager.init({
        editorId: editorId,
        modules: config.modules,
        container: $(`#${w.containerId}`)
    });

    w.schemaManager = new SchemaManager(w, config.schema);
    w.entitiesManager = new EntitiesManager(w);
    w.dialogManager = new DialogManager(w); // needs to load before SettingsDialog
    w.tagger = new Tagger(w);
    w.converter = new Converter(w);
    w.annotationsManager = new AnnotationsManager(w);

    const layoutContainerId = w.layoutManager.getContainer().attr('id');

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


const loadWorkerValidator = async () => {
    const timeout = 30000; //high timeout due to large webworker file

    //* uncomment the first and comment the second for local development
    // return await spawn(new Worker('cwrc-worker-validator/src/index.ts'), { timeout });
    return await spawn(new Worker('./js/cwrc.worker.js'), { timeout });
  };

export default Writer;
