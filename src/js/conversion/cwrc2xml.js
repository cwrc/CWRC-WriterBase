'use strict';

var $ = require('jquery');
var Entity = require('./../entities/entity');

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
     * @param {Function} callback Callback is called with the stringified document contents
     */
    cwrc2xml.getDocumentContent = async function(includeRDF, callback) {
        if (includeRDF && w.mode === w.XML) {
            includeRDF = false;
        }
        
        // remove highlights
        w.entitiesManager.highlightEntity();

        var $body = $(w.editor.getBody()).clone(false);
        prepareText($body);

        // XML
        
        var root = w.schemaManager.getRoot();
        var $rootEl = $body.children('[_tag='+root+']');
        
        if ($rootEl.length == 0) {
            console.warn('converter: no root found for', root);
            $rootEl = $body.find('[_tag]:eq(0)'); // fallback
        }
        
        // remove previous namespaces
        var rootAttributes = w.tagger.getAttributesForTag($rootEl[0]);
        for (var attributeName in rootAttributes) {
            if (attributeName.indexOf('xmlns') === 0) {
                delete rootAttributes[attributeName];
            }
        };
        
        // namespaces
        var schemaNamespace = w.schemaManager.mapper.getNamespace();
        if (schemaNamespace !== undefined) {
            rootAttributes['xmlns'] = schemaNamespace;
        }
        if (includeRDF) {
            rootAttributes['xmlns:rdf'] = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
        }
        w.tagger.setAttributesForTag($rootEl[0], rootAttributes);

        var xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlString += '<?xml-model href="'+w.schemaManager.getCurrentDocumentSchemaUrl()+'" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>\n';
        xmlString += '<?xml-stylesheet type="text/css" href="'+w.schemaManager.getCurrentDocumentCSSUrl()+'"?>\n';

        console.time('buildXMLString');
        xmlString += cwrc2xml.buildXMLString($rootEl, includeRDF);
        console.timeEnd('buildXMLString');

        xmlString = xmlString.replace(/&(?!amp;)/g, '&amp;');  //replace all '&' with '&amp;' allowing html/xml to validate.

        // RDF

        if (includeRDF) {
            console.time('stringToXML');
            var xmlDoc = w.utilities.stringToXML(xmlString);
            console.timeEnd('stringToXML');
            if (xmlDoc === null) {
                // parse error in document
            } else {
                console.time('setEntityRanges');
                setEntityRanges(xmlDoc);
                console.timeEnd('setEntityRanges');

                console.time('cleanUp');
                // clean up temp ids used by setEntityRanges
                $('[cwrcTempId]', xmlDoc).each(function(index, el) {
                    $(el).removeAttr('cwrcTempId');
                });
                console.timeEnd('cleanUp');

                var rdfmode;
                if (w.annotationMode === w.XML) {
                    rdfmode = 'xml';
                } else {
                    rdfmode = 'json';
                }

                var entities = [];
                w.entitiesManager.eachEntity(function(id, ent) {
                    entities.push(ent);
                });

                let rdfString = await w.annotationsManager.getAnnotations(entities, rdfmode);
                // parse the selector and find the relevant node
                var $docEl = $(xmlDoc.documentElement);
                var selector = w.schemaManager.mapper.getRdfParentSelector();
                var selectorTags = selector.split('/');
                var $currNode = $docEl;
                for (var i = 0; i < selectorTags.length; i++) {
                    var tag = selectorTags[i];
                    if (tag !== '') {
                        if (tag.indexOf('::') === -1) {
                            if ($currNode[0].nodeName === tag) {
                                continue;
                            } else {
                                var $nextNode = $currNode.children(tag).first();
                                if ($nextNode.length === 1) {
                                    $currNode = $nextNode;
                                } else {
                                    // node doesn't exist so add it
                                    var namespace = $currNode[0].namespaceURI;
                                    var node = xmlDoc.createElementNS(namespace, tag);
                                    var child = $currNode[0].firstElementChild;
                                    if (child !== null) {
                                        $currNode = $($currNode[0].insertBefore(node, child));
                                    } else {
                                        $currNode = $($currNode[0].appendChild(node));
                                    }
                                }
                            }
                        } else {
                            // axis handling
                            var parts = tag.split('::');
                            var axis = parts[0];
                            tag = parts[1];
                            switch(axis) {
                                case 'preceding-sibling':
                                    var parent = $currNode[0].parentNode;
                                    var namespace = parent.namespaceURI;
                                    var node = xmlDoc.createElementNS(namespace, tag);
                                    $currNode = $(parent.insertBefore(node, $currNode[0]));
                                    break;
                                case 'following-sibling':
                                    var parent = $currNode[0].parentNode;
                                    var namespace = parent.namespaceURI;
                                    var node = xmlDoc.createElementNS(namespace, tag);
                                    var sibling = $currNode[0].nextElementSibling;
                                    if (sibling !== null) {
                                        $currNode = $(parent.insertBefore(node, sibling));
                                    } else {
                                        $currNode = $(parent.appendChild(node));
                                    }
                                    break;
                                default:
                                    console.warn('cwrc2xml: axis',axis,'not supported');
                                    break;
                            }
                        }
                    }
                }

                if ($currNode !== $docEl) {
                    $currNode.append(rdfString);
                } else {
                    console.warn('cwrc2xml: couldn\'t find rdfParent for',selector);
                }
                
                console.time('xmlToString');
                xmlString = w.utilities.xmlToString(xmlDoc);
                console.timeEnd('xmlToString');

                xmlString = xmlString.replace(/\uFEFF/g, ''); // remove characters inserted by node selecting

                callback.call(this, xmlString);
            }
        } else {
            xmlString = xmlString.replace(/\uFEFF/g, ''); // remove characters inserted by node selecting

            callback.call(this, xmlString);
        }
    };
    
    /**
     * Process HTML entities and overlapping entities
     * @param {jQuery} body The text body
     */
    function prepareText(body) {
        // Convert HTML entities to unicode, while preserving those that must be escaped as entities.

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
        _recursiveTextConversion(body);

        // Handle overlapping entities

        // get the overlapping entity IDs, in the order that they appear in the document.
        var overlappingEntNodes = $('[_entity][class~="start"]', body).not('[_tag]').not('[_note]');
        var overlappingEntIds = $.map(overlappingEntNodes, function(val, index) {
            return $(val).attr('name');
        });
        // get ranges for overlapping entities, set offsetIds
        // then remove the associated nodes
        $(overlappingEntIds).each(function(index, id) {
            var entry = w.entitiesManager.getEntity(id);
            entry.setRange(getRangesForEntity(id));
            $('[name="'+id+'"]', body).each(function(index, el) {
                $(el).contents().unwrap();
            });
        });
    };
    
    /**
     * Determine and set the range objects for each entity.
     * Used later to construct the RDF.
     * @param {Document} doc The XML document
     */
    function setEntityRanges(doc) {
        w.entitiesManager.eachEntity(function(entityId, entry) {
            var entity = $('[cwrcTempId="'+entityId+'"]', doc);
            if (entity.length === 1) {
                entry.setRange({
                    startXPath: w.utilities.getElementXPath(entity[0])
                })
            }
        });
    }

    /**
     * Converts the editor node and its contents into an XML string suitable for export.
     * @param {Element} node
     * @param {Boolean} [identifyEntities] If true, adds cwrcTempId to entity elements. Default is false.
     * @returns {String}
     */
    cwrc2xml.buildXMLString = function(node, identifyEntities) {
        identifyEntities = identifyEntities === undefined ? false : identifyEntities;

        var xmlString = '';

        function _nodeToStringArray(currNode) {
            var array = [];
            
            var tag = currNode.attr('_tag');
            if (tag === undefined) {
                array = ['', ''];
            } else {
                var id = currNode.attr('id');
                var isEntity = currNode.attr('_entity') === 'true';
                if (isEntity) {
                    var entityEntry = w.entitiesManager.getEntity(id);
                    if (entityEntry) {
                        array = w.schemaManager.mapper.getMapping(entityEntry);
                        if (identifyEntities) {
                            // add temp id so we can target it later in setEntityRanges
                            if (array[0] !== '') {
                                array[0] = array[0].replace(/([\s>])/, ' cwrcTempId="'+id+'"$&');
                            } else {
                                array[1] = array[1].replace(/([\s>])/, ' cwrcTempId="'+id+'"$&');
                            }
                        }
                    } else {
                        // TODO this occurs if the selection panel is open and we're finalizing an entity
                        console.warn('cwrc2xml.buildXMLString: no entity entry for',id);
                        array = ['', ''];
                    }
                } else {
                    var openingTag = '<'+tag;
                    var attributes = w.tagger.getAttributesForTag(currNode[0]);
                    for (var attName in attributes) {
                        var attValue = attributes[attName];
                        // attValue = w.utilities.convertTextForExport(attValue); TODO is this necessary?
                        openingTag += ' '+attName+'="'+attValue+'"';
                    }

                    var isEmpty = currNode[0].childNodes.length === 0 || (currNode[0].childNodes.length === 1 && currNode[0].textContent === '\uFEFF');
                    if (isEmpty) {
                        openingTag += '/>';
                        array.push(openingTag);
                    } else {
                        openingTag += '>';
                        array.push(openingTag);
                        array.push('</'+tag+'>');
                    }
                }
            }
    
            return array;
        }

        function doBuild(currentNode) {
            var tags = _nodeToStringArray(currentNode);
            xmlString += tags[0];
            if (tags.length > 1) {
                currentNode.contents().each(function(index, el) {
                    if (el.nodeType == Node.ELEMENT_NODE) {
                        doBuild($(el));
                    } else if (el.nodeType == Node.TEXT_NODE) {
                        xmlString += el.data;
                    } else if (el.nodeType == Node.COMMENT_NODE) {
                        xmlString += '<!--'+el.data+'-->';
                    }
                });
                xmlString += tags[1];
            }
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