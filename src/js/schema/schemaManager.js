'use strict';

var $ = require('jquery');
var Mapper = require('./mapper.js');
var cssParser = require('css-parse');
var cssStringify = require('css-stringify');
var SchemaNavigator = require('./schemaNavigator.js');

/**
 * @class SchemaManager
 * @param {Writer} writer
 * @param {Object} config
 * @param {Object} config.schemas
 */
function SchemaManager(writer, config) {
    var w = writer;
    
    /**
     * @lends SchemaManager.prototype
     */
    var sm = {};

    var BLOCK_TAG = 'div';
    var INLINE_TAG = 'span';
    sm.getBlockTag = function() {
        return BLOCK_TAG;
    }
    sm.getInlineTag = function() {
        return INLINE_TAG;
    }
    
    sm.mapper = new Mapper({writer: w});

    sm.navigator = new SchemaNavigator();
    sm.getChildrenForTag = sm.navigator.getChildrenForTag;
    sm.getChildrenForPath = sm.navigator.getChildrenForPath;
    sm.getAttributesForTag = sm.navigator.getAttributesForTag;
    sm.getAttributesForPath = sm.navigator.getAttributesForPath;
    sm.getParentsForTag = sm.navigator.getParentsForTag;
    sm.getParentsForPath = sm.navigator.getParentsForPath;
    
    /**
     * A map of schema objects. The key represents the schema ID, the "value" should have the following properties:
     * @member {Object}
     * @property {String} name A name/label for the schema
     * @property {String} url The URL where the schema is located
     * @property {string} cssUrl The URL where the schema's CSS is located
     */
    sm.schemas = config.schemas || {};
    
    /**
     * The ID of the current validation schema, according to config.schemas
     * @member {String}
     */ 
    sm.schemaId = null;
    
    /**
     * A cached copy of the loaded schema
     * @member {Document}
     */
    sm.schemaXML = null;
    /**
     * A JSON version of the schema
     * @member {Object}
     */
    sm.schemaJSON = null;
    /**
     * Stores a list of all the elements of the current schema
     * @member {Object}
     * @property {Array} elements The list of elements
     */
    sm.schema = {elements: []};

    /**
     * Gets the schema object for the current schema.
     * @returns {Object}
     */
    sm.getCurrentSchema = function() {
        return sm.schemas[sm.schemaId];
    };
    
    /**
     * Stores the root elements of all schemas.
     */
    sm._roots = {};
    function populateRoots() {
        for (var schemaId in sm.schemas) {
            sm.getRootForSchema(schemaId).then(function(id, root) {
                sm._roots[id] = root;
            }.bind(this, schemaId), function(error) {
                console.warn(error);
            });
        }
    };

    /**
     * Returns the schemaId associated with a specific root
     * @param {String} root The root name
     * @returns {String} The schemaId (or undefined)
     */
    sm.getSchemaIdFromRoot = function(root) {
        // TODO populateRoots on demand
        for (var schemaId in sm._roots) {
            if (sm._roots[schemaId] === root) {
                return schemaId;
            }
        }
        return undefined;
    };

    sm._root = null;
    /**
     * Get the root tag name for the current schema.
     * @returns {String}
     */
    sm.getRoot = function() {
        return sm._root;
    };
    
    sm._header = null;
    /**
     * Get the header tag name for the current schema.
     * @returns {String}
     */
    sm.getHeader = function() {
        return sm._header;
    };
    
    sm._idName = null;
    /**
     * Get the name of the ID attribute for the current schema.
     * @returns {String}
     */
    sm.getIdName = function() {
        return sm._idName;
    };
    
    sm._css = null;
    /**
     * Get the URL for the CSS for the current schema.
     * @returns {String}
     */
    sm.getCSS = function() {
        return sm._css;
    };

    /**
     * Is the current schema custom? I.e. is it lacking entity mappings?
     * @returns {Boolean}
     */
    sm.isSchemaCustom = function() {
        return sm.getCurrentSchema().schemaMappingsId === undefined;
    };
    
    /**
     * Checks to see if the tag can contain text, as specified in the schema
     * @param {string} tag The tag to check
     * @returns boolean
     */
    sm.canTagContainText = function(tag) {
        if (tag == sm.getRoot()) return false;
        
        /**
         * @param currEl The element that's currently being processed
         * @param defHits A list of define tags that have already been processed
         * @param level The level of recursion
         * @param canContainText Whether the element can contain text
         */
        function checkForText(currEl, defHits, level, canContainText) {
            if (canContainText.isTrue) {
                return false;
            }
            
            // check for the text element
            var textHits = currEl.find('text');
            if (textHits.length > 0) {
                canContainText.isTrue = true;
                return false;
            }
            
            // now process the references
            currEl.find('ref').each(function(index, el) {
                var name = $(el).attr('name');
                if ($(el).parents('element').length > 0 && level > 0) {
                    return; // don't get attributes from other elements
                }
                if (!defHits[name]) {
                    defHits[name] = true;
                    var def = $('define[name="'+name+'"]', sm.schemaXML);
                    return checkForText(def, defHits, level+1, canContainText);
                }
            });
        }

        var useLocalStorage = false;
        if (useLocalStorage) {
            var localData = localStorage['cwrc.'+tag+'.text'];
            if (localData) return localData == 'true';
        }
        
        var element = $('element[name="'+tag+'"]', sm.schemaXML);
        var defHits = {};
        var level = 0;
        var canContainText = {isTrue: false}; // needs to be an object so change is visible outside of checkForText
        checkForText(element, defHits, level, canContainText);
        
        if (useLocalStorage) {
            localStorage['cwrc.'+tag+'.text'] = canContainText.isTrue;
        }
        
        return canContainText.isTrue;
    };

    sm.isTagBlockLevel = function(tagName) {
        if (tagName == sm.getRoot()) return true;
        return w.editor.schema.getBlockElements()[tagName] != null;
    };
    
    sm.isTagEntity = function(tagName) {
        var type = sm.mapper.getEntityTypeForTag(tagName);
        return type !== null;
    };
    
    sm.getTagForEditor = function(tagName) {
        return sm.isTagBlockLevel(tagName) ? BLOCK_TAG : INLINE_TAG;
    };

    sm.getDocumentationForTag = function(tag) {
        var element = $('element[name="'+tag+'"]', sm.schemaXML);
        var doc = $('a\\:documentation, documentation', element).first().text();
        return doc;
    };
    
    sm.getFullNameForTag = function(tag) {
        var element = $('element[name="'+tag+'"]', sm.schemaXML);
        var doc = $('a\\:documentation, documentation', element).first().text();
        // if the tag name is an abbreviation, we expect the full name to be at the beginning of the doc, in parentheses
        var hit = /^\((.*?)\)/.exec(doc);
        if (hit !== null) {
            return hit[1];
        }
        return '';
    };

    /**
     * Gets the children for a tag but only includes those that are required.
     * @param {String} tag The tag name.
     * @returns {Object}
     */
    sm.getRequiredChildrenForTag = function(tag) {
        var tags = sm.getChildrenForTag(tag);
        for (var i = tags.length-1; i > -1; i--) {
            if (tags[i].required !== true) {
                tags.splice(i, 1);
            }
        }
        return tags;
    };
    
    /**
     * Checks to see if the tag can have attributes, as specified in the schema
     * @param {string} tag The tag to check
     * @returns boolean
     */
    sm.canTagHaveAttributes = function(tag) {
        var atts = sm.getAttributesForTag(tag);
        return atts.length !== 0;
    };

    /**
     * Verifies that the child has a valid parent.
     * @param {String} childName The child tag name
     * @param {String} parentName The parent tag name
     * @return {Boolean}
     */
    sm.isTagValidChildOfParent = function(childName, parentName) {
        var parents = sm.getParentsForTag(childName);
        for (var i = 0; i < parents.length; i++) {
            if (parents[i].name === parentName) {
                return true;
            }
        }
        return false;
    };



    /**
     * Add a schema to the list.
     * @fires Writer#schemaAdded
     * @param {Object} config The config object
     * @param {String} config.name The name for the schema
     * @param {String} config.url The url to the schema
     * @param {String} config.cssUrl The url to the css
     * @returns {String} id The id for the schema
     * 
     */
    sm.addSchema = function(config) {
        var id = w.getUniqueId('schema');
        sm.schemas[id] = config;
        w.event('schemaAdded').publish(id);
        return id;
    };
    
    /**
     * Gets the url associated with the schema
     * @param {String} schemaId The ID of the schema
     * @returns {String} url The url for the schema
     */
    sm.getUrlForSchema = function(schemaId) {
        var schemaEntry = sm.schemas[schemaId];
        if (schemaEntry !== undefined) {
            var schemaUrl = schemaEntry.url;
            return schemaUrl;
        } else {
            return null;
        }
    };

    /**
     * Gets the name of the root element for the schema
     * @param {String} schemaId The ID of the schema
     * @returns {Promise} Promise object which resolves to the root name (string)
     */
    sm.getRootForSchema = function(schemaId) {
        return new Promise(function (resolve, reject) {
            var root = sm._roots[schemaId];
            if (root !== undefined) {
                resolve(root);
            } else {
                var url = sm.getUrlForSchema(schemaId);
                if (url) {
                    $.when(
                        $.ajax({
                            url: url,
                            dataType: 'xml'
                        })
                    ).then(function(resp) {
                        var rootEl = $('start element:first', resp).attr('name');
                        if (!rootEl) {
                            var startName = $('start ref:first', resp).attr('name');
                            rootEl = $('define[name="'+startName+'"] element', resp).attr('name');
                        }
                        resolve(rootEl);
                    }, function(resp) {
                        reject('schemaManager.getRootForSchema: could not connect to '+url);
                    });
                } else {
                    reject('schemaManager.getRootForSchema: no url for '+schemaId);
                }
            }
        });
    }

    /**
     * Load a new schema.
     * @fires Writer#loadingSchema
     * @fires Writer#schemaLoaded
     * @param {String} schemaId The ID of the schema to load (from the config)
     * @param {Boolean} startText Whether to include the default starting text
     * @param {Boolean} loadCss Whether to load the associated CSS
     * @param {Function} callback Callback for when the load is complete
     */
    sm.loadSchema = function(schemaId, startText, loadCss, callback) {
        var schemaEntry = sm.schemas[schemaId];
        if (schemaEntry !== undefined) {
            w.event('loadingSchema').publish();

            sm.schemaId = schemaId;
            var schemaUrl = schemaEntry.url;
            if (schemaEntry.altUrl !== undefined) {
                schemaUrl = schemaEntry.altUrl;
            }
            var schemaMappingsId = schemaEntry.schemaMappingsId;
            
            sm.mapper.loadMappings(schemaMappingsId);
            
            $.when(
                $.ajax({
                    url: schemaUrl,
                    dataType: 'xml'
                })
            ).then(function(resp1) {
                var data = resp1;
                
                sm.schemaXML = data;
                // get root element
                var startEl = $('start element:first', sm.schemaXML).attr('name');
                if (!startEl) {
                    var startName = $('start ref:first', sm.schemaXML).attr('name');
                    startEl = $('define[name="'+startName+'"] element', sm.schemaXML).attr('name');
                }
                
                sm._root = startEl;
                sm._header = sm.mapper.getHeaderTag();
                sm._idName = sm.mapper.getIdAttributeName();
                
                // TODO is this necessary
                var additionalBlockElements = sm.mapper.getBlockLevelElements();
                var blockElements = w.editor.schema.getBlockElements();
                for (var i = 0; i < additionalBlockElements.length; i++) {
                    blockElements[additionalBlockElements[i]] = {};
                }
                
                function processSchema() {
                    // remove old schema elements
                    $('#schemaTags', w.editor.dom.doc).remove();
                    
                    var cssUrl = sm.schemas[sm.schemaId].cssUrl;
                    if (cssUrl && loadCss === true) {
                        sm.loadSchemaCSS(cssUrl);
                    }
                    
                    // create css to display schema tags
                    $('head', w.editor.getDoc()).append('<style id="schemaTags" type="text/css" />');
                    
                    var schemaTags = '';
                    var elements = [];
                    $('element', sm.schemaXML).each(function(index, el) {
                        var tag = $(el).attr('name');
                        if (tag != null && elements.indexOf(tag) == -1) {
                            elements.push(tag);
                            schemaTags += '.showTags *[_tag='+tag+']:before { color: #aaa !important; font-size: 13px !important; font-weight: normal !important; font-style: normal !important; font-family: monospace !important; font-variant: normal !important; content: "<'+tag+'>"; }';
                            schemaTags += '.showTags *[_tag='+tag+']:after { color: #aaa !important; font-size: 13px !important; font-weight: normal !important; font-style: normal !important; font-family: monospace !important; font-variant: normal !important; content: "</'+tag+'>"; }';
                        }
                    });
                    elements.sort();
                    
                    // hide the header
                    var tagName = sm.getTagForEditor(sm._header);
                    schemaTags += tagName+'[_tag='+sm._header+'] { display: none !important; }';
                    
                    $('#schemaTags', w.editor.getDoc()).text(schemaTags);
                    
                    sm.schema.elements = elements;
                    sm.navigator.setSchemaElements(sm.schema.elements);
                    
                    if (callback == null) {
                        var text = '';
                        if (startText) text = 'Paste or type your text here.';
                        var tag = sm.getTagForEditor(sm._root);
                        w.editor.setContent('<'+tag+' _tag="'+sm._root+'">'+text+'</'+tag+'>');
                    }
                    
                    sm.schemaJSON = w.utilities.xmlToJSON($('grammar', sm.schemaXML)[0]);
                    sm.navigator.setSchemaJSON(sm.schemaJSON);
                    
                    w.event('schemaLoaded').publish();
                    
                    if (callback) callback(true);
                }
                
                // handle includes
                var include = $('include:first', sm.schemaXML); // TODO add handling for multiple includes
                if (include.length == 1) {
                    var url = '';
                    var includeHref = include.attr('href');
                    var schemaFile;
                    if (includeHref.indexOf('/') != -1) {
                        schemaFile = includeHref.match(/(.*\/)(.*)/)[2]; // grab the filename
                    } else {
                        schemaFile = includeHref;
                    }
                    var schemaBase = schemaUrl.match(/(.*\/)(.*)/)[1];
                    if (schemaBase != null) {
                        url = schemaBase + schemaFile;
                    } else {
                        url = 'schema/'+schemaFile;
                    }
                    
                    $.ajax({
                        url: url,
                        dataType: 'xml',
                        success: function(data, status, xhr) {
                            // handle redefinitions
                            include.children().each(function(index, el) {
                                if (el.nodeName == 'start') {
                                    $('start', data).replaceWith(el);
                                } else if (el.nodeName == 'define') {
                                    var name = $(el).attr('name');
                                    var match = $('define[name="'+name+'"]', data);
                                    if (match.length == 1) {
                                        match.replaceWith(el);
                                    } else {
                                        $('grammar', data).append(el);
                                    }
                                }
                            });
                            
                            include.replaceWith($('grammar', data).children());
                            
                            processSchema();
                        }
                    });
                } else {
                    processSchema();
                }
            }, function(resp) {
                sm.schemaId = null;
                w.dialogManager.show('message', {title: 'Error', msg: '<p>Error loading schema from: '+schemaUrl+'.</p><p>Document editing will not work properly!</p>', type: 'error'});
                if (callback) callback(false);
            });
        } else {
            w.dialogManager.show('message', {title: 'Error', msg: 'Error loading schema. No entry found for: '+schemaId, type: 'error'});
            if (callback) callback(false);
        }
    };
    
    /**
     * Load the CSS and convert it to the internal format
     * @param {String} url The URL for the CSS
     */
    sm.loadSchemaCSS = function(url) {
        $('#schemaRules', w.editor.dom.doc).remove();
        $('#schemaRules', document).remove();
        
        $.ajax({url: url}).then(function(data) {
            sm._css = url;
            
            var cssObj = cssParser(data);
            var rules = cssObj.stylesheet.rules;
            for (var i = 0; i < rules.length; i++) {
                var rule = rules[i];
                if (rule.type === 'rule') {
                    var convertedSelectors = [];
                    for (var j = 0; j < rule.selectors.length; j++) {
                        var selector = rule.selectors[j];
                        var newSelector = selector.replace(/(^|,|\s)(#?\w+)/g, function(str, p1, p2, offset, s) {
                            return p1+'*[_tag="'+p2+'"]';
                        });
                        convertedSelectors.push(newSelector);
                        
                    }
                    rule.selectors = convertedSelectors;
                }
            }
            var cssString = cssStringify(cssObj);
            
            $('head', w.editor.dom.doc).append('<style id="schemaRules" type="text/css" />');
            $('#schemaRules', w.editor.dom.doc).text(cssString);
            // we need to also append to document in order for note popups to be styled
            $('#schemaRules', w.editor.dom.doc).clone().appendTo($('head', document));
        }, function(err) {
            w.dialogManager.show('message', {title: 'Error', msg: 'Error loading schema CSS from: '+url, type: 'error'});
        });
    };
    
    // populateRoots();

    w.event('schemaChanged').subscribe(function(schemaId) {
        sm.loadSchema(schemaId, false, true, function() {});
    });
    
    return sm;
};

module.exports = SchemaManager;