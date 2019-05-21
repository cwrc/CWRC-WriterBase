'use strict';

/**
 * @class Entity
 * @param {Object} config
 */
function Entity(config) {
    
    /**
     * The internal ID of the entity.
     * @type {String}
     */
    this.id = undefined;
    
    /**
     * The type of the entity, e.g. person, place, date.
     * @type {String}
     */
    this.type = undefined;

    /**
     * Is the entity a note
     * @type {Boolean}
     */
    this._isNote = false;

    /**
     * Is the entity named, i.e. does it have a URI
     * @type {Boolean}
     */
    this._isNamedEntity = false;
    
    /**
     * The parent tag of the entity.
     * @type {String}
     */
    this.tag = undefined;
    
    /**
     * The text content of the entity.
     * @type {String}
     */
    this.content = undefined;
    
    /**
     * A label for use when displaying information about the entity.
     * Typically will be a concatenated version of the content.
     * @type {String}
     */
    this.title = undefined;
    
    /**
     * Values that can be directly mapped onto the entity's tag.
     * @type {Object}
     */
    this.attributes = {};
    
    /**
     * Values that can't be directly mapped onto the entity's tag.
     * @type {Object}
     */
    this.customValues = {};
 
    /**
     * XML content, used by note-type entities.
     * @type {String}
     */
    this.noteContent = undefined;

    /**
     * When the entity was created.
     * TODO should this update if the entity is edited?
     * @type {String} A date in ISO string format
     */
    this.dateCreated = undefined;
    
    /**
     * Values used to identify the text range of the entity. Mainly set by converter when loading a document.
     * @type {Object}
     * @property {String} startXPath
     * @property {Integer} startOffset
     * @property {String} endXPath
     * @property {Integer} endOffset
     */
    this.annotationRange = {};

    // NAMED ENTITY PROPERTIES

    /**
     * The URI associated with this entity (usually from a lookup).
     * @type {String}
     */
    this.uri = undefined;

    /**
     * The lemma for this entity (usually from a lookup).
     * @type {String}
     */
    this.lemma = undefined;

    /**
     * The certainty of the entity annotation.
     * @type {String}
     */
    this.certainty = undefined;
    


    // SET VALUES FROM CONFIG

    this.id = config.id;
    this.type = config.type;
    this.tag = config.tag;

    if (config.dateCreated !== undefined) {
        // try setting the date
        var date = new Date(config.dateCreated);
        if (isNaN(date.valueOf())) {
            // invalid date so use now
            this.dateCreated = new Date().toISOString();
        } else {
            this.dateCreated = date.toISOString();
        }
    } else {
        this.dateCreated = new Date().toISOString();
    }
    
    if (config.content !== undefined) {
        this.setContent(config.content);
    }
    if (config.attributes !== undefined) {
        this.attributes = config.attributes;
    }
    if (config.customValues !== undefined) {
        this.customValues = config.customValues;
    }
    if (config.noteContent !== undefined) {
        this.noteContent = config.noteContent;
        this._isNote = true;
    }
    if (config.isNote !== undefined) {
        this._isNote = config.isNote;
    }
    if (config.range !== undefined) {
        this.annotationRange = config.range;
    }
    if (config.uri !== undefined) {
        this.uri = config.uri;
        this._isNamedEntity = true;
    }
    if (config.lemma !== undefined) {
        this.lemma = config.lemma;
    }
    if (config.certainty !== undefined) {
        this.certainty = config.certainty;
    }
    if (config.isNamedEntity !== undefined) {
        this._isNamedEntity = config.isNamedEntity;
    }
}

Entity.getTitleFromContent = function(content) {
    var content = content.trim().replace(/\s+/g, ' ');
    if (content.length <= 34) return content;
    var title = content.substring(0, 34) + '&#8230;';
    return title;
};

Entity.prototype = {
    constructor: Entity,
    
    getId: function() {
        return this.id;
    },
    setId: function(id) {
        this.id = id;
    },
    getType: function() {
        return this.type;
    },
    isNote: function() {
        return this._isNote;
    },
    isNamedEntity: function() {
        return this._isNamedEntity;
    },
    getTag: function() {
        return this.tag;
    },
    setTag: function(tag) {
        this.tag = tag;
    },
    getContent: function() {
        return this.content;
    },
    setContent: function(content) {
        this.content = content;
        this.title = Entity.getTitleFromContent(this.content);
    },
    getTitle: function() {
        if (this.lemma !== undefined) {
            return this.lemma;
        } else {
            return this.title;
        }
    },
    
    getAttribute: function(key) {
        return this.attributes[key];
    },
    getAttributes: function() {
        return this.attributes;
    },
    /**
     * Set an attribute for the entity
     * @param {String} name 
     * @param {String} value 
     */
    setAttribute: function(name, value) {
        this.attributes[name] = value;
    },
    setAttributes: function(attObj) {
        this.attributes = {};
        for (var key in attObj) {
            this.attributes[key] = attObj[key];
        }
    },
    removeAttribute: function(name) {
        delete this.attributes[name];
    },
    
    getCustomValue: function(key) {
        return this.customValues[key];
    },
    getCustomValues: function() {
        return this.customValues;
    },
    setCustomValue: function(name, value) {
        this.customValues[name] = value;
    },
    setCustomValues: function(propOjb) {
        this.customValues = propOjb;
    },
    removeCustomValue: function(name) {
        delete this.customValues[name];
    },

    setProperty: function(property, value) {
        if (this.hasOwnProperty(property)) {
            this[property] = value;
        }
    },
    
    getNoteContent: function() {
        return this.noteContent;
    },
    setNoteContent: function(content) {
        this.noteContent = content;
    },

    getDateCreated: function() {
        return this.dateCreated;
    },

    getURI: function() {
        return this.uri;
    },
    setURI: function(uri) {
        // TODO also set corresponding attribute?
        this.uri = uri;
    },

    getLemma: function() {
        return this.lemma;
    },
    setLemma: function(lemma) {
        // TODO also set corresponding attribute?
        this.lemma = lemma;
    },

    getCertainty: function() {
        return this.certainty;
    },
    setCertainty: function(certainty) {
        // TODO also set corresponding attribute?
        this.certainty = certainty;
    },
    
    getRange: function() {
        return this.annotationRange;
    },
    setRange: function(rangeObj) {
        this.annotationRange = rangeObj;
    },
    
    clone: function() {
        var clone = Object.create(Entity.prototype);
        for (var key in this) {
            var prop = this[key];
            if (typeof prop !== 'function') {
                clone[key] = prop;
            }
        }
        
        return clone;
    }
};

module.exports = Entity;