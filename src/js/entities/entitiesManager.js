'use strict';

var $ = require('jquery');
var Entity = require('entity');

/**
 * @class EntitiesManager
 * @param {Writer} writer
 */
function EntitiesManager(writer) {
    this.w = writer;
    
    this.reset();
    
    this.w.event('processingDocument').subscribe(function() {
        this.reset();
    }.bind(this));

    this.w.event('entityAdded').subscribe(function(entityId) {
        // don't highlight the entity because we might be doing bulk additions
        // this.highlightEntity(entityId);
    }.bind(this));
    this.w.event('entityEdited').subscribe(function(entityId) {
        // don't highlight the entity because it will move the cursor outside of the entity when the user is editing
        // this.highlightEntity(entityId);
    }.bind(this));
    this.w.event('entityRemoved').subscribe(function(entityId) {
        this.highlightEntity();
    }.bind(this));
    this.w.event('entityPasted').subscribe(function(entityId) {
        this.highlightEntity(entityId);
    }.bind(this));
}

EntitiesManager.prototype = {
    constructor: EntitiesManager,
    
    /**
     * Creates and adds an entity to the collection.
     * @fires Writer#entityAdded
     * @param {Object|Entity} config The entity config.
     * @param {Range} [range] If a range is provided, the actual tag is also added
     * @returns {Entity} The newly created Entity
     */
    addEntity: function(config, range) {
        var entity;
        if (config.constructor.name === 'Entity') {
            entity = config;
        } else {
            if (config.id === undefined) {
                config.id = this.w.getUniqueId('dom_');
            }
            
            if (config.tag === undefined) {
                config.tag = this.w.schemaManager.mapper.getParentTag(config.type);
            }
            
            entity = new Entity(config);
        }

        var requiredAttributes = this.w.schemaManager.mapper.getRequiredAttributes(config.type);
        for (var attName in requiredAttributes) {
            entity.setAttribute(attName, requiredAttributes[attName]);
        }

        this.w.schemaManager.mapper.updatePropertiesFromAttributes(entity);

        if (range !== undefined) {
            this.w.tagger.addEntityTag(entity, range);
        }

        if (entity.getContent() === undefined) {
            entity.setContent(this.getTextContentForEntity(entity.id));
        }
        
        this.entities[entity.id] = entity;

        this.w.event('entityAdded').publish(entity.id);
        
        return entity;
    },

    /**
     * Edits the entity using the supplied info.
     * @param {Entity} entity The entity
     * @param {Object} info The entity info
     * @param {Object} info.attributes Key/value pairs of attributes
     * @param {Object} info.properties Key/value pairs of Entity properties
     * @param {Object} info.customValues Any additional custom values
     * @returns {Entity} The edited Entity
     */
    editEntity: function(entity, info) {
        // set attributes
        entity.setAttributes(info.attributes);

        // set properties
        if (info.properties !== undefined) {
            for (var key in info.properties) {
                entity.setProperty(key, info.properties[key]);
            }
        }

        this.w.schemaManager.mapper.updatePropertiesFromAttributes(entity);

        // type might have changed so need to set these
        var requiredAttributes = this.w.schemaManager.mapper.getRequiredAttributes(entity.getType());
        for (var attName in requiredAttributes) {
            entity.setAttribute(attName, requiredAttributes[attName]);
        }
        
        // set custom values
        for (var key in info.customValues) {
            entity.setCustomValue(key, info.customValues[key]);
        }

        return entity;
    },
    
    /**
     * Remove an entity from the collection.
     * NB: does not remove any associated tags in the document.
     * @fires Writer#entityRemoved
     * @param {String} id Then entity ID.
     * @param id
     */
    removeEntity: function(id) {
        if (this.entities[id] !== undefined) {
            delete this.entities[id];
            this.w.event('entityRemoved').publish(id);
        }
    },
    
    /**
     * Gets an entity by its ID.
     * @param {String} id The entity ID.
     * @returns {Entity}
     */
    getEntity: function(id) {
        return this.entities[id];
    },
    
    /**
     * Sets an entity by ID.
     * @param {String} id The entity ID.
     * @param {Entity} entity The entity.
     */
    setEntity: function(id, entity) {
        if (entity instanceof Entity) {
            this.entities[id] = entity;
        } else {
            console.warn('entitiesManager: trying to set a non-Entity object.');
        }
    },
    
    /**
     * Returns a clone of the entity.
     * @param {String} id The entity ID.
     * @returns {Entity}
     */
    cloneEntity: function(id) {
        var clone = this.entities[id].clone();
        clone.id = this.w.getUniqueId('dom_');
        // TODO get new URIs
        return clone;
    },
    
    /**
     * Gets all the entities.
     * @returns {Object}
     */
    getEntities: function() {
        return this.entities;
    },
    
    /**
     * Gets all the entities, sorted by a particular method.
     * @param {String} [sortingMethod] Either "seq" (sequential), "cat" (categorical), or "alpha" (alphabetical). Default is "seq".
     * @returns {Array}
     */
    getEntitiesArray: function(sortingMethod) {
        sortingMethod = sortingMethod === undefined ? 'seq' : sortingMethod;

        var sortedEntities = [];

        if (sortingMethod === 'cat') {
            var entArray = Object.values(this.entities);
            var categories = {};
            entArray.forEach(function(entry) {
                var type = entry.getType();
                if (categories[type] === undefined) {
                    categories[type] = [];
                }
                categories[type].push(entry);
            });
            for (var type in categories) {
                var category = categories[type];
                for (var i = 0; i < category.length; i++) {
                    var entry = category[i];
                    sortedEntities.push(entry);
                }
            }
        } else if (sortingMethod === 'alpha') {
            sortedEntities = Object.values(this.entities).sort(function(a, b) {
                var charA = a.getTitle().charAt(0).toLowerCase();
                var charB = b.getTitle().charAt(0).toLowerCase();
                if (charA < charB) return -1;
                if (charA > charB) return 1;
                return 0;
            });
        } else {
            var entityTags = $('[_entity][class~=start]', this.w.editor.getBody()); // sequential ordering
            entityTags.each(function(index, el) {
                var entry = this.getEntity($(el).attr('name'));
                if (entry !== undefined) {
                    sortedEntities.push(entry);
                }
            }.bind(this));
        }

        return sortedEntities;
    },

    /**
     * Iterate through all entities.
     * Callback is passed the ID and the Entity as arguments.
     * @param {Function} callback
     */
    eachEntity: function(callback) {
        $.each(this.entities, callback);
    },
    
    /**
     * Gets the currently highlighted entity ID.
     * @returns {String} Entity ID
     */
    getCurrentEntity: function() {
        return this.currentEntity;
    },
    
    /**
     * Sets the currently highlighted entity ID.
     * @param {String} entityId
     */
    setCurrentEntity: function(entityId) {
        this.currentEntity = entityId;
    },

    /**
     * Gets all the content of the text nodes that the entity surrounds.
     * @param {String} entityId 
     * @returns {String} The text content
     */
    getTextContentForEntity: function(entityId) {
        var entityTextContent = '';
        $('[name='+entityId+']', this.w.editor.getBody()).each(function(i, el) {
            entityTextContent += el.textContent;
        });
        return entityTextContent;
    },

    /**
     * Sets the URI property and corresponding attribute
     * @param {String} entityId
     * @param {String} uri
     */
    setURIForEntity: function(entityId, uri) {
        var entity = this.getEntity(entityId);
        entity.setURI(uri);
        var uriMapping = this.w.schemaManager.mapper.getAttributeForProperty(entity.getType(), 'uri');
        if (uriMapping) {
            entity.setAttribute(uriMapping, uri);
        }
    },

    /**
     * Sets the lemma property and corresponding attribute
     * @param {String} entityId
     * @param {String} lemma
     */
    setLemmaForEntity: function(entityId, lemma) {
        var entity = this.getEntity(entityId);
        entity.setLemma(lemma);
        var lemmaMapping = this.w.schemaManager.mapper.getAttributeForProperty(entity.getType(), 'lemma');
        if (lemmaMapping) {
            entity.setAttribute(lemmaMapping, lemma);
        }
    },

    /**
     * Sets the certainty property and corresponding attribute
     * @param {String} entityId
     * @param {String} certainty
     */
    setCertaintyForEntity: function(entityId, certainty) {
        var entity = this.getEntity(entityId);
        entity.setCertainty(certainty);
        var certaintyMapping = this.w.schemaManager.mapper.getAttributeForProperty(entity.getType(), 'certainty');
        if (certaintyMapping) {
            entity.setAttribute(certaintyMapping, certainty);
        }
    },

    removeHighlights: function() {
        var prevHighlight = $('.entityHighlight', this.w.editor.getBody());
        if (prevHighlight.length !== 0) {
            prevHighlight.each(function(index, el) {
                var $p = $(el);
                if ($p.hasClass('noteWrapper')) {
                    $p.removeClass('entityHighlight');
                } else {
                    var parent = $p.parent()[0];
                    if ($p.contents().length !== 0) {
                        $p.contents().unwrap();
                    } else {
                        $p.remove();
                    }
                    parent.normalize();
                }
            });
        }
        if (this.currentEntity !== null) {
            this.w.event('entityUnfocused').publish(this.currentEntity);
        }
    },

    /**
     * Highlights an entity or removes the highlight from a previously highlighted entity.
     * @fires Writer#entityUnfocused
     * @fires Writer#entityFocused
     * @param {String} [id] The entity ID.
     * @param [bm] TinyMce bookmark
     * @param {Boolean} [doScroll] True to scroll to the entity
     */
    highlightEntity: function(id, bm, doScroll) {
        // clear previous highlight
        this.removeHighlights();
        
        this.currentEntity = null;
        
        if (id) {
            this.currentEntity = id;
            
            var entityTags = $('[name="'+id+'"]', this.w.editor.getBody());
            if (entityTags.length > 0) {
                var entity = this.getEntity(id);
                var type = entity.getType();

                // clear selection
                var rng = this.w.editor.dom.createRng();
                this.w.editor.selection.setRng(rng);
                
                if (entity.isNote()) {
                    entityTags.parent('.noteWrapper').removeClass('hide').addClass('entityHighlight');
                } else {
                    entityTags.wrap('<span class="entityHighlight '+type+'"/>');
                    entityTags.parents('.noteWrapper').removeClass('hide'); // if the entity is inside a note, make sure that it's shown
                }
                if (bm) {
                    // maintain the original caret position
                    this.w.editor.selection.moveToBookmark(bm);
                } else {
                    // move inside entity
                    rng = this.w.editor.dom.createRng();
                    rng.setStart(entityTags[0], 0);
                    rng.collapse(true);
                    this.w.editor.selection.setRng(rng);
                }
                
                if (doScroll) {
                    var val = entityTags.offset().top;
                    $(this.w.editor.getDoc().documentElement).scrollTop(val);
                }
                
                this.w.event('entityFocused').publish(id);
            }
        }
    },

    /**
     * Check to see if any of the entities overlap.
     * @returns {Boolean}
     */
    doEntitiesOverlap: function() {
        // remove highlights
        this.highlightEntity();
        
        var overlap = false;
        this.eachEntity(function(id, entity) {
            var markers = this.w.editor.dom.select('[name="'+id+'"]');
            if (markers.length > 1) {
                var start = markers[0];
                var end = markers[markers.length-1];
                if (start.parentNode !== end.parentNode) {
                    overlap = true;
                    return false; // stop looping through entities
                }
            }
        }.bind(this));

        return overlap;
    },

    /**
     * Removes entities that overlap other entities.
     */
    removeOverlappingEntities: function() {
        this.highlightEntity();
        
        this.eachEntity(function(id, entity) {
            var markers = this.w.editor.dom.select('[name="'+id+'"]');
            if (markers.length > 1) {
                var start = markers[0];
                var end = markers[markers.length-1];
                if (start.parentNode !== end.parentNode) {
                    this.w.tagger.removeEntity(id);
                }
            }
        }.bind(this));
    },

    /**
     * Converts boundary entities (i.e. entities that overlapped) to tag entities, if possible.
     * TODO review
     */
    convertBoundaryEntitiesToTags: function() {
        this.eachEntity(function(id, entity) {
            var markers = this.w.editor.dom.select('[name="'+id+'"]');
            if (markers.length > 1) {
                var canConvert = true;
                var parent = markers[0].parentNode;
                for (var i = 0; i < markers.length; i++) {
                    if (markers[i].parentNode !== parent) {
                        canConvert = false;
                        break;
                    }
                }
                if (canConvert) {
                    var $tag = $(this.w.editor.dom.create('span', {}, ''));
                    var atts = markers[0].attributes;
                    for (var i = 0; i < atts.length; i++) {
                        var att = atts[i];
                        $tag.attr(att.name, att.value);
                    }
                    
                    $tag.addClass('end');
                    $tag.attr('id', $tag.attr('name'));
                    $tag.attr('_tag', entity.getTag());
                    // TODO add entity.getAttributes() as well?
                    
                    $(markers).wrapAll($tag);
                    $(markers).contents().unwrap();
                    // TODO normalize child text?
                }
            }
        }.bind(this));
    },
    
    /**
     * Removes all the entities.
     */
    reset: function() {
        this.currentEntity = null;
        this.entities = {};
    }
};

module.exports = EntitiesManager;