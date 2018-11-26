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
                    // Search the known schemas, if the url matches it must be the same one.
                    $.each(w.schemaManager.schemas, function(id, schema) {
                        var aliases = schema.aliases || [];
                        if (schemaUrl == schema.url || $.inArray(schemaUrl, aliases) !== -1) {
                            schemaId = id;
                            return false;
                        }
                    });
                } else if (node.nodeName === 'xml-stylesheet') {
                    var xmlStylesheetData = node.data;
                    cssUrl = xmlStylesheetData.match(/href="([^"]*)"/)[1];
                }
            }
        }

        if (cssUrl !== undefined) {
            loadSchemaCss = false;
            w.schemaManager.loadSchemaCSS(cssUrl);
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
                        if (schemaUrl !== undefined) {
                            var customSchemaId = w.schemaManager.addSchema({
                                name: 'Custom Schema',
                                url: schemaUrl,
                                cssUrl: cssUrl
                            });
                            w.schemaManager.loadSchema(customSchemaId, false, cssUrl !== undefined, function(success) {
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
        var hasOldRdfParent = $(doc).find(w.schemaManager.mapper.getRdfParentSelector(true)).length === 0;
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

            w.annotationsManager.setAnnotations($rdfs);

            $rdfs.remove();

            var rdfParent = $(doc).find(w.schemaManager.mapper.getRdfParentSelector(true));
            var currNode = rdfParent[0].nodeName;
            // remove all the nodes between the root or header and the rdf parent (including the rdf parent)
            while (currNode !== w.schemaManager.getHeader() && currNode !== w.schemaManager.getRoot()) {
                rdfParent = rdfParent.parent();
                rdfParent.children(currNode).remove();
                currNode = rdfParent[0].nodeName;
            }
        } else {
            w.mode = w.XMLRDF;
            w.allowOverlap = false;
            processEntities($(doc.documentElement));
        }

        // TODO add flag
        autoConvertEntityTags(doc);

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
     * Recursively builds offset info from entity tags.
     */
    function processEntities(parent) {
        var annotationAttr = w.schemaManager.mapper.getAnnotationAttributeName();
        if (xml2cwrc.isLegacyDocument) {
            annotationAttr = 'annotationId';
        }
        parent.contents().each(function(index, element) {
            if (this.nodeType !== Node.TEXT_NODE) {
                var node = $(this);
                var id = node.attr(annotationAttr);
                if (id != null && node.parents('['+annotationAttr+'='+id+']').length === 0) { // don't try to process tags related to parent entity
                    var entityType = processEntity(this);
                    if (entityType !== 'note' && entityType !== 'citation') {
                        // TODO test handling for entities inside correction and keyword
                        processEntities(node);
                    }
                } else {
                    processEntities(node);
                }
            }
        });
    }

    /**
     * Scan document for entities that could be converted
     */
    function autoConvertEntityTags(doc) {
        var entityTagNames = [];
        var typesToConvert = ['link'];
        
        var entityMappings = w.schemaManager.mapper.getMappings().entities;
        for (var type in entityMappings) {
            if (typesToConvert.length == 0 || typesToConvert.indexOf(type) != -1) {
                var parentTag = entityMappings[type].parentTag;
                if ($.isArray(parentTag)) {
                    entityTagNames = entityTagNames.concat(parentTag);
                } else if (parentTag !== '') {
                    entityTagNames.push(parentTag);
                }
            }
        }

        var potentialEntities = $(entityTagNames.join(','), doc);
        potentialEntities.each(function(index, el) {
            if (el.getAttribute('_entity') == null) {
                processEntity(el);
            }
        });
    }

    /**
     * Process the tag of an entity, and creates a new entry in the manager.
     * @param {Element} el The XML element
     * @returns {String} entityType
     */
    function processEntity(el) {
        var node = $(el);
        var id = w.getUniqueId('ent_');

        var structId = w.getUniqueId('struct_');
        node.attr('cwrcStructId', structId);

        var entityType = w.schemaManager.mapper.getEntityTypeForTag(el);

        if (entityType !== null) {
            var info = w.schemaManager.mapper.getReverseMapping(el, entityType);

            var annotationAttributeName = w.schemaManager.mapper.getAnnotationAttributeName();

            var config = {
                id: id,
                type: entityType,
                attributes: info.attributes,
                customValues: info.customValues,
                noteContent: info.noteContent,
                cwrcLookupInfo: info.cwrcInfo,
                range: {
                    id: id,
                    annotationAttributeName: annotationAttributeName,
                    parentStart: structId
                }
            };
            if (info.properties !== undefined) {
                for (var key in info.properties) {
                    config[key] = info.properties[key];
                }
            }

            var entity = w.entitiesManager.addEntity(config);
            
            if (w.schemaManager.mapper.isEntityTypeNote(entityType)) {
                node.contents().remove();
            }
        }

        return entityType;
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

        var annotationAttr = w.schemaManager.mapper.getAnnotationAttributeName();

        function doBuild(currentNode, forceInline) {
            var tag = currentNode.nodeName;
            var $node = $(currentNode);

            // TODO ensure that block level elements aren't inside inline level elements, the inline parent will be removed by the browser
            // temp fix: force inline level for children if parent is inline

            var isEntity = (xml2cwrc.isLegacyDocument ? $node.attr('annotationId') : $node.attr(annotationAttr)) != null; // temp entity tag needs to be inline, otherwise spaces around entity text will disappear
            var tagName;
            if (forceInline) {
                tagName = 'span';
            } else {
                tagName = w.utilities.getTagForEditor(tag);
            }

            editorString += '<'+tagName+' _tag="'+tag+'"';

            // create structs entries while we build the string

            // determine the ID
            // first check our special cwrcStructId attribute, finally generate a new one
            var id = $node.attr('id');
            if (id !== undefined) {
                if (window.console) {
                    console.warn('Node already had ID!', id);
                }
                $node.removeAttr('id');
            }
            id = $node.attr('cwrcStructId');
            $node.removeAttr('cwrcStructId');
            if (id === undefined) {
                id = w.getUniqueId('struct_');
            }
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

                // replace legacy id with proper id
                if (xml2cwrc.isLegacyDocument && attName === 'annotationId') {
                    attName = annotationAttr;
                }

                var attValue = w.utilities.convertTextForExport(att.value);

                if (xml2cwrc.reservedAttributes[attName] !== true) {
                    editorString += ' '+attName+'="'+attValue+'"';
                }

                // TODO account for offsetId
                if (attName !== annotationAttr && attName !== 'offsetId') {
                    w.structs[id][attName] = attValue;
                }
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

        var annotationAttr = w.schemaManager.mapper.getAnnotationAttributeName();
        if (xml2cwrc.isLegacyDocument) {
            annotationAttr = 'annotationId';
        }

        var entityNodes = []; // keep track of the nodes so we can remove them afterwards

        var body = w.editor.getBody();
        // insert entities
        // TODO handling for recursive entities (notes, citations)
        var entry, range, parent, contents, lengthCount, match, matchingNode, startOffset, endOffset, startNode, endNode;
        w.entitiesManager.eachEntity(function(id, entry) {
            matchingNode = null;
            startNode = null;
            endNode = null;
            startOffset = 0;
            endOffset = 0;

            range = entry.getRange();

            // just rdf, no markup
            if (range.parentEnd) {
                var parent = $('#'+range.parentStart, body);
                var result = getTextNodeFromParentAndOffset(parent, range.startOffset);
                startNode = result.textNode;
                startOffset = result.offset;
                parent = $('#'+range.parentEnd, body);
                result = getTextNodeFromParentAndOffset(parent, range.endOffset);
                endNode = result.textNode;
                endOffset = result.offset;
            // markup
            } else if (range.parentStart) {
                var entityNode = $('#'+range.parentStart, body);
                startNode = entityNode[0];
                endNode = entityNode[0];

                entityNodes.push({entity: entry, node: entityNode});
            }

            if (startNode != null && endNode != null) {
                var type = entry.getType();
                try {
                    if (startNode != endNode) {
                        var range = w.editor.selection.getRng(true);
                        range.setStart(startNode, startOffset);
                        range.setEnd(endNode, endOffset);
                        w.tagger.insertBoundaryTags(id, type, range, entry.getTag());
                    } else {
                        // then tag already exists
                        $(startNode).attr({
                            '_entity': true,
                            '_type': type,
                            'class': 'entity start end '+type,
                            'name': id,
                            'id': id
                        });
                    }
                    if (entry.getContent() === undefined) {
                        // get and set the text content
                        // TODO remove schema specific properties
                        var content = '';
                        if (type === 'note' || type === 'citation') {
                            content = $($.parseXML(entry.getNoteContent())).text();
                        } else if (type === 'keyword') {
                            content = entry.getCustomValues().keywords.join(', ');
                        } else if (type === 'correction') {
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
                    if (window.console) {
                        console.warn(e);
                    }
                }
            }
        });

        // remove all the entity markup
        $.each(entityNodes, function(index, info) {
            var entity = info.entity;
            var $node = info.node;

            var type = entity.getType();
            //    var tag = $(node).attr('_tag');
            //    var type = w.schemaManager.mapper.getEntityTypeForTag(node);

            var textTagName = w.schemaManager.mapper.getTextTag(type);
            if (textTagName !== '') {
                var selector;
                if ($.isArray(textTagName)) {
                    selector = '';
                    $.each(textTagName, function(i, tag) {
                        selector += '[_tag="'+tag+'"]';
                        if (i < textTagName.length - 1) {
                            selector += ',';
                        }
                    });
                } else {
                    selector = '[_tag="'+textTagName+'"]';
                }
                var textTag = $(selector, $node).first();
                if (type === 'correction') {
                    entity.getCustomValues().sicText = textTag.text();
                }
                textTag.contents().unwrap(); // keep the text inside the textTag
            }

            var annotationId = $node.attr(annotationAttr);
            $('['+annotationAttr+'="'+annotationId+'"]', $node).remove(); // remove all child elements with matching ID

            var id = $node.attr('id');
            if (w.structs[id] !== undefined) {
                delete w.structs[id];
            }

            /*
            var contents = $node.contents();
            if (contents.length === 0) {
                // no contents so just remove the node
                $node.remove();
            } else {
                contents.unwrap();
            }
            */
        });

        // remove annotationId and offsetId
        $('['+annotationAttr+']', body).each(function(index, el) {
            $(el).removeAttr(annotationAttr);
        });
        $('[offsetId]', body).each(function(index, el) {
            $(el).removeAttr('offsetId');
        });
    }

    function getTextNodeFromParentAndOffset(parent, offset) {
        var currentOffset = 0;
        var textNode = null;

        function getTextNode(parent) {
            var ret = true;
            parent.contents().each(function(index, element) {
                var el = $(this);
                // Not sure why the &nbsp; text nodes would not be counted but as long
                // as we are consistent in both the saving and loading it should be
                // fine.
                if (this.nodeType === Node.TEXT_NODE && this.data !== ' ') {
                    // Count all the text!
                    currentOffset += this.length;
                    if (currentOffset >= offset) {
                        currentOffset = offset - (currentOffset - this.length);
                        textNode = this;
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
                    ret = getTextNode(el);
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