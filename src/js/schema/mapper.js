// TODO add IDs
'use strict';

var $ = require('jquery');
var xpath = require('jquery-xpath');
var Entity = require('../entity.js');

function Mapper(config) {
    this.w = config.writer;

    this.currentMappingsId = undefined;

    // can't require mappings outside of constructor due to circular dependency of mappings on static Mapper methods
    this.mappings = {
        empty: require('./empty_mappings.js'),
        tei: require('./tei/mappings.js'),
        orlando: require('./orlando/mappings.js'),
        cwrcEntry: require('./cwrcEntry/mappings.js')
    };
}

Mapper.getAttributeString = function(attObj) {
    var str = '';
    for (var key in attObj) {
        var val = attObj[key];
        if (val !== undefined && val !== '') {
            str += ' '+key+'="'+val+'"';
        }
    }
    return str;
};

/**
 * Gets entity markup attributes from xml. Assumes all other attributes have been removed.
 * @param xml {xml} The xml
 * @returns {Object} key/value pairs
 */
Mapper.getAttributesFromXml = function(xml) {
    var attrs = {};
    $.map(xml.attributes, function(att) {
        if (att.name === 'annotationId' || att.name === 'offsetId') {
            // don't include
        } else {
            attrs[att.name] = att.value;
        }
    });
    return attrs;
};

/**
 * Gets the standard mapping for a tag and attributes.
 * Doesn't close the tag, so that further attributes can be added.
 * @param {Entity} entity The Entity from which to fetch attributes.
 * @param {Boolean} [closeTag] True to close the tag (i.e. add >). Default is true.
 * @returns {String}
 */
Mapper.getTagAndDefaultAttributes = function(entity, closeTag) {
    closeTag = closeTag === undefined ? true : closeTag;
    var tag = entity.getTag();
    var xml = '<'+tag;
    xml += Mapper.getAttributeString(entity.getAttributes());
    if (closeTag) {
        xml += '>';
    }
    return xml;
};

/**
 * Similar to the Mapper.getTagAndDefaultAttributes method but includes the end tag.
 * @param {Entity} entity
 * @returns {Array}
 */
Mapper.getDefaultMapping = function(entity) {
    return [Mapper.getTagAndDefaultAttributes(entity), '</'+entity.getTag()+'>'];
};

Mapper.getDefaultReverseMapping = function(xml, customMappings, nsPrefix) {
    function getValueFromXPath(xpath) {
        var value;
        var result = Mapper.getXPathResult(xml, xpath, nsPrefix);
        if (result !== undefined) {
            switch (result.nodeType) {
                case Node.ELEMENT_NODE:
                    value = Mapper.xmlToString(result);
                    break;
                case Node.TEXT_NODE:
                    value = $(result).text();
                    break;
                case Node.ATTRIBUTE_NODE:
                    value = $(result).val();
                    break;
                case undefined:
                    value = result;
            }
        }
        return value;
    }
    
    var obj = {};
    if (customMappings !== undefined) {
        for (var key in customMappings) {
            if (typeof customMappings[key] === 'object') {
                obj[key] = {};
                for (var key2 in customMappings[key]) {
                    var xpath = customMappings[key][key2];
                    var val = getValueFromXPath(xpath);
                    if (val !== undefined) {
                        obj[key][key2] = val;
                    }
                }
            } else if (typeof customMappings[key] === 'string') {
                var xpath = customMappings[key];
                var val = getValueFromXPath(xpath);
                obj[key] = val;
            }
        }
    }
    obj.attributes = Mapper.getAttributesFromXml(xml);
    
    return obj;
};

/**
 * Returns the result of an xpath query on the passed xml
 * @param {Element} xmlContext Must be an element, can't be a document
 * @param {String} xpathExpression
 * @param {String} nsPrefix
 * @returns {Element|undefined}
 */
Mapper.getXPathResult = function(xmlContext, xpathExpression, nsPrefix) {
    nsPrefix = nsPrefix || '';
    var nsUri = xmlContext.namespaceURI;
    if (nsUri === null && nsPrefix !== '') {
        // remove namespaces
        var regex = new RegExp(nsPrefix+':', 'g');
        xpathExpression = xpathExpression.replace(regex, '');
    }

    var nsResolver = function(prefix) {
        if (prefix == nsPrefix) return nsUri;
    };
    
    var result = $(xmlContext).xpath(xpathExpression, nsResolver)[0];
    
    return result;
};

Mapper.xmlToString = function(xmlData) {
    var xmlString = '';
    try {
        if (window.ActiveXObject) {
            xmlString = xmlData.xml;
        } else {
            xmlString = (new XMLSerializer()).serializeToString(xmlData);
        }
    } catch (e) {
        alert(e);
    }
    return xmlString;
};

Mapper.prototype = {
    constructor: Mapper,

    /**
     * Loads the mappings for the specified schema.
     * @param schemaMappingsId {String} The schema mapping ID.
     * @returns {Deferred} Deferred object that resolves when the mappings are loaded.
     */
    loadMappings: function(schemaMappingsId) {
        this.clearMappings();
        this.currentMappingsId = schemaMappingsId;
        
        // process mappings
        var mappings = this.getMappings();
        if (mappings.listeners !== undefined) {
            for (var event in mappings.listeners) {
                this.w.event(event).subscribe(mappings.listeners[event]);
            }
        }
    },

    clearMappings: function() {
        var mappings = this.getMappings();
        if (mappings.listeners !== undefined) {
            for (var event in mappings.listeners) {
                this.w.event(event).unsubscribe(mappings.listeners[event]);
            }
        }
    },
    
    getMappings: function() {
        if (this.currentMappingsId !== undefined) {
            return this.mappings[this.currentMappingsId];
        } else {
            return this.mappings.empty;
        }
    },

    /**
     * Gets the XML mapping for the specified entity.
     * @param {Entity} entity 
     * @returns {Array} An 2 item array of opening and closing tags. If the tag is empty then it will be in the second index.
     */
    getMapping: function(entity) {
        var mapping = this.getMappings().entities[entity.getType()].mapping;
        if (mapping === undefined) {
            return ['', '']; // return array of empty strings if there is no mapping
        }
        return mapping(entity);
    },

    /**
     * Returns the mapping of xml to an entity object.
     * @param xml {XML} The xml.
     * @param type {String} The entity type.
     * @returns {Object} The entity object.
     */
    getReverseMapping: function(xml, type) {
        var entry = this.getMappings().entities[type];
        var mapping = entry.reverseMapping;
        if (mapping) {
            return mapping(xml);
        }
        return {};
    },

    /**
     * Checks if the tag is for an entity.
     * @param {Element|String} el The tag to check.
     * @returns {String} The entity type, or null
     */
    getEntityTypeForTag: function(el) {
        var tag;
        var isElement = false;
        if (typeof el === 'string') {
            tag = el;
        } else {
            isElement = true;
            tag = el.nodeName;
        }

        var mappings = this.getMappings();
        var resultType = null;
        for (var type in mappings.entities) {
            var xpath = mappings.entities[type].xpathSelector;
            if (xpath !== undefined && isElement) {
                var result = Mapper.getXPathResult(el, xpath, this.w.schemaManager.getCurrentSchema().schemaMappingsId);
                if (result !== undefined) {
                    resultType = type;
                    break; // prioritize xpath
                }
            } else {
                var parentTag = mappings.entities[type].parentTag;
                if (($.isArray(parentTag) && parentTag.indexOf(tag) !== -1) || parentTag === tag) {
                    resultType = type;
                    break;
                }
            }
        }
        return resultType;
    },

    /**
     * Checks if the particular entity type is "a note or note-like".
     * @param {String} type The entity type
     * @return {Boolean}
     */
    isEntityTypeNote: function(type) {
        if (type == null) {
            return false;
        }
        var isNote = this.getMappings().entities[type].isNote;
        if (isNote === undefined) {
            return false;
        } else {
            return isNote;
        }
    },

    /**
     * Returns the parent tag for entity when converted to a particular schema.
     * @param type The entity type.
     * @returns {String}
     */
    getParentTag: function(type) {
        var tag = this.getMappings().entities[type].parentTag;
        if (tag === undefined) {
            return '';
        }
        if ($.isArray(tag)) {
            tag = tag[0];
        }
        return tag;
    },

    /**
     * Returns the text tag (tag containing user-highlighted text) for entity when converted to a particular schema.
     * @param type The entity type.
     * @returns {String}
     */
    getTextTag: function(type) {
        var tag = this.getMappings().entities[type].textTag;
        if (tag === undefined) {
            return '';
        }
        return tag;
    },

    /**
     * Returns the name of the header tag for the current schema.
     * @returns {String}
     */
    getHeaderTag: function() {
        return this.getMappings().header;
    },

    /**
     * Returns the name for the ID attribute for the current schema.
     * @returns {String}
     */
    getIdAttributeName: function() {
        return this.getMappings().id;
    },

    /**
     * Returns the xpath selector for the RDF parent for the current schema.
     * @returns {String}
     */
    getRdfParentSelector: function() {
        return this.getMappings().rdfParentSelector;
    },

    /**
     * Returns the block level elements for the current schema.
     * @returns {Array}
     */
    getBlockLevelElements: function() {
        return this.getMappings().blockElements;
    },
    
    /**
     * Returns the attribute names that define whether the tag is an URL.
     * @returns {Array}
     */
    getUrlAttributes: function() {
        return this.getMappings().urlAttributes || [];
    },
    
    /**
     * Returns the attribute names that should be displayed in a popup.
     * @returns {Array}
     */
    getPopupAttributes: function() {
        return this.getMappings().popupAttributes || [];
    },
    
    /**
     * Returns the element names that should be displayed in a popup.
     * @param {Boolean} [convert] True to convert to cwrc format
     * @returns {Array}
     */
    getPopupElements: function(convert) {
        convert === undefined ? false : convert;
        var popupElements = this.getMappings().popupElements || [];
        if (convert) {
            var convertedElements = [];
            $.map(popupElements, function(val, i) {
                // check for attribute in selector
                var openBracketIndex = val.indexOf('[');
                if (openBracketIndex !== -1) {
                    var tag = val.substring(0, openBracketIndex);
                    var att = val.substring(openBracketIndex);
                    convertedElements.push('[_tag="'+tag+'"]'+att);
                } else {
                    convertedElements.push('[_tag="'+val+'"]');
                }
            });
            return convertedElements;
        } else {
            return popupElements;
        }
    }
};

module.exports = Mapper;
