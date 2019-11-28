'use strict';

const $ = require('jquery');
const Mapper = require('./mapper.js');
const css = require('css');
const SchemaNavigator = require('./schemaNavigator.js');

/**
 * @class SchemaManager
 * @param {Writer} writer
 * @param {Object} config
 * @param {Array} config.schemas
 */
function SchemaManager(writer, config) {
    const w = writer;
    
    /**
     * @lends SchemaManager.prototype
     */
    const sm = {};

    const BLOCK_TAG = 'div';
    const INLINE_TAG = 'span';
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
     * The proxy URL through which the schema XML and CSS
     * are loaeed, according to config.schemaProxyUrl
     * @member {String}
     */ 
    sm.schemaProxyUrl = config.schemaProxyUrl;
    
    /**
     * An array of schema objects. Each object should have the following properties:
     * @member {Array} of {Objects}
     * @property {String} id A id for the schema
     * @property {String} name A name/label for the schema
     * @property {String} url The URL where the schema is located
     * @property {String} altUrl (Optional) The alternative URL where the schema is located
     * @property {string} cssUrl The URL where the schema's CSS is located
     * @property {string} altCssUrl (Optional) The alternative URL where the schema's CSS is located
     * 
     */
    sm.schemas = config.schemas || [];
    
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
        return sm.schemas.find( schema => schema.id === sm.schemaId);
    };

    /**
     * Returns the schemaId associated with a specific root
     * @param {String} root The root name
     * @returns {String} The schemaId (or undefined)
     */
    sm.getSchemaIdFromRoot = function(root) {
        for (const schemaId in sm.mapper.mappings) {
            if (sm.mapper.mappings[schemaId].root.indexOf(root) !== -1) {
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
         * @param status Keep track of status while recursing
         */
        function checkForText(currEl, defHits, level, status) {
            if (status.canContainText) {
                return false;
            }
            
            // check for the text element
            const textHits = currEl.find('text');
            if (textHits.length > 0 && (level === 0 || textHits.parents('element').length === 0)) { // if we're processing a ref and the text is inside an element then it doesn't count
                status.canContainText = true;
                return false;
            }
            
            // now process the references
            currEl.find('ref').each(function(index, el) {
                const name = $(el).attr('name');
                if ($(el).parents('element').length > 0 && level > 0) {
                    return; // ignore other elements
                }
                if (!defHits[name]) {
                    defHits[name] = true;
                    const def = $('define[name="'+name+'"]', sm.schemaXML);
                    return checkForText(def, defHits, level+1, status);
                }
            });
        }

        let useLocalStorage = false;
        if (useLocalStorage) {
            let localData = localStorage['cwrc.'+tag+'.text'];
            if (localData) return localData == 'true';
        }
        
        const element = $('element[name="'+tag+'"]', sm.schemaXML);
        const defHits = {};
        const level = 0;
        const status = {canContainText: false}; // needs to be an object so change is visible outside of checkForText
        checkForText(element, defHits, level, status);
        
        if (useLocalStorage) {
            localStorage['cwrc.'+tag+'.text'] = status.canContainText;
        }
        
        return status.canContainText;
    };

    sm.isTagBlockLevel = function(tagName) {
        if (tagName == sm.getRoot()) return true;
        return w.editor.schema.getBlockElements()[tagName] != null;
    };
    
    sm.isTagEntity = function(tagName) {
        const type = sm.mapper.getEntityTypeForTag(tagName);
        return type !== null;
    };
    
    sm.getTagForEditor = function(tagName) {
        return sm.isTagBlockLevel(tagName) ? BLOCK_TAG : INLINE_TAG;
    };

    sm.getDocumentationForTag = function(tag) {
        const element = $('element[name="'+tag+'"]', sm.schemaXML);
        const doc = $('a\\:documentation, documentation', element).first().text();
        return doc;
    };
    
    sm.getFullNameForTag = function(tag) {
        const element = $('element[name="'+tag+'"]', sm.schemaXML);
        const doc = $('a\\:documentation, documentation', element).first().text();
        // if the tag name is an abbreviation, we expect the full name to be at the beginning of the doc, in parentheses
        const hit = /^\((.*?)\)/.exec(doc);
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
        const tags = sm.getChildrenForTag(tag);
        for (let i = tags.length-1; i > -1; i--) {
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
        const atts = sm.getAttributesForTag(tag);
        return atts.length !== 0;
    };

    /**
     * Verifies that the child has a valid parent.
     * @param {String} childName The child tag name
     * @param {String} parentName The parent tag name
     * @returns {Boolean}
     */
    sm.isTagValidChildOfParent = function(childName, parentName) {
        const parents = sm.getParentsForTag(childName);
        for (let i = 0; i < parents.length; i++) {
            if (parents[i].name === parentName) {
                return true;
            }
        }
        return false;
    };

    /**
     * Checks whether removing this node would invalidate the document.
     * @param {Element} nodeToDelete The node to remove
     * @returns {Boolean}
     */
    sm.wouldDeleteInvalidate = function(nodeToDelete) {
        let parentEl = nodeToDelete.parentElement;
        let parentTag = parentEl.getAttribute('_tag');
        // handling for when we're inside entityHighlight
        while (parentTag === null) {
            parentEl = parentEl.parentElement;
            parentTag = parentEl.getAttribute('_tag');
        }

        const validChildren = sm.getChildrenForTag(parentTag);
        let validDelete = true;
        for (let i = 0; i < nodeToDelete.children.length; i++) {
            const child = nodeToDelete.children[i];
            const childTag = child.getAttribute('_tag');
            const childIsValid = validChildren.find(vc => {
                return vc.name === childTag
            });
            if (!childIsValid) {
                validDelete = false;
                break;
            }
        }

        if (validDelete) {
            let hasTextNodes = false;
            nodeToDelete.childNodes.forEach(cn => {
                if (!hasTextNodes && cn.nodeType === Node.TEXT_NODE && cn.textContent !== '\uFEFF') {
                    hasTextNodes = true;
                }
            })
            if (hasTextNodes && sm.canTagContainText(parentTag) === false) {
                validDelete = false;
            }
        }

        return !validDelete;
    }


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
        config.id = w.getUniqueId('schema');
        sm.schemas.push(config);
        w.event('schemaAdded').publish(config.id);
        return config.id;
    };
    
    /**
     * Gets the url associated with the schema
     * @param {String} schemaId The ID of the schema
     * @returns {String} url The url for the schema
     */
    sm.getUrlForSchema = function(schemaId) {
        const schemaEntry = sm.schemas.find( schema => schema.id === schemaId);
        if (schemaEntry !== undefined) return schemaEntry.url;
        return null;
    };

    /**
     * Gets the name of the root element for the schema
     * @param {String} schemaId The ID of the schema
     * @returns {Promise} Promise object which resolves to the (first) root name (string)
     */
    sm.getRootForSchema = async function(schemaId) {
        return new Promise( async (resolve, reject) => {
            if (sm.mapper.mappings[schemaId] !== undefined) {
                resolve(sm.mapper.mappings[schemaId].root[0]);
            } else {
                const url = sm.getUrlForSchema(schemaId);

                if (!url) {
                    reject('schemaManager.getRootForSchema: no url for '+schemaId);
                }

                const response = await fetch(url)
                    .catch( (err) => {
                        console.log(err)
                        reject('schemaManager.getRootForSchema: no url for '+schemaId);
                    });

                let rootEl = $('start element:first', response).attr('name');
                if (!rootEl) {
                    const startName = $('start ref:first', response).attr('name');
                    rootEl = $('define[name="'+startName+'"] element', response).attr('name');
                }

                resolve(rootEl);
                
            }
        });
    }

    /*****************************
     * LOAD SCHEMA XML
     *****************************/

    /**
     * Load a Schema XML.
     * @param {Object} annon An object containing url and altUrl
     * @param {String} url The primary url source
     * @param {String} altUrl The secondary url source
     */
    const loadXML = async ({url,altUrl}) => {

        let xml;

        //Make an array of urls. Remove when modifiy the config to list urls as
        // an array instead of properties.
        const resourceURLs = [];
        if (url) resourceURLs.push(url);
        if (altUrl) resourceURLs.push(altUrl);

        for (let url of resourceURLs) {

            //use the proxy if available.
            if (sm.schemaProxyUrl) {
                url = `${sm.schemaProxyUrl}/schema/xml?url=${url}`;
            }

            const response = await fetch(url)
                .catch( (err) => {
                    console.log(err)
                });

            // if loaded, converto to XML, break the loop and return
            if (response && response.status === 200) {
                const body = await response.text();
                xml = w.utilities.stringToXML(body);
                break;
            }

        }

        return xml;
         
    }

    /**
     * Load an include schema.
     * @param {String} schemaEntry The Schchema object, including the Schema URL 
     * @param {String} include The schema to include
     */
    const loadIncludes = async (schemaEntry, include) => {
         
        let url = '';
        let schemaFile;
        const includeHref = include.attr('href');

        if (includeHref.indexOf('/') != -1) {
            schemaFile = includeHref.match(/(.*\/)(.*)/)[2]; // grab the filename
        } else {
            schemaFile = includeHref;
        }

        const schemaBase = schemaEntry.url.match(/(.*\/)(.*)/)[1];
        if (schemaBase != null) {
            url = schemaBase + schemaFile;
        } else {
            url = 'schema/'+schemaFile;
        }

        //load resource
        const includesXML = await loadXML({url});
        if (!includesXML) return null;
        
        include.children().each( (index, el) => {
            if (el.nodeName == 'start') {
                $('start', includesXML).replaceWith(el);
            } else if (el.nodeName == 'define') {
                const name = $(el).attr('name');
                let match = $(`define[name="${name}"]`, includesXML);
                if (match.length == 1) {
                    match.replaceWith(el);
                } else {
                    $('grammar', includesXML).append(el);
                }
            }
        });
        
        include.replaceWith($('grammar', includesXML).children());

        return;
         
    }

    /**
     * Process a schema
     * @param {Boolean} startText Whether to include the default starting text
     * @param {Function} callback Callback for when the load is complete
     */
    const processSchema = (startText, callback) => {
        // remove old schema elements
        $('#schemaTags', w.editor.dom.doc).remove();
        
        // create css to display schema tags
        $('head', w.editor.getDoc()).append('<style id="schemaTags" type="text/css" />');
        
        let schemaTags = '';
        const elements = [];
        $('element', sm.schemaXML).each( (index, el) => {
            const tag = $(el).attr('name');
            if (tag != null && elements.indexOf(tag) == -1) {
                elements.push(tag);
                schemaTags += `.showTags *[_tag=${tag}]:before { color: #aaa !important; font-size: 13px !important; font-weight: normal !important; font-style: normal !important; font-family: monospace !important; font-variant: normal !important; content: "<${tag}>"; }`;
                schemaTags += `.showTags *[_tag=${tag}]:after { color: #aaa !important; font-size: 13px !important; font-weight: normal !important; font-style: normal !important; font-family: monospace !important; font-variant: normal !important; content: "</${tag}>"; }`;
            }
        });
        elements.sort();
        
        // hide the header
        const tagName = sm.getTagForEditor(sm._header);
        schemaTags += tagName+`[_tag=${sm._header}] { display: none !important; }`;
        
        $('#schemaTags', w.editor.getDoc()).text(schemaTags);
        
        sm.schema.elements = elements;
        sm.navigator.setSchemaElements(sm.schema.elements);
        
        if (callback === null) {
            let text = '';
            if (startText) text = 'Paste or type your text here.';
            const tag = sm.getTagForEditor(sm._root);
            w.editor.setContent(`${tag} _tag="${sm._root}">${text}</${tag}>`);
        }
        
        sm.schemaJSON = w.utilities.xmlToJSON($('grammar', sm.schemaXML)[0]);
        if (sm.schemaJSON === null) {
            console.warn('schemaManager.loadSchema: schema XML could not be converted to JSON');
        }
        sm.navigator.setSchemaJSON(sm.schemaJSON);
        
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
    sm.loadSchema = async function (schemaId, startText, loadCss, callback) {

        const schemaEntry = sm.schemas.find( schema => schema.id === schemaId);

        if (schemaEntry === undefined) {
            w.dialogManager.show('message', {
                title: 'Error',
                msg: `Error loading schema. No entry found for: ${schemaId}`,
                type: 'error'
            });
            if (callback) callback(false);
            return;
        }

        w.event('loadingSchema').publish();

        sm.schemaId = schemaId;
        const schemaMappingsId = schemaEntry.schemaMappingsId;
        sm.mapper.loadMappings(schemaMappingsId);

        //load resource
        const schemaXML = await loadXML(schemaEntry);
        if (!schemaXML) {
            sm.schemaId = null;
            w.dialogManager.show('message',{
                title: 'Error',
                msg: `<p>Error loading schema from: ${schemaEntry.name}.</p><p>Document editing will not work properly!</p>`,
                type: 'error'
            });
            if (callback) callback(false);
            return null;
        }

        sm.schemaXML = schemaXML;

        // get root element
        let startEl = $('start element:first', sm.schemaXML).attr('name');
        if (!startEl) {
            const startName = $('start ref:first', sm.schemaXML).attr('name');
            startEl = $(`define[name="${startName}"] element`, sm.schemaXML).attr('name');
        }
        
        sm._root = startEl;
        sm._header = sm.mapper.getHeaderTag();
        sm._idName = sm.mapper.getIdAttributeName();
        
        // TODO is this necessary
        const additionalBlockElements = sm.mapper.getBlockLevelElements();
        const blockElements = w.editor.schema.getBlockElements();
        for (let i = 0; i < additionalBlockElements.length; i++) {
            blockElements[additionalBlockElements[i]] = {};
        }
        
        // handle includes
        const include = $('include:first', sm.schemaXML); // TODO add handling for multiple includes
        if (include.length == 1) {
            await loadIncludes(schemaEntry,include); // TODO  it seems that includes goes nowhere.
        }

        //load CSS
        if (loadCss === true) sm.loadSchemaCSS(schemaEntry);

        //Process schema
        processSchema(startText, callback);

        w.event('schemaLoaded').publish();
        
        if (callback) callback(true);
    
    };

    /*****************************
     * LOAD SCHEMA CSS
     *****************************/

    /**
     * Load a Schema CSS.
     * @param {Object} annon An object containing url and altUrl
     * @param {String} cssUrl The primary url source
     * @param {String} altCssUrl The secondary url source
     */
    const loadCSS = async ({cssUrl,altCssUrl}) => {

        let css;

        //Make an array of urls. Remove when modifiy the config to list urls as
        // an array instead of properties.
        const resourceURLs = [];
        if (cssUrl) resourceURLs.push(cssUrl);
        if (altCssUrl) resourceURLs.push(altCssUrl);

        for (let url of resourceURLs) {

            //redifine schema manager css based on the avaiable url
            sm._css = url;

            //use the proxy if available.
            if (sm.schemaProxyUrl) {
                url = `${sm.schemaProxyUrl}/schema/css?url=${url}`;
            }

            const response = await fetch(url)
                .catch( (err) => {
                    console.log(err);
                });

            //if loaded, break the loop and return
            if (response && response.status === 200) {
                css = await response.text();
                break;
            }

        }

        return css;
         
    }
    
    /**
     * Load the CSS and convert it to the internal format
     * @param {Object} schemaEntry The ShemaEntry object that contains url for the CSS
     */
    sm.loadSchemaCSS = async function(schemaEntry) {
        $('#schemaRules', w.editor.dom.doc).remove();
        $('#schemaRules', document).remove();
         
        //load resource
        const cssData = await loadCSS(schemaEntry);
        if (!cssData) {
            w.dialogManager.show('message', {
                title: 'Error',
                msg: `Error loading schema CSS from: ${schemaEntry.name}`,
                type: 'error'
            });
            return null;
        }
        
        const cssObj = css.parse(cssData);
        const rules = cssObj.stylesheet.rules;

        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            if (rule.type === 'rule') {
                const convertedSelectors = [];
                for (let j = 0; j < rule.selectors.length; j++) {
                    const selector = rule.selectors[j];
                    const newSelector = selector.replace(/(^|,|\s)(#?\w+)/g, (str, p1, p2, offset, s) => {
                        return p1+'*[_tag="'+p2+'"]';
                    });
                    convertedSelectors.push(newSelector);
                    
                }
                rule.selectors = convertedSelectors;
            }
        }
        
        const cssString = css.stringify(cssObj);
        
        $('head', w.editor.dom.doc).append('<style id="schemaRules" type="text/css" />');
        $('#schemaRules', w.editor.dom.doc).text(cssString);
        // we need to also append to document in order for note popups to be styled
        $('#schemaRules', w.editor.dom.doc).clone().appendTo($('head', document));
        
    };


    //TODO - where this schemaId comes from?
    w.event('schemaChanged').subscribe( (schemaId) =>  {
        sm.loadSchema(schemaId, false, true, function() {});
    });
    
    return sm;
}


module.exports = SchemaManager;