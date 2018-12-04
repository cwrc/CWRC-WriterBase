'use strict';

var $ = require('jquery');

/**
 * @class CWRC2XML
 * @param {Writer} writer
 */
function CWRC2XML(writer) {
    var w = writer;

    /**
     * @lends CWRC2XML.prototype
     */
    var cwrc2xml = {};

    /**
     * Gets the content of the document, converted from internal format to the schema format
     * @param {boolean} includeRDF True to include RDF in the header
     * @returns {String}
     */
    cwrc2xml.getDocumentContent = function(includeRDF) {
        // remove highlights
        w.entitiesManager.highlightEntity();

        var $body = $(w.editor.getBody()).clone(false);
        prepareText($body);
        
        // RDF
        
        var rdfString = '';
        if (w.mode === w.RDF || (w.mode === w.XMLRDF && includeRDF)) {
            var rdfmode;
            if (w.annotationMode === w.XML) {
                rdfmode = 'xml';
            } else {
                rdfmode = 'json';
            }
            rdfString = '\n'+w.annotationsManager.getAnnotations(rdfmode);
        }
        if (w.mode === w.RDF) {
            return rdfString;
        }
        
        // XML
        
        var root = w.schemaManager.getRoot();
        var $rootEl = $body.children('[_tag='+root+']');
        
        if ($rootEl.length == 0) {
            if (window.console) {
                console.warn('converter: no root found for', root);
            }
            $rootEl = $body.find('[_tag]:eq(0)'); // fallback
        }
        
        // make sure the root has the right namespaces for validation purposes
        var struct = w.structs[$rootEl.attr('id')];
        // add them to the structs entry and they'll get added to the markup later
        struct['xmlns:cw'] = 'http://cwrc.ca/ns/cw#';
        if (root === 'TEI') {
            struct['xmlns'] = 'http://www.tei-c.org/ns/1.0';
        }
        if (includeRDF) {
            struct['xmlns:rdf'] = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
        } else {
            delete struct['xmlns:rdf'];
        }

        var xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlString += '<?xml-model href="'+w.schemaManager.getCurrentSchema().url+'" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>\n';
        var currentCSS = w.schemaManager.getCSS() || w.schemaManager.getCurrentSchema().cssUrl;
        xmlString += '<?xml-stylesheet type="text/css" href="'+currentCSS+'"?>\n';

        if (includeRDF) {
            // parse the selector and find the relevant node
            var selector = w.schemaManager.mapper.getRdfParentSelector();
            var selectorNodes = selector.split('/');
            var currNode = $body;
            for (var i = 0; i < selectorNodes.length; i++) {
                var node = selectorNodes[i];
                if (node !== '') {
                    if (node.indexOf('::') === -1) {
                        var jquerySelector = '[_tag='+node+']';
                        if (node === '*') {
                            jquerySelector = '[_tag]';
                        }
                        var nextNode = currNode.children(jquerySelector).first();
                        if (nextNode.length === 1) {
                            currNode = nextNode;
                        } else {
                            // node doesn't exist so add it
                            currNode = $('<div _tag="'+node+'" />').appendTo(currNode.parent());
                        }
                    } else {
                        // axis handling
                        var parts = node.split('::');
                        var axis = parts[0];
                        node = parts[1];
                        switch(axis) {
                            case 'preceding-sibling':
                                currNode = $('<div _tag="'+node+'" />').insertBefore(currNode);
                                break;
                            case 'following-sibling':
                                currNode = $('<div _tag="'+node+'" />').insertAfter(currNode);
                                break;
                            default:
                                console.warn('cwrc2xml: axis',axis,'not supported');
                                break;
                        }
                    }
                }
            }

            if (currNode !== $body) { 
                xmlString += cwrc2xml.buildXMLString($rootEl, currNode, rdfString);
            } else {
                if (window.console) {
                    console.warn('cwrc2xml: couldn\'t find rdfParent for',selector);
                }
                xmlString += cwrc2xml.buildXMLString($rootEl);
            }
        } else {
            xmlString += cwrc2xml.buildXMLString($rootEl);
        }
        
        xmlString = xmlString.replace(/\uFEFF/g, ''); // remove characters inserted by node selecting

        return xmlString;
    };

    /**
     * Get the annotations for the current document
     * @param {String} mode 'xml' or 'json'
     * @returns {String} A stringified version, either XML or JSON based on mode param
     */
    cwrc2xml.getAnnotations = function(mode) {
        w.entitiesManager.highlightEntity();

        var body = $(w.editor.getBody()).clone(false);
        prepareText(body);
        
        var rdfString = w.annotationsManager.getAnnotations(mode);
        return rdfString;
    };
    
    /**
     * Prepare text for conversion to XML
     * @param {jQuery} body The text body
     */
    function prepareText(body) {
        _recursiveTextConversion(body);
        setEntityRanges(body);
    };
    
    /**
     * Determine and set the range objects for each entity.
     * Used later to construct the RDF.
     * @param {jQuery} body The text body
     */
    function setEntityRanges(body) {

        // get the overlapping entity IDs, in the order that they appear in the document.
        var overlappingEntNodes = $('[_entity][class~="start"]', body).not('[_tag]').not('[_note]');
        var overlappingEntIds = $.map(overlappingEntNodes, function(val, index) {
            return $(val).attr('name');
        });
        // get ranges for overlapping entities, set offsetIds
        // then remove the associated nodes
        $(overlappingEntIds).each(function(index, id) {
            var entry = w.entitiesManager.getEntity(id);
            var range = getRangesForEntity(id);
            $.extend(entry.getRange(), range);
            $('[name="'+id+'"]', body).each(function(index, el) {
                $(el).contents().unwrap();
            });
        });
        
        // set annotationAttrs for entities
        w.entitiesManager.eachEntity(function(entityId, entry) {
            var entity = $('#'+entityId, w.editor.getBody());
            if (entity.length === 1) {
                var range = {};
                range.startXPath = w.utilities.getElementXPath(entity[0]);
                $.extend(entry.getRange(), range);
            }
        });
    }

    /**
     * Converts the editor node and its contents into an XML string suitable for export.
     * @param {Element} node
     * @param {Element} [rdfParent] The parent of the RDF string
     * @param {String} [rdfString] The RDF string to insert
     * @returns {String}
     */
    cwrc2xml.buildXMLString = function(node, rdfParent, rdfString) {
        var xmlString = '';

        var includeRDF = rdfParent !== undefined && rdfString !== undefined;

        function _nodeToStringArray(currNode) {
            var array = [];
            var id = currNode.attr('id');
            var tag = currNode.attr('_tag');
    
            var structEntry = w.structs[id];
            var entityEntry = w.entitiesManager.getEntity(id);
            if (entityEntry && tag) {
                array = w.schemaManager.mapper.getMapping(entityEntry);
            } else if (tag) {
                if (tag === '#comment') {
                    array = ['<!-- ', ' -->'];
                } else {
                    var openingTag = '<'+tag;
                    for (var key in structEntry) {
                        if (key.indexOf('_') != 0) {
                            var attName = key;
                            var attValue = structEntry[key];
                            if (attName == 'id') {
                                // leave out IDs
        //                        attName = w.schemaManager.getIdName();
                            } else {
        //                        var validVal = w.utilities.convertTextForExport(attValue);
                                openingTag += ' '+attName+'="'+attValue+'"';
                            }
                        }
                    }
                    openingTag += '>';
                    if (includeRDF) {
                        if (currNode[0] === rdfParent[0]) {
                            openingTag += rdfString;
                            includeRDF = false;
                        }
                    }
                    
                    array.push(openingTag);
                    array.push('</'+tag+'>');
                }
            } else {
                // not a valid tag so return empty strings
                array = ['', ''];
            }
    
            return array;
        }

        function doBuild(currentNode) {
            var tags = _nodeToStringArray(currentNode);
            xmlString += tags[0];
            currentNode.contents().each(function(index, el) {
                if (el.nodeType == Node.ELEMENT_NODE) {
                    doBuild($(el));
                } else if (el.nodeType == Node.TEXT_NODE) {
                    xmlString += el.data;
                }
            });
            xmlString += tags[1];
        }

        doBuild($(node));
        return xmlString;
    };

    /**
     * Determines the range that an entity spans, using xpath and character offset.
     * @param {String} entityId The id for the entity
     * @returns {JSON} The range object
     */
    function getRangesForEntity(entityId) {
        var range = {};

        function getOffsetFromParentForEntity(id, parent, isEnd) {
            var offset = 0;

            // Recursive function counts the number of characters in the offset,
            // recurses down overlapping entities and counts their characters as well.
            // Since entity tags are created when a document is loaded we must count
            // the characters inside of them. We can ignore _tag elements though in the
            // count as they will be present when the document is loaded.
            function getOffset(parent) {
                // To allow this function to exit recursion it must be able to return false.
                var ret = true;
                parent.contents().each(function(index, element) {
                    var el = $(this), start, end, finished;
                    if (el.attr('name') === id) {
                        // Some tags are not the start or the end, they are used for
                        // highlighting the entity.
                        start = el.hasClass('start');
                        end = el.hasClass('end');
                        finished = (start && !isEnd) || (end && isEnd);
                        // Always count the content length if looking for the end.
                        if (isEnd) {
                            offset += el.text().length;
                        }
                        if (finished) {
                            ret = false;
                            return ret;
                        }
                    }
                    // Not sure why the &nbsp; text nodes would not be counted but as long
                    // as we are consistent in both the saving and loading it should be
                    // fine.
                    else if (this.nodeType === Node.TEXT_NODE && this.data !== ' ') {
                        // Count all the text!
                        offset += this.length;
                    }
                    // An Tag or an Entity that is not the one we're looking for.
                    else {
                        // We must use all intermediate node's text to ensure an accurate
                        // text count. As the order in which entities are wrapped in spans
                        // when the document is loaded will not be guarantee to be in an
                        // order in which replicates the state the document was in at the
                        // time it was saved.
                        ret = getOffset(el);
                        return ret;
                    }
                });
                return ret;
            }

            getOffset(parent);
            return offset;
        }

        function doRangeGet($el, isEnd) {
            var parent = $el.parents('[_tag]').first();
            var xpath = w.utilities.getElementXPath(parent[0]);
            var offset = getOffsetFromParentForEntity(entityId, parent, isEnd);
            return {xpath: xpath, offset: offset};
        }

        var entitySpans = $('[name="'+entityId+'"]', w.editor.getBody());
        var entityStart = entitySpans.first();
        var entityEnd = entitySpans.last();

        var infoStart = doRangeGet(entityStart, false);
        range.startXPath = infoStart.xpath;
        range.startOffset = infoStart.offset;

        var infoEnd = doRangeGet(entityEnd, true);
        range.endXPath = infoEnd.xpath;
        range.endOffset = infoEnd.offset;

        return range;
    }
    
    // Converts HTML entities to unicode, while preserving those that must be escaped as entities.
    function _recursiveTextConversion(parentNode) {
        var contents = $(parentNode).contents();
        contents.each(function(index, el) {
            if (el.nodeType == Node.TEXT_NODE) {
                el.nodeValue = w.utilities.convertTextForExport(el.nodeValue);
            } else if (el.nodeType == Node.ELEMENT_NODE) {
                _recursiveTextConversion(el);
            }
        });
    };

    /**
     * For debug
     */
    cwrc2xml.getEntityOffsets = function() {
        var body = $(w.editor.getBody());
        var offsets = _getNodeOffsetsFromParent(body);
        var ents = [];
        for (var i = 0; i < offsets.length; i++) {
            var o = offsets[i];
            if (o.entity) {
                ents.push(o);
            }
        }
        return ents;
    };

    /**
     * Get character offsets for a node.
     * @param {Node} parent The node to start calculating offsets from.
     * @returns Array
     */
    function _getNodeOffsetsFromParent(parent) {
        var currentOffset = 0;
        var offsets = [];
        function getOffsets(parent) {
            parent.contents().each(function(index, element) {
                var el = $(this);
                if (this.nodeType == Node.TEXT_NODE && this.data != ' ') {
                    currentOffset += this.length;
                } else {
                    if (el.attr('_tag')) {
                        var id = el.attr('id');
                        offsets.push({
                            id: id,
                            offset: currentOffset,
                            length: el.text().length,
                            entity: el.attr('_entity') !== undefined
                        });
                        getOffsets(el);
                    } else if (el.attr('_entity') && el.hasClass('start')) {
                        var id = el.attr('name');
                        offsets.push({
                            id: id,
                            offset: currentOffset,
                            length: w.entitiesManager.getEntity(id).getContent().length,
                            entity: true
                        });
                    }
                }
            });
        }

        getOffsets(parent);
        return offsets;
    };

    function _determineOffsetRelationships(offsets) {
        var relationships = {};
        var entityOffsets = [];
        for (var i = 0; i < offsets.length; i++) {
            var o = offsets[i];
            if (o.entity) {
                entityOffsets.push(o);
                relationships[o.id] = {
                    contains: [],
                    overlaps: []
                };
            }
        }

        var ol = entityOffsets.length;
        for (var i = 0; i < ol; i++) {
            var o1 = entityOffsets[i];
            var span1 = o1.offset + o1.length;
            var r = relationships[o1.id];
            for (var j = 0; j < ol; j++) {
                var o2 = entityOffsets[j];
                var span2 = o2.offset + o2.length;
                if (o1.offset < o2.offset && span1 > span2) {
                    r.contains.push(o2.id);
                } else if (o1.offset < o2.offset && span1 > o2.offset && span1 < span2) {
                    r.overlaps.push(o2.id);
                } else if (o1.offset > o2.offset && span1 > span2 && span2 > o1.offset) {
                    r.overlaps.push(o2.id);
                } else if (o1.offset < o2.offset && span1 < span2 && span1 > o2.offset) {
                    r.overlaps.push(o2.id);
                }
            }
        }

        return relationships;
    };

    return cwrc2xml;
}

module.exports = CWRC2XML;