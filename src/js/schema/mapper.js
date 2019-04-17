// TODO add IDs
'use strict';

var $ = require('jquery');
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
     * Returns the mapping of an element to an entity object.
     * @param {Element} el The element
     * @param {Boolean} [cleanUp] Whether to remove the elements that got matched by reverse mapping. Default is false.
     * @returns {Object} The entity object.
     */
    getReverseMapping: function(el, cleanUp) {
        function getValueFromXPath(contextEl, xpath) {
            var value;
            var result = this.w.utilities.evaluateXPath(contextEl, xpath);
            if (result !== null) {
                switch (result.nodeType) {
                    case Node.ELEMENT_NODE:
                        value = Mapper.xmlToString(result);
                        break;
                    case Node.TEXT_NODE:
                        value = result.textContent;
                        break;
                    case Node.ATTRIBUTE_NODE:
                        value = result.value;
                        break;
                    case undefined:
                        value = result;
                }
    
                return {value: value, match: result};
            }
            return undefined;
        };

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
                        console.warn('schemaManager.cleanProcessedEntity: cannot remove node with unknown type', match);
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
        };

        cleanUp = cleanUp === undefined ? false : cleanUp;

        var isCWRC = el.ownerDocument === this.w.editor.getDoc();

        var type = this.getEntityTypeForTag(el);
        if (type === null) {
            // TODO should we return null and then have to check for that?
            return {};
        }
        var entry = this.getMappings().entities[type];
        var mapping = entry.reverseMapping;
        
        var obj = {
            attributes: {}
        };

        // attributes
        if (isCWRC) {
            obj.attributes = this.w.tagger.getAttributesForTag(el);
        } else {
            $.map(el.attributes, function(att) {
                obj.attributes[att.name] = att.value;
            });
        }
        
        // mapping values
        if (mapping !== undefined) {
            for (var key in mapping) {
                if (typeof mapping[key] === 'object') {
                    obj[key] = {};
                    for (var key2 in mapping[key]) {
                        var xpath = mapping[key][key2];
                        var val = getValueFromXPath.call(this, el, xpath);
                        if (val !== undefined) {
                            obj[key][key2] = val;
                        }
                    }
                } else if (typeof mapping[key] === 'string') {
                    var xpath = mapping[key];
                    var val = getValueFromXPath.call(this, el, xpath);
                    if (val !== undefined) {
                        obj[key] = val;
                    }
                }
            }
            if (cleanUp) {
                cleanProcessedEntity(el, obj);
            }
        }
        
        return obj;
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
            var isCWRC = el.ownerDocument === this.w.editor.getDoc();
            if (isCWRC) {
                tag = el.getAttribute('_tag');
            } else {
                tag = el.nodeName;
            }
        }

        var mappings = this.getMappings();
        for (var type in mappings.entities) {
            var xpath = mappings.entities[type].xpathSelector;
            // prioritize xpath
            if (xpath !== undefined && isElement) {
                var result = this.w.utilities.evaluateXPath(el, xpath);
                if (result !== null) {
                    return type; 
                }
            } else {
                var parentTag = mappings.entities[type].parentTag;
                if (($.isArray(parentTag) && parentTag.indexOf(tag) !== -1) || parentTag === tag) {
                    return type;
                }
            }
        }

        return null;
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
     * Checkes is the particular entity type requires a text selection in order to be tagged
     * @param {String} type The entity type
     * @return {Boolean}
     */
    doesEntityRequireSelection: function(type) {
        if (type == null) {
            return true;
        }
        var requiresSelection = this.getMappings().entities[type].requiresSelection;
        if (requiresSelection === undefined) {
            return true;
        } else {
            return requiresSelection;
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
    }
};

module.exports = Mapper;
