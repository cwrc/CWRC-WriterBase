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
     * @property {Array} xmlUrl Collection of URLs where the schema is located
     * @property {string} cssUrl Collection of URLs where the schema's CSS is located
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
    
    sm._xmlUrl = null;
    /**
     * Get the URL for the XML for the current schema.
     * @returns {String}
     */
    sm.getXMLUrl = function() {
        return sm._xmlUrl;
    };
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
    
    sm._cssUrl = null;
    /**
     * Get the URL for the CSS for the current schema.
     * @returns {String}
     */
    sm.getCSSUrl = function() {
        return sm._cssUrl;
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
     * @param {String} config.name A name for the schema
     * @param {Array} config.xmlUrl The xml url(s) for the schema
     * @param {Array} config.cssUrl The css url(s) for the schema
     * @returns {String} id The id for the schema
     * 
     */
    sm.addSchema = function(config) {
        config.id = w.getUniqueId('schema');
        if (config.xmlUrl && typeof config.xmlUrl === 'string') {
            config.xmlUrl = [config.xmlUrl]
        }
        if (config.cssUrl && typeof config.cssUrl === 'string') {
            config.cssUrl = [config.cssUrl]
        }
        sm.schemas.push(config);
        w.event('schemaAdded').publish(config.id);
        return config.id;
    };
    
    /**
     * Gets the url(s) associated with the schema
     * @param {String} schemaId The ID of the schema
     * @returns {Array|null} Collection of urls for the schema
     */
    sm.getUrlForSchema = function(schemaId) {
        const schemaEntry = sm.schemas.find( schema => schema.id === schemaId);
        if (schemaEntry !== undefined) return schemaEntry.xmlUrl;
        return null;
    };

    /**
     * Gets the name of the root element for the schema
     * @param {String} schemaId The ID of the schema
     * @returns {String} The (first) root name
     */
    sm.getRootForSchema = async function(schemaId) {
        
        if (sm.mapper.mappings[schemaId] !== undefined) {
            return sm.mapper.mappings[schemaId].root[0];
        } 

        const xmlUrl = sm.getUrlForSchema(schemaId);

        if (!xmlUrl) {
            throw 'schemaManager.getRootForSchema: no url for '+schemaId;
        }

        //load resource
        const schemaXML = await loadXMLFile(xmlUrl);
        if (!schemaXML) throw `schemaManager.getRootForSchema: could not connect to ${schemaId}`;

        let rootEl = $('start element:first', schemaXML).attr('name');
        if (!rootEl) {
            const startName = $('start ref:first', schemaXML).attr('name');
            rootEl = $('define[name="'+startName+'"] element', schemaXML).attr('name');
        }

        return rootEl;
    
    }

    /*****************************
     * LOAD SCHEMA XML
     *****************************/

    /**
     * Load a Schema XML.
     * @param {Array} xmlUrl Collection of url sources
     */
    const loadXMLFile = async (xmlUrl) => {

        let xml;

        //loop through URL collection
        for (let url of xmlUrl) {

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
                sm._xmlUrl = url;
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
        const includesXML = await loadXMLFile([url]);
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
     * Process a schema:
     * - Add CSS for displaying tags in the editor
     * - Hide the header tag
     * - Set references to the elements and the JSON version of the schema
     */
    const processSchema = () => {
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
     * @param {Boolean} loadCss Whether to load the associated CSS
     * @param {Function} [callback] Callback for when the load is complete
     */
    sm.loadSchema = async function (schemaId, loadCss, callback) {
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
        const schemaXML = await loadXMLFile(schemaEntry.xmlUrl);
        if (!schemaXML) {
            sm.schemaId = null;
            w.dialogManager.show('message',{
                title: 'Error',
                msg: `<p>Error loading schema from: ${schemaEntry.name}.</p>
                      <p>Document editing will not work properly!</p>`,
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
        if (loadCss === true) sm.loadSchemaCSS(schemaEntry.cssUrl);

        //Process schema
        processSchema();

        w.event('schemaLoaded').publish();
        
        if (callback) {
            callback(true);
        } else {
            const tag = sm.getTagForEditor(sm._root);
            w.editor.setContent(`${tag} _tag="${sm._root}"></${tag}>`);
        }
    };

    /*****************************
     * LOAD SCHEMA CSS
     *****************************/

    /**
     * Load a Schema CSS.
     * @param {Array} cssUrl Collection of url sources
     */
    const loadCSSFile = async (cssUrl) => {

        let css;

        //loop through URL collection
        for (let url of cssUrl) {

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
                sm._cssUrl = url; // redefine schema manager css based on the avaiable url
                break;
            }

        }

        return css;
         
    }
    
    /**
     * Load the CSS and convert it to the internal format
     * @param {Array} cssURL Collection of url sources
     */
    sm.loadSchemaCSS = async function(cssURL) {
        $('#schemaRules', w.editor.dom.doc).remove();
        $('#schemaRules', document).remove();
         
        //load resource
        const cssData = await loadCSSFile(cssURL);
        if (!cssData) {
            w.dialogManager.show('message', {
                title: 'Error',
                msg: 'No CSS could be loaded to this schema.',
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


    w.event('schemaChanged').subscribe( (schemaId) =>  {
        sm.loadSchema(schemaId, false, true, function() {});
    });
    
    return sm;
}


module.exports = SchemaManager;