'use strict';

var $ = require('jquery');
var tinymce = require('tinymce');

/**
 * @class XML2CWRC
 * @param {Writer} writer
 */
function XML2CWRC(writer) {
    var w = writer;

    /**
     * @lends XML2CWRC.prototype
     */
    var xml2cwrc = {};

    // a list of reserved attribute names that are used by the editor
    xml2cwrc.reservedAttributes = {
        '_entity': true,
        '_type': true,
        '_tag': true,
        '_textallowed': true,
        '_note': true,
        '_nerve': true,
        '_attributes': true,
        'id': true,
        'name': true,
        'class': true,
        'style': true
    };

    // tracks whether we're processing a legacy document
    xml2cwrc.isLegacyDocument = undefined;

    /**
     * Processes a document and loads it into the editor.
     * @fires Writer#processingDocument
     * @fires Writer#documentLoaded
     * @param {Document} doc An XML DOM
     * @param {Boolean} [convertEntities] Whether to convert entities, defaults to true
     */
    xml2cwrc.processDocument = function(doc, convertEntities) {
        convertEntities = convertEntities === undefined ? true : convertEntities;

        // clear current doc
        $(w.editor.getBody()).empty();

        // setTimeout to make sure doc clears first
        setTimeout(function() {
            var info = getSchemaInfo(doc);

            var schemaId = info.schemaId;
            var schemaUrl = info.schemaUrl;
            var cssUrl = info.cssUrl;
            var loadSchemaCss = cssUrl === undefined; // load schema css if none was found in the document

            if (schemaUrl === undefined && schemaId === undefined) {
                schemaId = w.schemaManager.getSchemaIdFromRoot(doc.firstElementChild.nodeName);
            }

            if (schemaId === undefined) {
                w.dialogManager.confirm({
                    title: 'Warning',
                    msg: '<p>The document you are loading is not fully supported by CWRC-Writer. You may not be able to use the ribbon to tag named entities.</p>'+
                    '<p>Load document anyways?</p>',
                    type: 'error',
                    callback: function(doIt) {
                        if (doIt) {
                            if (cssUrl !== undefined) {
                                w.schemaManager.loadSchemaCSS(cssUrl);
                            }
                            if (schemaUrl !== undefined) {
                                var customSchemaId = w.schemaManager.addSchema({
                                    name: 'Custom Schema',
                                    url: schemaUrl,
                                    cssUrl: cssUrl
                                });
                                w.schemaManager.loadSchema(customSchemaId, false, loadSchemaCss, function(success) {
                                    if (success) {
                                        doProcessing(doc, convertEntities);
                                    } else {
                                        doBasicProcessing(doc);
                                    }
                                });
                            } else {
                                doBasicProcessing(doc);
                            }
                        } else {
                            w.event('documentLoaded').publish(false, null);
                            w.showLoadDialog();
                        }
                    }
                });
                
            } else {
                if (schemaId !== w.schemaManager.schemaId) {
                    if (cssUrl !== undefined) {
                        w.schemaManager.loadSchemaCSS(cssUrl);
                    }
                    w.schemaManager.loadSchema(schemaId, false, loadSchemaCss, function(success) {
                        if (success) {
                            doProcessing(doc, convertEntities);
                        } else {
                            doBasicProcessing(doc);
                        }
                    });
                } else {
                    doProcessing(doc, convertEntities);
                }
            }
        }, 0);
    };

    /**
     * Get the schema and css from the xml-model
     * @param {Document} doc 
     * @returns {Object} info
     */
    function getSchemaInfo(doc) {
        var schemaId;
        var schemaUrl;
        var cssUrl;
        for (var i = 0; i < doc.childNodes.length; i++) {
            var node = doc.childNodes[i];
            if (node.nodeName === 'xml-model') {
                var xmlModelData = node.data;
                schemaUrl = xmlModelData.match(/href="([^"]*)"/)[1];
                 // remove the protocol in order to disregard http/https for improved chances of matching below
                var schemaUrlNoProtocol = schemaUrl.split(/^.*?\/\//)[1];
                // search the known schemas, if the url matches it must be the same one
                $.each(w.schemaManager.schemas, function(id, schema) {
                    if (schema.url.indexOf(schemaUrlNoProtocol) !== -1) {
                        schemaId = id;
                        return false;
                    }
                    if (schema.aliases !== undefined) {
                        $.each(schema.aliases, function(index, alias) {
                            if (alias.indexOf(schemaUrlNoProtocol) !== -1) {
                                schemaId = id;
                                return false;
                            }
                        });
                        if (schemaId !== undefined) {
                            return false;
                        }
                    }
                });
            } else if (node.nodeName === 'xml-stylesheet') {
                var xmlStylesheetData = node.data;
                cssUrl = xmlStylesheetData.match(/href="([^"]*)"/)[1];
            }
        }

        return {
            schemaId: schemaId,
            schemaUrl: schemaUrl,
            cssUrl: cssUrl
        }
    }

    /**
     * Check to see if the document uses the older "custom" TEI format.
     * @param {Document} doc
     * @returns {Boolean}
     */
    function isLegacyDocument(doc) {
        var hasRdf = $(doc).find('rdf\\:RDF, RDF').length > 0;
        var hasOldAnnotationIds = $(doc).find('*[annotationId], *[offsetId]').length > 0;
        var hasOldRdfParent = w.utilities.evaluateXPath(doc, w.schemaManager.mapper.getRdfParentSelector()) === null;
        return hasRdf && (hasOldAnnotationIds || hasOldRdfParent);
    }

    function doBasicProcessing(doc) {
        w.event('processingDocument').publish();

        w.entitiesManager.reset();
        w.triples = [];
        
        $(doc).find('rdf\\:RDF, RDF').remove();
        var root = doc.documentElement;
        var editorString = xml2cwrc.buildEditorString(root, !w.isReadOnly);
        w.editor.setContent(editorString, {format: 'raw'});
        
        w.event('documentLoaded').publish(false, w.editor.getBody());
    }

    function doProcessing(doc, convertEntities) {
        w.event('processingDocument').publish();

        // reset the stores
        w.entitiesManager.reset();
        w.triples = [];

        xml2cwrc.isLegacyDocument = isLegacyDocument(doc);

        var hasRDF = processRDF(doc);

        if (convertEntities) {
            var typesToFind = undefined;
            if (hasRDF) {
                typesToFind = ['link', 'note'];
            }

            var potentialEntities = xml2cwrc.findEntities(doc, typesToFind);

            if (potentialEntities.length > 0) {
                w.dialogManager.confirm({
                    title: 'Entity Conversion',
                    msg: '<p>CWRC-Writer has found '+potentialEntities.length+' tags that are potential entities.</p>'+
                    '<p>Would you like to convert the tags to entities during the loading process?</p>',
                    type: 'info',
                    callback: function(doIt) {
                        if (doIt) {
                            autoConvertEntityTags(potentialEntities).then(function() {
                                finishProcessing(doc);
                            });
                        } else {
                            finishProcessing(doc);
                        }
                    }
                });
            } else {
                finishProcessing(doc);
            }
        } else {
            finishProcessing(doc);
        }
        
        function finishProcessing(doc) {
            buildDocumentAndInsertEntities(doc).then(function() {
                w.event('documentLoaded').publish(true, w.editor.getBody());
                showMessage(doc);
            });
        }
    }

    /**
     * Get entities from the RDF and then remove all related elements from the document.
     * @param {Document} doc
     * @returns {Boolean} hasRDF
     */
    function processRDF(doc) {
        var $rdfs = $(doc).find('rdf\\:RDF, RDF');
        if ($rdfs.length) {

            $rdfs.children().each(function(index, el) {
                var entityConfig = w.annotationsManager.getEntityConfigFromAnnotation(el);
                if (entityConfig != null) {

                    var isOverlapping = entityConfig.range.endXPath !== undefined;
                    if (!isOverlapping) {

                        // find the associated element and do additional processing
                        var entityEl = w.utilities.evaluateXPath(doc, entityConfig.range.startXPath);

                        if (entityEl === null) {
                            console.warn('xml2cwrc: no matching entity element for',entityConfig);
                            return;
                        }

                        entityConfig.tag = entityEl.nodeName;
                        
                        var id = w.getUniqueId('dom_');
                        entityConfig.id = id;
                        
                        var info = w.schemaManager.mapper.getReverseMapping(entityEl, entityConfig.type);
                        cleanProcessedEntity(entityEl, info);

                        $.extend(entityConfig.customValues, info.customValues);
                        $.extend(entityConfig.attributes, info.attributes);
                    }

                    // replace annotationId with xpath
                    if (xml2cwrc.isLegacyDocument) {
                        var entityEl = w.utilities.evaluateXPath(doc, entityConfig.range.startXPath);
                        entityConfig.range.startXPath = w.utilities.getElementXPath(entityEl);
                        if (isOverlapping) {
                            var entityElEnd = w.utilities.evaluateXPath(doc, entityConfig.range.endXPath);
                            entityConfig.range.endXPath = w.utilities.getElementXPath(entityElEnd);
                        }
                    }

                    w.entitiesManager.addEntity(entityConfig);
                }
            });

            $rdfs.remove();

            // remove all the nodes between the root or header and the rdf parent (including the rdf parent)
            var rdfParent = $(w.utilities.evaluateXPath(doc, w.schemaManager.mapper.getRdfParentSelector()));
            if (rdfParent.length === 1) {
                var currNode = rdfParent[0].nodeName;
                while (currNode !== w.schemaManager.getHeader() && currNode !== w.schemaManager.getRoot()) {
                    rdfParent = rdfParent.parent();
                    if (rdfParent.length === 0) {
                        console.warn('xml2cwrc: went beyond doc root');
                        break;
                    }
                    rdfParent.children(currNode).remove();
                    currNode = rdfParent[0].nodeName;
                }
            } else {
                console.warn('xml2cwrc: couldn\'t find the rdfParent');
            }

            return true;
        } else {
            return false;
        }
    }

    /**
     * Processes an array incrementally, in order to not freeze the browser.
     * @param {Array} array An array of values
     * @param {Function} processFunc The function that accepts a value from the array
     * @param {Number} refreshRate  How often to break (in milliseconds)
     * @returns {Promise} A jQuery promise
     */
    function processArray(array, processFunc, refreshRate) {
        var dfd = new $.Deferred();

        var li = w.dialogManager.getDialog('loadingindicator');

        var startingLength = array.length;
        var time1 = new Date().getTime();

        var parentFunc = function() {
            while (array.length > 0) {
                var entry = array.shift();

                processFunc.call(this, entry);

                var time2 = new Date().getTime();
                if (time2 - time1 > refreshRate) {
                    break;
                }
            }

            var percent = Math.abs(array.length-startingLength) / startingLength * 100;
            li.setValue(percent);

            if (array.length > 0) {
                time1 = new Date().getTime();
                setTimeout(parentFunc, 10);
            } else {
                dfd.resolve();
            }
        }

        parentFunc();

        return dfd.promise();
    }

    /**
     * Convert the entities.
     * @param {Array} entities
     */
    function autoConvertEntityTags(entities) {
        var li = w.dialogManager.getDialog('loadingindicator');
        li.setText('Converting Entities');

        return processArray(entities, function(el) {
            processEntity(el);
        }, 250);
    }

    /**
     * Look for potential entities inside the passed element
     * @param {Document|Element} contextEl
     * @param {Array} [typesToFind] An array of entity types to find, defaults to all types
     * @returns {Array} An array of elements
     */
    xml2cwrc.findEntities = function(contextEl, typesToFind) {
        var entityTagNames = [];

        var allTypes = ['person', 'place', 'date', 'org', 'citation', 'note', 'title', 'correction', 'keyword', 'link'];
        var nonNoteTypes = ['person', 'place', 'date', 'org', 'citation', 'title', 'link'];

        typesToFind = typesToFind === undefined ? nonNoteTypes : typesToFind;
        
        var entityMappings = w.schemaManager.mapper.getMappings().entities;
        for (var type in entityMappings) {
            if (typesToFind.length == 0 || typesToFind.indexOf(type) != -1) {
                var parentTag = entityMappings[type].parentTag;
                if ($.isArray(parentTag)) {
                    entityTagNames = entityTagNames.concat(parentTag);
                } else if (parentTag !== '') {
                    entityTagNames.push(parentTag);
                }
            }
        }

        // TODO tei mapping for correction will match on both choice and corr tags, creating 2 entities when it should be one
        var headerTag = w.schemaManager.mapper.getHeaderTag();
        var potentialEntities = $(entityTagNames.join(','), contextEl).filter(function(index, el) {
            return $(el).parents(headerTag).length === 0; // filter out elements inside the header
        });
        return $.makeArray(potentialEntities);
    }

    /**
     * Process the tag of an entity, and creates a new entry in the manager.
     * @param {Element} el The XML element
     */
    function processEntity(el) {
        var entityType = w.schemaManager.mapper.getEntityTypeForTag(el);
        if (entityType !== null) {
            var config = xml2cwrc.getEntityConfigFromElement(el, entityType);
            
            config.id = w.getUniqueId('dom_');
            config.range = {
                startXPath: w.utilities.getElementXPath(el)
            }

            var entity = w.entitiesManager.addEntity(config);
        }
    }

    /**
     * Returns a config object suitable for creating an Entity
     * @param {Element} el The XML element
     * @param {String} [entityType] The entity type (optional)
     * @return {Object} The config object
     */
    xml2cwrc.getEntityConfigFromElement = function(el, entityType) {
        if (entityType === undefined) {
            entityType = w.schemaManager.mapper.getEntityTypeForTag(el);
        }

        var isNote = w.schemaManager.mapper.isEntityTypeNote(entityType);

        var info = w.schemaManager.mapper.getReverseMapping(el, entityType);
        cleanProcessedEntity(el, info);

        var config = {
            type: entityType,
            isNote: isNote,
            tag: el.nodeName,
            attributes: info.attributes,
            customValues: info.customValues,
            noteContent: info.noteContent,
            cwrcLookupInfo: info.cwrcInfo
        };
        $.extend(config, info.properties);

        return config;
    }

    /**
     * Removes the matched elements in the reverseMappingInfo, then removes the match entries from the reverseMappingInfo object.
     * @param {Element} entityElement
     * @param {Object} reverseMappingInfo
     */
    function cleanProcessedEntity(entityElement, reverseMappingInfo) {
        function removeMatch(match) {
            switch(match.nodeType) {
                case Node.ATTRIBUTE_NODE:
                    if (match.ownerElement !== entityElement) {
                        // console.log('cleanProcessedEntity: removing', match.ownerElement);
                        match.ownerElement.parentElement.removeChild(match.ownerElement);
                    }
                    break;
                case Node.ELEMENT_NODE:
                    if (match !== entityElement) {
                        // console.log('cleanProcessedEntity: removing', match);
                        match.parentElement.removeChild(match);
                    }
                    break;
                case Node.TEXT_NODE:
                    // TODO
                    break;
                default:
                    console.warn('xml2cwrc.cleanProcessedEntity: cannot remove node with unknown type', match);
            }
        }

        for (var key in reverseMappingInfo) {
            if (key !== 'attributes') {
                var level1 = reverseMappingInfo[key];
                if (level1.match) {
                    removeMatch(level1.match);
                    reverseMappingInfo[key] = level1.value;
                } else {
                    for (var key2 in level1) {
                        var level2 = level1[key2];
                        if (level2.match) {
                            removeMatch(level2.match);
                            level1[key2] = level2.value;
                        }
                    }
                }
            }
        }
    }

    /**
     * Takes a document node and returns a string representation of its contents, compatible with the editor.
     * For an async version see buildEditorStringDeferred.
     * @param {Element} node An (X)HTML element
     * @param {Boolean} [includeComments] True to include comments in the output
     * @returns {String}
     */
    xml2cwrc.buildEditorString = function(node, includeComments) {
        var editorString = '';

        function doBuild(node) {
            var tagStrings = getTagStringsForNode(node);
            editorString += tagStrings[0];
            for (var i = 0; i < node.childNodes.length; i++) {
                doBuild(node.childNodes[i]);
            }
            editorString += tagStrings[1];
        }

        doBuild(node);

        return editorString;
    };

    /**
     * Traverse the DOM tree and return an array of nodes in traversal order, with depth info.
     * Includes text nodes but not attribute nodes.
     * @param {Element} parentNode
     * @returns {Array} nodeArray
     */
    function getNodeArray(parentNode) {
        var nodeArray = [];

        function traverse(node, depth) {
            nodeArray.push({node: node, depth: depth});
            for (var i = 0; i < node.childNodes.length; i++) {
                traverse(node.childNodes[i], depth+1);
            }
        }

        traverse(parentNode, 0);

        return nodeArray;
    }

    /**
     * Get the opening and closing tag strings for the specified node.
     * @param {Element} node 
     * @returns {Array} The array of opening and closing tag strings
     */
    function getTagStringsForNode(node) {
        var openingTagString = '';
        var closingTagString = '';
        if (node.nodeType === Node.ELEMENT_NODE) {
            var nodeName = node.nodeName;
            var htmlTag = w.schemaManager.getTagForEditor(nodeName);

            openingTagString += '<'+htmlTag+' _tag="'+nodeName+'"';
            closingTagString = '</'+htmlTag+'>';
            
            if (node.childNodes.length === 0) {
                closingTagString = '\uFEFF'+closingTagString;
            }

            if (node.hasAttribute('id')) {
                console.warn('xml2cwrc.buildEditorString: node already had an ID!', node.getAttribute('id'));
                node.removeAttribute('id');
            }
            var id = w.getUniqueId('dom_');
            openingTagString += ' id="'+id+'"';
            
            var canContainText = w.schemaManager.canTagContainText(nodeName);
            openingTagString += ' _textallowed="'+canContainText+'"';

            if (node.hasAttributes()) {
                var jsonAttrs = {};
                var attrs = node.attributes;
                for (var i = 0; i < attrs.length; i++) {
                    var attName = attrs[i].name;
                    var attValue = attrs[i].value;

                    if (xml2cwrc.isLegacyDocument && attName === 'annotationId' || attName === 'offsetId') {
                        continue;
                    }

                    jsonAttrs[attName] = attValue;

                    if (xml2cwrc.reservedAttributes[attName] === true) {
                        continue;
                    }

                    openingTagString += ' '+attName+'="'+attValue+'"';
                }

                var jsonAttrsString = JSON.stringify(jsonAttrs);
                jsonAttrsString = jsonAttrsString.replace(/"/g, '&quot;');
                openingTagString += ' _attributes="'+jsonAttrsString+'"';
            }

            openingTagString += '>';
        } else if (node.nodeType === Node.TEXT_NODE) {
            var content = node.data.replace(/</g, '&lt;').replace(/>/g, '&gt;'); // prevent tags from accidentally being created
            openingTagString = content;
        } else if (node.nodeType === Node.COMMENT_NODE) {
            // TODO handle comments
        } else {
            console.warn('xml2cwrc.buildEditorString: unsupported node type:', node.nodeType);
        }

        return [openingTagString, closingTagString];
    }

    function buildEditorStringDeferred(parentNode) {
        var dfd = new $.Deferred();

        var li = w.dialogManager.getDialog('loadingindicator');
        li.setText('Building Document');
        
        var editorString = '';
        var closingStack = []; // keeps track of closing tags so we can add them to the editorString when we move up a level in the tree
        var nodeArray = getNodeArray(parentNode);

        var processNode = function(nodeData, prevDepth) {
            var node = nodeData.node;
            var depth = nodeData.depth;

            var tagStrings = getTagStringsForNode(node);

            var openingTagString = tagStrings[0];
            var closingTag = {string: tagStrings[1], depth: depth};
            
            // we're no longer moving down/into the tree, so close open tags
            if (depth <= prevDepth) {
                var stackEntry = closingStack.pop();
                while (stackEntry != null && stackEntry.depth <= prevDepth && stackEntry.depth >= depth) {
                    editorString += stackEntry.string;
                    if (closingStack.length > 0) {
                        // peek at next
                        var nextDepth = closingStack[closingStack.length-1].depth;
                        if (nextDepth <= prevDepth && nextDepth >= depth) {
                            stackEntry = closingStack.pop();
                        } else {
                            stackEntry = null;
                        }
                    } else {
                        stackEntry = null;
                    }
                }
            }

            editorString += openingTagString;
            closingStack.push(closingTag);

            return depth;
        }

        var startingLength = nodeArray.length;
        var time1 = new Date().getTime();
        var refreshRate = 250;
        var depth = 0;
        var parentFunc = function() {
            while (nodeArray.length > 0) {
                var entry = nodeArray.shift();
                depth = processNode(entry, depth);

                var time2 = new Date().getTime();
                if (time2 - time1 > refreshRate) {
                    break;
                }
            }

            var percent = Math.abs(nodeArray.length-startingLength) / startingLength * 100;
            li.setValue(percent);

            if (nodeArray.length > 0) {
                time1 = new Date().getTime();
                setTimeout(parentFunc, 10);
            } else {
                while (closingStack.length > 0) {
                    var stackEntry = closingStack.pop();
                    editorString += stackEntry.string;
                }

                dfd.resolve(editorString);
            }
        }

        parentFunc();

        return dfd.promise();
    }

    function buildDocumentAndInsertEntities(doc) {
        var dfd = new $.Deferred();

        buildEditorStringDeferred(doc.documentElement)
        .then(function(editorString) {
            w.editor.setContent(editorString, {format: 'raw'}); // format is raw to prevent html parser and serializer from messing up whitespace

            return insertEntities();
        })
        .then(function() {
            w.tagger.addNoteWrappersForEntities();

            if (w.entitiesManager.doEntitiesOverlap()) {
                w.allowOverlap = true;
            } else {
                w.allowOverlap = false;
            }

            dfd.resolve();
        });

        return dfd.promise();
    }

    function insertEntities() {
        var entObj = w.entitiesManager.getEntities();
        var entities = Object.keys(entObj).map(function(key) {
            return entObj[key]
        });

        if (entities.length > 0) {
            var li = w.dialogManager.getDialog('loadingindicator');
            li.setText('Inserting Entities');

            // editor needs focus in order for entities to be properly inserted
            w.editor.focus();

            var docRoot = $('[_tag="'+w.schemaManager.getRoot()+'"]', w.editor.getBody())[0];
            
            // insert entities
            var insertEntity = function(entry) {
                var startNode = null;
                var endNode = null;
                var startOffset = 0;
                var endOffset = 0;

                var range = entry.getRange();

                // just rdf, no markup
                if (range.endXPath) {
                    var parent = w.utilities.evaluateXPath(docRoot, range.startXPath);
                    var result = getTextNodeFromParentAndOffset(parent, range.startOffset);
                    startNode = result.textNode;
                    startOffset = result.offset;
                    parent = w.utilities.evaluateXPath(docRoot, range.endXPath);
                    result = getTextNodeFromParentAndOffset(parent, range.endOffset);
                    endNode = result.textNode;
                    endOffset = result.offset;

                    try {
                        var selRange = w.editor.selection.getRng(true);
                        selRange.setStart(startNode, startOffset);
                        selRange.setEnd(endNode, endOffset);
                        w.tagger.addEntityTag(entry, selRange);

                        if (entry.getContent() === undefined) {
                            w.entitiesManager.highlightEntity(); // remove highlight
                            w.entitiesManager.highlightEntity(entry.getId());
                            content = $('.entityHighlight', docRoot).text();
                            w.entitiesManager.highlightEntity();
                        }
                    } catch (e) {
                        console.warn('xml2cwrc: error adding overlapping entity',e);
                    }
                // markup
                } else if (range.startXPath) {
                    var entityNode = w.utilities.evaluateXPath(docRoot, range.startXPath);
                    if (entityNode !== null) {
                        var type = entry.getType();

                        // then tag already exists
                        $(entityNode).attr({
                            '_entity': true,
                            '_type': type,
                            'class': 'entity start end '+type,
                            'name': entry.getId(),
                            'id': entry.getId()
                        });

                        if (entry.getContent() === undefined || entry.getContent() === '') {
                            entry.setContent($(entityNode).text());
                        }

                        if (entry.isNote()) {
                            entry.setNoteContent($(entityNode).html());
                        }
                    } else {
                        console.warn('xml2cwrc.insertEntities: cannot find entity tag for', range.startXPath);
                    }
                }
            };

            return processArray(entities, insertEntity, 250);
        } else {
            var dfd = new $.Deferred();
            dfd.resolve();
            return dfd.promise();
        }
    }

    function getTextNodeFromParentAndOffset(parent, offset) {
        var currentOffset = 0;
        var textNode = null;

        function getTextNode(parent) {
            var ret = true;
            $(parent).contents().each(function(index, element) {
                // Not sure why the &nbsp; text nodes would not be counted but as long
                // as we are consistent in both the saving and loading it should be
                // fine.
                if (element.nodeType === Node.TEXT_NODE && element.data !== ' ') {
                    // Count all the text!
                    currentOffset += element.length;
                    if (currentOffset >= offset) {
                        currentOffset = offset - (currentOffset - element.length);
                        textNode = element;
                        ret = false;
                        return ret;
                    }
                }
                // An Tag or an Entity that is not the one we're looking for.
                else {
                    // We must use all intermediate node's text to ensure an accurate text
                    // count. As the order in which entities are wrapped in spans when the
                    // document is loaded will not be guarantee to be in an order in which
                    // replicates the state the document was in at the time it was saved.
                    ret = getTextNode(element);
                    return ret;
                }
            });
            return ret;
        }

        getTextNode(parent);

        return {
            textNode: textNode,
            offset: currentOffset
        };
    }

    function showMessage(doc) {
        if (w.isReadOnly !== true) {
            var rootEl = doc.documentElement;
            if (rootEl.nodeName.toLowerCase() !== w.schemaManager.getRoot().toLowerCase()) {
                w.dialogManager.show('message', {
                    title: 'Schema Mismatch',
                    msg: 'The wrong schema is specified.<br/>Schema root: '+w.schemaManager.getRoot()+'<br/>Document root: '+rootEl.nodeName+'<br/><br/>Go to <b>Settings</b> to change the schema association.',
                    type: 'error'
                });
            }
            var msg;
            if (w.mode === w.XML) {
                msg = '<b>XML only</b><br/>Only XML tags and no RDF/Semantic Web annotations will be created.';
            } else {
                if (w.allowOverlap) {
                    msg = '<b>XML and RDF (overlap)</b><br/>XML tags and RDF/Semantic Web annotations equivalent to the XML tags will be created, to the extent that the hierarchy of the XML schema allows. Annotations that overlap will be created in RDF only, with no equivalent XML tags.';
                } else {
                    msg = '<b>XML and RDF (no overlap)</b><br/>XML tags and RDF/Semantic Web annotations equivalent to the XML tags will be created, consistent with the hierarchy of the XML schema, so annotations will not be allowed to overlap.';
                }
            }
            w.dialogManager.show('message', {
                title: 'CWRC-Writer Mode',
                msg: msg,
                type: 'info'
            });
        }
    }

    return xml2cwrc;
}

module.exports = XML2CWRC;