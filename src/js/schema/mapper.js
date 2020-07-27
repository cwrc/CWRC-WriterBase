'use strict';

var $ = require('jquery');
var Entity = require('../entities/entity');

function Mapper(config) {
    this.w = config.writer;

    this.currentMappingsId = undefined;

    // can't require mappings outside of constructor due to circular dependency of mappings on static Mapper methods
    this.mappings = {
        empty: require('./empty_mappings.js'),
        tei: require('./tei/mappings.js'),
        teiLite: require('./teiLite/mappings.js'),
        orlando: require('./orlando/mappings.js'),
        cwrcEntry: require('./cwrcEntry/mappings.js')
    };
}

// a list of reserved attribute names that are used by the editor
Mapper.reservedAttributes = {
    '_entity': true,
    '_type': true,
    '_tag': true,
    '_textallowed': true,
    '_note': true,
    '_candidate': true,
    '_attributes': true,
    'id': true,
    'name': true,
    'class': true,
    'style': true
};

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

    var attributes = Object.assign({}, entity.getAttributes());
    for (var key in attributes) {
        if (Mapper.reservedAttributes[key]) {
            delete attributes[key];
        }
    }

    var tag = entity.getTag();
    var xml = '<'+tag;
    xml += Mapper.getAttributeString(attributes);
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
        var type = entity.getType();
        var entry = this.getMappings().entities[type];
        if (entry.mappingFunction) {
            return entry.mappingFunction(entity);
        } else {
            return Mapper.getDefaultMapping(entity)
        }
    },

    /**
     * Returns the mapping of an element to an entity config object.
     * @param {Element} el The element
     * @param {Boolean} [cleanUp] Whether to remove the elements that got matched by reverse mapping. Default is false.
     * @returns {Object} The entity config object.
     */
    getReverseMapping: function(el, cleanUp) {
        function getValueFromXPath(contextEl, xpath) {
            var value;
            var result = this.w.utilities.evaluateXPath(contextEl, xpath);
            if (result !== null) {
                if (result.nodeType) {
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
                    }
                } else if (typeof result === 'string') {
                    // TODO rework this because the result will be null
                    // it's probably a local-name() function
                    value = result;
                    var innerXPath = /^local-name\((.*)\)$/.exec(xpath); // try to get the inside of the name function
                    if (innerXPath !== null) {
                        innerXPath = innerXPath[1];
                        var innerResult = getValueFromXPath.call(this, contextEl, innerXPath);

                        // hack: if innerResult return undefined, resutl is also undefined
                        if (innerResult === undefined) {
                            console.warn('mapper.getReverseMapping.getValueFromXPath: cannot get match for unrecognizable xpath',xpath);
                            result = undefined;
                        } else {
                            result = innerResult.match;
                        }
                        
                    } else {
                        console.warn('mapper.getReverseMapping.getValueFromXPath: cannot get match for unrecognizable xpath',xpath);
                    }
                }
    
                return {value: value, match: result};
            }
            return undefined;
        };

        /**
         * Removes the match entries from the mappingInfo object. Optionally removes the matched elements/attributes themselves.
         * @param {Element} entityElement
         * @param {Object} mappingInfo
         * @param {Boolean} isCWRC
         * @param {String|Array} textTag
         * @param {Boolean} removeMatch
         */
        function cleanupMappings(entityElement, mappingInfo, isCWRC, textTag, removeMatch) {
            function isTextTag(node) {
                var nodeName;
                if (isCWRC) {
                    nodeName = node.getAttribute('_tag');
                } else {
                    nodeName = node.nodeName;
                }
                if (Array.isArray(textTag)) {
                    return textTag.indexOf(nodeName) !== -1;
                } else {
                    return nodeName === textTag;
                }
            }
            function _removeMatch(match) {
                switch(match.nodeType) {
                    case Node.ATTRIBUTE_NODE:
                        if (match.ownerElement !== entityElement) {
                            match.ownerElement.parentElement.removeChild(match.ownerElement);
                        }
                        break;
                    case Node.ELEMENT_NODE:
                        if (match !== entityElement) {
                            if (isTextTag(match)) {
                                $(match.firstChild).unwrap();
                            } else {
                                match.parentElement.removeChild(match);
                            }
                        }
                        break;
                    case Node.TEXT_NODE:
                        if (match.parentElement !== entityElement) {
                            // if that text's parent is not the entity then remove the text and the parent if it's not the textTag
                            // otherwise just remove the text's parent
                            if (isTextTag(match.parentElement)) {
                                $(match).unwrap();
                            } else {
                                $(match.parentElement).remove();
                            }
                        }
                        break;
                    default:
                        console.warn('mapper.getReverseMapping.cleanupMappings: cannot remove node with unknown type', match);
                }
            }

            for (var key in mappingInfo) {
                if (key !== 'attributes') {
                    var level1 = mappingInfo[key];
                    if (level1.match) {
                        if (removeMatch) {
                            _removeMatch(level1.match);
                        }
                        mappingInfo[key] = level1.value;
                    } else {
                        for (var key2 in level1) {
                            var level2 = level1[key2];
                            if (level2.match) {
                                if (removeMatch) {
                                    _removeMatch(level2.match);
                                }
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
        var mapping = entry.mapping;
        
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
            var textTag = this.getTextTag(type);
            cleanupMappings(el, obj, isCWRC, textTag, cleanUp);
        }

        // set type after mapping and cleanup is done
        obj.type = type;
        obj.isNote = this.isEntityTypeNote(type);
        
        return obj;
    },

    /**
     * Checks if the tag is for an entity.
     * @param {Element|String} el The tag to check.
     * @returns {String|null} The entity type, or null
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
        
        // put xpath mappings at beginning
        var sortedMappings = [];
        for (var type in mappings.entities) {
            var mapping = Object.assign({}, mappings.entities[type]);
            mapping.type = type;
            if (mapping.xpathSelector !== undefined) {
                sortedMappings.splice(0, 0, mapping)
            } else {
                sortedMappings.push(mapping);
            }
        }
        
        for (var i = 0; i < sortedMappings.length; i++) {
            var mapping = sortedMappings[i];
            // prioritize xpath
            if (mapping.xpathSelector !== undefined && isElement) {
                var result = this.w.utilities.evaluateXPath(el, mapping.xpathSelector);
                if (result !== null) {
                    return mapping.type;
                }
            } else {
                var parentTag = mapping.parentTag;
                if (($.isArray(parentTag) && parentTag.indexOf(tag) !== -1) || parentTag === tag) {
                    return mapping.type;
                }
            }
        }

        return null;
    },

    /**
     * Gets the mapping for a property of a specific entity type
     * @param {String} type The entity type
     * @param {String} property The property name
     * @returns {String|undefined} The mapping
     */
    getMappingForProperty: function(type, property) {
        var entry = this.getMappings().entities[type];
        if (entry.mapping && entry.mapping[property]) {
            return entry.mapping[property];
        }
        return undefined;
    },

    /**
     * Gets the attribute name mapping for a property of an entity type, if it exists
     * @param {String} type The entity type
     * @param {String} property The property name
     * @returns {String|undefined} The mapping
     */
    getAttributeForProperty: function(type, property) {
        var mappingString = this.getMappingForProperty(type, property);
        if (mappingString !== undefined && /^@\w+$/.test(mappingString)) {
            // if it looks like an attribute, remove the @ and return the attribute name
            return mappingString.slice(1);
        }
        return undefined;
    },

    /**
     * Get all the properties for the entity type that have mappings to attributes
     * @param {String} type The entity type
     * @returns {Array}
     */
    getMappedProperties: function(type) {
        var props = [];
        
        var entry = this.getMappings().entities[type];
        if (entry.mapping) {
            for (var key in entry.mapping) {
                if (key !== 'customValues') {
                    props.push(key);
                }
            }
        }

        return props;
    },

    /**
     * If the entity has properties that map to attributes, update the property values with those from the attributes
     * @param {Entity} entity 
     */
    updatePropertiesFromAttributes: function(entity) {
        var type = entity.getType();
        var entry = this.getMappings().entities[type];
        if (entry.mapping) {
            for (var key in entry.mapping) {
                if (key !== 'customValues') {
                    var mapValue = entry.mapping[key];
                    if (typeof mapValue === 'string' && /^@\w+$/.test(mapValue)) {
                        var attributeName = mapValue.slice(1);
                        var attributeValue = entity.getAttribute(attributeName);
                        if (attributeValue !== undefined) {
                            entity.setProperty(key, attributeValue);
                        }
                    }
                }
            }
        }
    },

    /**
     * Checks if the specified entity type is "a note or note-like".
     * @param {String} type The entity type
     * @returns {Boolean}
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
     * Checks if the specified entity type is a named entity, i.e. specifies a URI.
     * @param {String} type The entity type
     * @returns {Boolean}
     */
    isNamedEntity: function(type) {
        if (type == null) {
            return false;
        }
        var entry = this.getMappings().entities[type];
        if (entry.mapping && entry.mapping.uri) {
            return true;
        } else {
            return false;
        }
    },

    /**
     * Checks if the specified entity type requires a text selection in order to be tagged
     * @param {String} type The entity type
     * @returns {Boolean}
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
     * Converts a tag to an entity
     * @param {Element} tag The tag
     * @param {Boolean} [showEntityDialog] Should the entity dialog be shown after conversion? Default is false
     * @returns {Entity|null} The new entity
     */
    convertTagToEntity: function(tag, showEntityDialog) {
        showEntityDialog = showEntityDialog === undefined ? false : showEntityDialog;

        var entityType = this.getEntityTypeForTag(tag);
        if (entityType !== null) {
            var id = tag.getAttribute('id');
            var isNote = this.isEntityTypeNote(entityType);
            var isNamedEntity = this.isNamedEntity(entityType);
            var config = {
                id: id,
                tag: tag.getAttribute('_tag'),
                type: entityType,
                isNote: isNote,
                isNamedEntity: isNamedEntity,
                range: {startXPath: this.w.utilities.getElementXPath(tag)}
            };

            var mappingInfo = this.getReverseMapping(tag, true);
            $.extend(config, mappingInfo);

            if (isNote) {
                var $tag = $(tag);
                config.content = $tag.text();
                config.noteContent = $tag.html();
            }
            
            var entityAttributes = {
                '_entity': true, '_type': entityType, 'class': 'entity '+entityType+' start end', 'name': id
            };
            if (isNote) {
                entityAttributes['_note'] = true;
            }
            for (var name in entityAttributes) {
                tag.setAttribute(name, entityAttributes[name]);
            }
            if (isNote) {
                this.w.tagger.addNoteWrapper(tag, entityType);
            }

            var entity = this.w.entitiesManager.addEntity(config);

            if (showEntityDialog) {
                if (!isNamedEntity || (isNamedEntity && entity.getURI() === undefined)) {
                    this.w.dialogManager.show(entityType, {type: entityType, entry: entity});
                }
            }

            return entity;
        } else {
            console.warn('mapper.convertTagToEntity: tag '+tag.getAttribute('_tag')+' cannot be converted to an entity!');
        }
        return null;
    },

    /**
     * Look for candidate entities inside the passed element
     * @param {Array} [typesToFind] An array of entity types to find, defaults to all types
     * @returns {Object} A map of the entities, organized by type
     */
    findEntities: function(typesToFind) {
        var allTypes = ['person', 'place', 'date', 'org', 'citation', 'note', 'title', 'correction', 'keyword', 'link'];
        var nonNoteTypes = ['person', 'place', 'date', 'org', 'title', 'link'];
        var namedEntities = ['person', 'place', 'org', 'title']

        typesToFind = typesToFind === undefined ? nonNoteTypes : typesToFind;
        
        var candidateEntities = {};
        
        var headerTag = this.getHeaderTag();

        // TODO tei mapping for correction will match on both choice and corr tags, creating 2 entities when it should be one
        var entityMappings = this.getMappings().entities;
        for (var type in entityMappings) {
            if (typesToFind.length == 0 || typesToFind.indexOf(type) != -1) {
                var entityTagNames = [];
                
                var parentTag = entityMappings[type].parentTag;
                if ($.isArray(parentTag)) {
                    entityTagNames = entityTagNames.concat(parentTag);
                } else if (parentTag !== '') {
                    entityTagNames.push(parentTag);
                }

                entityTagNames = entityTagNames.map(function(name) {
                    return '[_tag="'+name+'"]';
                });

                var matches = $(entityTagNames.join(','), this.w.editor.getBody()).filter(function(index, el) {
                    if (el.getAttribute('_entity') === 'true') {
                        return false;
                    }
                    if ($(el).parents('[_tag="'+headerTag+'"]').length !== 0) {
                        return false;
                    }
                    // double check entity type using element instead of string, which forces xpath evaluation, which we want for tei note entities
                    var entityType = this.getEntityTypeForTag(el);
                    if (entityType === null) {
                        return false;
                    } else {
                        var entry = this.getMappings().entities[entityType];
                        // if the mapping has a uri, check to make sure it exists
                        if (entry.mapping && entry.mapping.uri) {
                            var result = this.w.utilities.evaluateXPath(el, entry.mapping.uri);
                            if (result !== null) {
                                return true;
                            }
                        } else {
                            return true;
                        }
                    }
                    return false;
                }.bind(this));
                candidateEntities[type] = $.makeArray(matches);
            }
        }

        return candidateEntities;
    },

    /**
     * Returns the parent tag for entity when converted to a particular schema.
     * @param {String} type The entity type.
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
     * @param {String} type The entity type.
     * @returns {String}
     */
    getTextTag: function(type) {
        var tag = this.getMappings().entities[type].textTag;
        return tag;
    },

    /**
     * Returns the required attributes (atttribute names & values that are always added) for this entity type.
     * @param {String} type The entity type.
     * @returns {Object}
     */
    getRequiredAttributes: function(type) {
        var requiredAttributes = this.getMappings().entities[type].requiredAttributes;
        if (requiredAttributes === undefined) {
            return {};
        } else {
            return requiredAttributes;
        }
    },

    /**
     * Returns the root tags for the current schema.
     * @returns {Array}
     */
    getRootTags: function() {
        return this.getMappings().root;
    },

    /**
     * Returns the name of the header tag for the current schema.
     * @returns {String}
     */
    getHeaderTag: function() {
        return this.getMappings().header;
    },

    /**
     * Returns the namespace for the current schema.
     * @returns {String}
     */
    getNamespace: function() {
        return this.getMappings().namespace;
    },

    /**
     * Returns the name for the ID attribute for the current schema.
     * @returns {String}
     */
    getIdAttributeName: function() {
        return this.getMappings().id;
    },

    /**
     * Returns the name for the responsibility attribute for the current schema.
     * @returns {String}
     */
    getResponsibilityAttributeName: function() {
        return this.getMappings().responsibility;
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
