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
     * @param doc An XML DOM
     * @param [schemaIdOverride] The (optional) schemaId to use (overrides document schema)
     */
    xml2cwrc.processDocument = function(doc, schemaIdOverride) {
        w.event('processingDocument').publish();
        
        // clear current doc
        w.editor.setContent('', {format: 'raw'});
        var schemaId = schemaIdOverride;
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
                    schemaUrl = schemaUrl.split(/^.*?\/\//)[1]; // remove the protocol in order to disregard http/https
                    // Search the known schemas, if the url matches it must be the same one.
                    $.each(w.schemaManager.schemas, function(id, schema) {
                        if (schema.url.indexOf(schemaUrl) !== -1) {
                            schemaId = id;
                            return false;
                        }
                        if (schema.aliases !== undefined) {
                            $.each(schema.aliases, function(index, alias) {
                                if (alias.indexOf(schemaUrl) !== -1) {
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
                                    doProcessing(doc);
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
                        doProcessing(doc);
                    } else {
                        doBasicProcessing(doc);
                    }
                });
            } else {
                doProcessing(doc);
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

    function doProcessing(doc) {
        // reset the stores
        w.entitiesManager.reset();
        w.structs = {};
        w.triples = [];
        w.deletedEntities = {};
        w.deletedStructs = {};

        xml2cwrc.isLegacyDocument = isLegacyDocument(doc);

        var rootEl = doc.documentElement;

        var $rdfs = $(doc).find('rdf\\:RDF, RDF');

        var overlapSetFromHeader = false;
        // process RDF and/or entities
        if ($rdfs.length) {
            var mode = parseInt($rdfs.find('cw\\:mode, mode').first().text());
            if (mode === w.XML) {
                w.mode = w.XML;
            } else {
                w.mode = w.XMLRDF;
            }

            var allowOverlap = $rdfs.find('cw\\:allowOverlap, allowOverlap').first().text();
            w.allowOverlap = allowOverlap === 'true';
            overlapSetFromHeader = true;

            w.annotationsManager.setAnnotations($rdfs, xml2cwrc.isLegacyDocument);

            $rdfs.remove();

            var rdfParent = $(w.utilities.evaluateXPath(doc, w.schemaManager.mapper.getRdfParentSelector()));
            if (rdfParent.length === 1) {
                var currNode = rdfParent[0].nodeName;
                // remove all the nodes between the root or header and the rdf parent (including the rdf parent)
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
        } else {
            w.mode = w.XMLRDF;
            w.allowOverlap = false;
            autoConvertEntityTags(doc);
        }

        // TODO add flag
        autoConvertEntityTags(doc, ['link']);

        // additional entity processing:
        // - remove mapping related elements
        w.entitiesManager.eachEntity(function(entityId, entity) {
            var range = entity.getRange();
            if (range.endXPath === undefined) {
                var node = w.utilities.evaluateXPath(doc, range.startXPath);
                if (node !== null) {
                    var $node = $(node);
                    if (entity.isNote()) {
                    } else {
                        var textTag = w.schemaManager.mapper.getTextTag(entity.getType());
                        if (textTag !== '') {
                            $node.find(textTag).contents().unwrap();
                        }
                        $node.find(':not(:text)').remove();
                    }
                }
            }
        });

        var editorString = xml2cwrc.buildEditorString(rootEl, !w.isReadOnly);
        w.editor.setContent(editorString, {format: 'raw'}); // format is raw to prevent html parser and serializer from messing up whitespace

        insertEntities();
        if (!overlapSetFromHeader) {
            var isOverlapping = w.utilities.doEntitiesOverlap();
            if (isOverlapping) {
                w.allowOverlap = true;
            } else {
                w.allowOverlap = false;
            }
        }

        // clean up leftover w.structs entries removed during entity insertion
        w.tagger.findNewAndDeletedTags();

        w.event('documentLoaded').publish(true, w.editor.getBody());
        
        var msgObj = {};
        if (w.isReadOnly !== true) {
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

    // Needs to be public, to be able to process documents after the schema
    // changes.
    // TODO is this still required???
    xml2cwrc.doProcessing = doProcessing;

    /**
     * Scan document for entities that could be converted
     * @param {Document} doc The document
     * @param {Array} [typesToConvert] An array of entity types to convert, defaults to all types
     */
    function autoConvertEntityTags(doc, typesToConvert) {
        var potentialEntities = xml2cwrc.findEntities(doc, typesToConvert);
        potentialEntities.each(function(index, el) {
            if (el.getAttribute('_entity') == null) {
                processEntity(el);
            }
        });
    }

    /**
     * Look for potential entities inside the passed element
     * @param {Document|Element} el
     * @param {Array} [typesToFind] An array of entity types to find, defaults to all types
     * @returns {jQuery} An array of elements
     */
    xml2cwrc.findEntities = function(el, typesToFind) {
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

        var potentialEntities = $(entityTagNames.join(','), el);
        return potentialEntities;
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

        var info = w.schemaManager.mapper.getReverseMapping(el, entityType);

        var config = {
            type: entityType,
            attributes: info.attributes,
            customValues: info.customValues,
            noteContent: info.noteContent,
            cwrcLookupInfo: info.cwrcInfo
        };
        if (info.properties !== undefined) {
            for (var key in info.properties) {
                config[key] = info.properties[key];
            }
        }

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

        doBuild(node, false);
        return editorString;
    };

    function insertEntities() {
        // editor needs focus in order for entities to be properly inserted
        w.editor.focus();

        var body = w.editor.getBody();
        var doc = w.editor.getDoc();
        
        // insert entities
        w.entitiesManager.eachEntity(function(id, entry) {
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
                            'name': id,
                            'id': id
                        });

                        if (entry.isNote()) {
                            w.tagger.addNoteWrapper(startNode, type);
                            entry.setContent($(startNode).text());
                            entry.setNoteContent($(startNode).html());
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
                            w.entitiesManager.highlightEntity(id);
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
        });

        if (xml2cwrc.isLegacyDocument) {
            // remove annotationId and offsetId
            $('[annotationId]', body).each(function(index, el) {
                $(el).removeAttr(annotationAttr);
            });
            $('[offsetId]', body).each(function(index, el) {
                $(el).removeAttr('offsetId');
            });
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

    return xml2cwrc;
}

module.exports = XML2CWRC;