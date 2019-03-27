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
        'id': true,
        'name': true,
        'class': true
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

        var schemaId = undefined;
        var schemaUrl;
        var cssUrl;
        var loadSchemaCss = true; // whether to load schema css

        if (schemaId === undefined) {
            // grab the schema (and css) from xml-model
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
        }

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
                            loadSchemaCss = false;
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
                    loadSchemaCss = false;
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
    };

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
        w.structs = {};
        w.triples = [];
        w.deletedEntities = {};
        w.deletedStructs = {};
        
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
        w.structs = {};
        w.triples = [];
        w.deletedEntities = {};
        w.deletedStructs = {};

        xml2cwrc.isLegacyDocument = isLegacyDocument(doc);

        var hadRDF = processRDF(doc);

        if (convertEntities) {
            var typesToFind = undefined;
            if (hadRDF) {
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
            console.log('finishProcessing');
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
            w.annotationsManager.setAnnotations($rdfs, xml2cwrc.isLegacyDocument);

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
     * Removes extraneous entity mapping elements.
     * @param {Document} doc 
     */
    function cleanupEntities(doc) {
        var li = w.dialogManager.getDialog('loadingindicator');
        li.setText('Processing Entities');

        var entObj = w.entitiesManager.getEntities();
        var entities = Object.keys(entObj).map(function(key) {
            return entObj[key]
        });

        return processArray(entities, function(entity) {
            var range = entity.getRange();
            if (range.endXPath === undefined) {
                var node = w.utilities.evaluateXPath(doc, range.startXPath);
                if (node !== null) {
                    var $node = $(node);
                    if (entity.isNote()) { // this prevents tei keyword from being processed appropriately (seg/term)
                    } else {
                        // TODO review this textTag stuff
                        var textTag = w.schemaManager.mapper.getTextTag(entity.getType());
                        if (textTag !== '') {
                            $node.find(textTag).contents().unwrap();
                        }
                        $node.find(':not(:text)').remove();
                    }
                }
            }
        }, 250);
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
        typesToFind = typesToFind === undefined ? ['person', 'place', 'date', 'org', 'citation', 'note', 'title', 'correction', 'keyword', 'link'] : typesToFind;
        
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
            
            config.id = w.getUniqueId('ent_');
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

        var config = {
            type: entityType,
            isNote: isNote,
            attributes: info.attributes,
            customValues: info.customValues,
            noteContent: info.noteContent,
            cwrcLookupInfo: info.cwrcInfo
        };
        $.extend(config, info.properties);

        return config;
    }

    /**
     * Takes a document node and returns a string representation of its
     * contents, compatible with the editor. Additionally creates w.structs
     * entries.
     *
     * @param {Element} node An (X)HTML element
     * @param {Boolean} [includeComments] True to include comments in the output
     * @returns {String}
     */
    xml2cwrc.buildEditorString = function(node, includeComments) {
        var dfd = new $.Deferred();

        var li = w.dialogManager.getDialog('loadingindicator');
        li.setText('Building Document');

        includeComments === undefined ? false : includeComments;

        var editorString = '';

        function doBuild(currentNode, forceInline) {
            var tag = currentNode.nodeName;
            var $node = $(currentNode);

            // TODO ensure that block level elements aren't inside inline level elements, the inline parent will be removed by the browser
            // temp fix: force inline level for children if parent is inline

            var tagName;
            if (forceInline) {
                tagName = 'span';
            } else {
                tagName = w.utilities.getTagForEditor(tag);
            }

            editorString += '<'+tagName+' _tag="'+tag+'"';

            // create structs entries while we build the string

            if ($node.attr('id') !== undefined) {
                console.warn('xml2cwrc.buildEditorString: node already had an ID!', id);
                $node.removeAttr('id');
            }
            var id = w.getUniqueId('struct_');
            editorString += ' id="'+id+'"';

            var idNum = parseInt(id.split('_')[1], 10);
            if (idNum >= tinymce.DOM.counter) tinymce.DOM.counter = idNum+1;

            var canContainText = w.utilities.canTagContainText(tag);
            // TODO find non-intensive way to check if tags can possess attributes
            editorString += ' _textallowed="'+canContainText+'"';

            w.structs[id] = {
                id: id,
                _tag: tag,
                _textallowed: canContainText
            };

            $(currentNode.attributes).each(function(index, att) {
                var attName = att.name;

                // don't include legacy attributes
                if (xml2cwrc.isLegacyDocument && attName === 'annotationId' || attName === 'offsetId') {
                    return true;
                }

                var attValue = w.utilities.convertTextForExport(att.value);

                if (xml2cwrc.reservedAttributes[attName] !== true) {
                    editorString += ' '+attName+'="'+attValue+'"';
                }

                w.structs[id][attName] = attValue;
            });

            if ($node.is(':empty')) {
                editorString += '>\uFEFF</'+tagName+'>'; // need \uFEFF otherwise a <br> gets inserted
            } else {
                editorString += '>';
                
                if (currentNode.nodeType === Node.COMMENT_NODE) {
                    var stringContents = currentNode.data.replace(/</g, '&lt;').replace(/>/g, '&gt;'); // prevent tags from accidentally being created
                    editorString += stringContents;
                } else {
                    var isInline = forceInline || !w.utilities.isTagBlockLevel(tag);
                    $node.contents().each(function(index, el) {
                        if (el.nodeType === Node.ELEMENT_NODE || (includeComments && el.nodeType === Node.COMMENT_NODE)) {
                            doBuild(el, isInline);
                        } else if (el.nodeType === Node.TEXT_NODE) {
                            var stringContents = el.data.replace(/</g, '&lt;').replace(/>/g, '&gt;'); // prevent tags from accidentally being created
                            editorString += stringContents;
                        }
                    });
                }

                editorString += '</'+tagName+'>';
            }
        }

        setTimeout(function() {
            doBuild(node, false);
            dfd.resolve(editorString);
        }, 0);
        
        return dfd.promise();
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

    function buildEditorStringDeferred(parentNode) {
        var dfd = new $.Deferred();

        var li = w.dialogManager.getDialog('loadingindicator');
        li.setText('Building Document');
        
        var editorString = '';
        var closingStack = [];
        var nodeArray = getNodeArray(parentNode);

        var processNode = function(nodeData, prevDepth) {
            var node = nodeData.node;
            var depth = nodeData.depth;

            var openingTagString = '';
            var closingTag = {string: '', depth: depth};

            if (node.nodeType === Node.ELEMENT_NODE) {
                var nodeName = node.nodeName;
                var htmlTag = w.utilities.getTagForEditor(nodeName);

                openingTagString += '<'+htmlTag+' _tag="'+nodeName+'"';
                closingTag.string = '</'+htmlTag+'>';
                
                if (node.childNodes.length === 0) {
                    closingTag.string = '\uFEFF'+closingTag.string;
                }

                if (node.hasAttribute('id')) {
                    console.warn('xml2cwrc.buildEditorString: node already had an ID!', node.getAttribute('id'));
                    node.removeAttribute('id');
                }
                var id = w.getUniqueId('struct_');
                openingTagString += ' id="'+id+'"';
                
                var canContainText = w.utilities.canTagContainText(nodeName);
                openingTagString += ' _textallowed="'+canContainText+'"';

                w.structs[id] = {
                    id: id,
                    _tag: nodeName,
                    _textallowed: canContainText
                };

                if (node.hasAttributes()) {
                    var attrs = node.attributes;
                    for (var i = 0; i < attrs.length; i++) {
                        var attName = attrs[i].name;
                        var attValue = attrs[i].value;

                        if (xml2cwrc.isLegacyDocument && attName === 'annotationId' || attName === 'offsetId') {
                            continue;
                        }
                        if (xml2cwrc.reservedAttributes[attName] === true) {
                            continue;
                        }

                        openingTagString += ' '+attName+'="'+attValue+'"';
                        w.structs[id][attName] = attValue;
                    }
                }

                openingTagString += '>';
            } else if (node.nodeType === Node.TEXT_NODE) {
                var content = node.data.replace(/</g, '&lt;').replace(/>/g, '&gt;'); // prevent tags from accidentally being created
                openingTagString = content;
            } else {
                console.warn('xml2cwrc.buildEditorString: unsupported node type:', node.nodeType);
            }
            
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

        cleanupEntities(doc)
        .then(function() {
            return buildEditorStringDeferred(doc.documentElement);
        })
        .then(function(editorString) {
            w.editor.setContent(editorString, {format: 'raw'}); // format is raw to prevent html parser and serializer from messing up whitespace

            return insertEntities();
        })
        .then(function() {
            if (w.utilities.doEntitiesOverlap()) {
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

            var body = w.editor.getBody();
            var doc = w.editor.getDoc();
            
            // insert entities
            var insertEntity = function(entry) {
                var startNode = null;
                var endNode = null;
                var startOffset = 0;
                var endOffset = 0;

                var range = entry.getRange();

                // just rdf, no markup
                if (range.endXPath) {
                    var parent = w.utilities.evaluateXPath(doc, range.startXPath);
                    var result = getTextNodeFromParentAndOffset(parent, range.startOffset);
                    startNode = result.textNode;
                    startOffset = result.offset;
                    parent = w.utilities.evaluateXPath(doc, range.endXPath);
                    result = getTextNodeFromParentAndOffset(parent, range.endOffset);
                    endNode = result.textNode;
                    endOffset = result.offset;
                // markup
                } else if (range.startXPath) {
                    var entityNode = w.utilities.evaluateXPath(doc, range.startXPath);
                    startNode = entityNode;
                    endNode = entityNode;
                }

                if (startNode != null && endNode != null) {
                    var type = entry.getType();
                    try {
                        if (startNode != endNode) {
                            var range = w.editor.selection.getRng(true);
                            range.setStart(startNode, startOffset);
                            range.setEnd(endNode, endOffset);
                            w.tagger.addEntityTag(entry, range);
                        } else {
                            // then tag already exists
                            $(startNode).attr({
                                '_entity': true,
                                '_type': type,
                                'class': 'entity start end '+type,
                                'name': entry.getId(),
                                'id': entry.getId()
                            });

                            if (entry.isNote()) {
                                entry.setContent($(startNode).text());
                                entry.setNoteContent($(startNode).html());
                                w.tagger.addNoteWrapper(startNode, type);
                            }
                        }
                        if (entry.getContent() === undefined) {
                            // get and set the text content
                            // TODO remove schema specific properties
                            var content = '';
                            if (type === 'correction') {
                                content = entry.getCustomValues().corrText;
                            } else {
                                w.entitiesManager.highlightEntity(); // remove highlight
                                w.entitiesManager.highlightEntity(entry.getId());
                                content = $('.entityHighlight', body).text();
                                w.entitiesManager.highlightEntity();
                            }
                            entry.setContent(content);

                            // finish with triples
                            for (var i = 0; i < w.triples.length; i++) {
                                var trip = w.triples[i];
                                if (trip.subject.uri === entry.getUris().annotationId) {
                                    trip.subject.text = entry.getTitle();
                                }
                                if (trip.object.uri === entry.getUris().annotationId) {
                                    trip.object.text = entry.getTitle();
                                }
                            }
                        }
                    } catch (e) {
                        console.warn(e);
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
            } else if (w.isEmbedded !== true) {
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
    }

    return xml2cwrc;
}

module.exports = XML2CWRC;