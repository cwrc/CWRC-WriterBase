'use strict';

var $ = require('jquery');
var Entity = require('./entity.js');

/**
 * @class Tagger
 * @param {Writer} writer
 */
function Tagger(writer) {
    var w = writer;
    
    /**
     * @lends Tagger.prototype
     */
    var tagger = {};
    
    // prevents the user from moving the caret inside a marker
    var _doMarkerClick = function(e) {
        var marker = w.editor.dom.get(e.target);
        var range = w.editor.selection.getRng(true);
        if (w.editor.dom.hasClass(marker, 'start')) {
            range.setStartAfter(marker);
            range.setEndAfter(marker);
        } else {
            range.setStartBefore(marker);
            range.setEndBefore(marker);
        }
        w.editor.selection.setRng(range);
        w.entitiesManager.highlightEntity(marker.getAttribute('name'), w.editor.selection.getBookmark());
    };
    
    /**
     * Get the entity boundary tag (and potential inbetween tags) that corresponds to the passed tag.
     * @param {element} tag
     * @returns {jQuery}
     */
    tagger.getCorrespondingEntityTags = function(tag) {
        tag = $(tag);
        if (tag.hasClass('start') && tag.hasClass('end')) {
            return tag;
        }
        var boundaryType;
        if (tag.hasClass('start')) {
            boundaryType = 'end';
        } else {
            boundaryType = 'start';
        }
        
        var currentNode = tag[0];
        var nodeId = currentNode.getAttribute('name');
        var walker = currentNode.ownerDocument.createTreeWalker(currentNode.ownerDocument, NodeFilter.SHOW_ELEMENT, {
            acceptNode: function(node) {
                if (node.getAttribute('name') === nodeId) {
                    return NodeFilter.FILTER_ACCEPT;
                } else {
                    return NodeFilter.FILTER_SKIP;
                }
            }
        }, false);
        walker.currentNode = currentNode;
        
        var nodes = [];
        while(walker.currentNode.getAttribute('name') === nodeId) {
            var result;
            if (boundaryType === 'start') {
                result = walker.previousNode();
            } else {
                result = walker.nextNode();
            }
            if (result === null) {
                break;
            }
            nodes.push(walker.currentNode);
            if ($(walker.currentNode).hasClass(boundaryType)) {
                break;
            }
        }
        
        return $(nodes);
    };
    
    /**
     * Looks for tags that have been added or deleted and updates the entity and struct lists.
     * Returns true if a new tag is found.
     * @returns {Boolean}
     */
    tagger.findNewAndDeletedTags = function() {
        var updateRequired = false;
        
        // new structs
        var newStructs = w.editor.dom.select('[_tag]:not([id])');
        if (newStructs.length > 0) updateRequired = true;
        newStructs.forEach(function(struct, index) {
            var node = $(struct);
            var tag = node.attr('_tag');
            if (w.schemaManager.schema.elements.indexOf(tag) != -1) { // TODO is this check necessary?
                var id = w.getUniqueId('struct_');
                node.attr('id', id);
                w.structs[id] = {
                    id: id,
                    _tag: tag
                };
            } 
        });

        // new entities (from undo/redo)
        $('[_entity][class~=start]', w.editor.getBody()).each(function(index, el) {
            var entityId = $(el).attr('name');
            var deleted = w.deletedEntities[entityId];
            if (deleted != null) {
                updateRequired = true;
                w.entitiesManager.setEntity(entityId, deleted);
                delete w.deletedEntities[entityId];
            } else {
                // TODO
            }
        });
        
        // deleted entities
        w.entitiesManager.eachEntity(function(id, entity) {
            var nodes = w.editor.dom.select('[name="'+id+'"]');
            if (nodes.length === 0) {
                updateRequired = true;
                w.deletedEntities[id] = w.entitiesManager.getEntity(id);
                w.entitiesManager.removeEntity(id);
            }
        });
        
        // deleted and duplicate structs
        for (var id in w.structs) {
            var nodes = w.editor.dom.select('[id="'+id+'"]');
            if (nodes.length === 0) {
                updateRequired = true;
                w.deletedStructs[id] = w.structs[id];
                delete w.structs[id];
            } else if (nodes.length > 1) {
                nodes.forEach(function(el, index) {
                    if (index > 0) {
                        var newStruct = $(el);
                        var newId = w.getUniqueId('struct_');
                        newStruct.attr('id', newId);
                        w.structs[newId] = {};
                        for (var key in w.structs[id]) {
                            w.structs[newId][key] = w.structs[id][key];
                        }
                        w.structs[newId].id = newId;
                    }
                });
            }
        }
        return updateRequired;
    };
    
    /**
     * Looks for duplicate tags (from copy paste operations) and creates new entity/struct entries.
     */
    tagger.findDuplicateTags = function() {
        w.entitiesManager.eachEntity(function(id, entity) {
            var match = $('[name="'+id+'"]', w.editor.getBody());
            if (match.length > 1) {
                match.each(function(index, el) {
                    if (index > 0) {
                        var newEntity = w.entitiesManager.cloneEntity(id);
                        var newId = newEntity.getId();
                        w.entitiesManager.setEntity(newId, newEntity);
                        
                        var newTagStart = $(el);
                        var newTags = tagger.getCorrespondingEntityTags(newTagStart);
                        
                        newTagStart.attr('name', newId);
                        if (newTagStart.attr('id') !== undefined) {
                            newTagStart.attr('id', newId);
                        }
                        newTags.each(function(index, tag) {
                            $(tag).attr('name', newId);
                        });
                    }
                });
            }
        });
        for (var id in w.structs) {
            var match = $('*[id='+id+']', w.editor.getBody());
            if (match.length == 2) {
                var newStruct = match.last();
                var newId = w.getUniqueId('struct_');
                newStruct.attr('id', newId);
                w.structs[newId] = {};
                for (var key in w.structs[id]) {
                    w.structs[newId][key] = w.structs[id][key];
                }
                w.structs[newId].id = newId;
            }
        }
    };
    
    tagger.getCurrentTag = function(id) {
        var tag = {entity: null, struct: null};
        if (id != null) {
            if (w.entitiesManager.getEntity(id) !== undefined) tag.entity = w.entitiesManager.getEntity(id);
            else if (w.structs[id]) tag.struct = $('#'+id, w.editor.getBody());
        } else {
            if (w.entitiesManager.getCurrentEntity() != null) tag.entity = w.entitiesManager.getEntity(w.entitiesManager.getCurrentEntity());
            else if (w.editor.currentStruct != null) tag.struct = $('#'+w.editor.currentStruct, w.editor.getBody());
        }
        return tag;
    };
    
    // a general edit function for entities and structure tags
    tagger.editTag = function(id) {
        var tag = tagger.getCurrentTag(id);
        if (tag.entity) {
            w.editor.currentBookmark = w.editor.selection.getBookmark(1);
            var type = tag.entity.getType();
            w.dialogManager.show(type, {type: type, entry: tag.entity});
        } else if (tag.struct) {
            if ($(tag.struct, w.editor.getBody()).attr('_tag')) {
                w.dialogManager.getDialog('schemaTags').editSchemaTag(tag.struct);
            } else {
                alert('Tag not recognized!');
            }
        }
    };
    
    /**
     * Changes the _tag attribute to a new one.
     * @param {jQuery} $tag A jQuery representation of the tag.
     * @param {String} newTagName The name of the new tag.
     */
    tagger.changeTagValue = function($tag, newTagName) {
        var oldAtts = $tag[0].attributes;
        var newAtts = {};
        for (var i = 0; i < oldAtts.length; i++) {
            var att = oldAtts[i];
            var val = att.value;
            if (att.name === '_tag') {
                val = newTagName;
            }
            newAtts[att.name] = val;
        }
        tagger.editStructureTag($tag, newAtts);
    };
    
    // a general change/replace function
    tagger.changeTag = function(params) {
        var tag = tagger.getCurrentTag(params.id);
        if (tag.entity) {
            w.dialogManager.confirm({
                title: 'Remove Entity?',
                msg: 'Changing this tag will remove the associated annotation. Do you want to proceed?',
                callback: function(yes) {
                    if (yes) {
                        var node = $('#'+tag.entity.id+',[name="'+tag.entity.id+'"]', w.editor.getBody()).first();
                        node.wrapInner('<span id="tempSelection"/>');
                        tagger.removeEntity(tag.entity.id);
                        var selectionContents = $('#tempSelection', w.editor.getBody());
                        var parentTag = selectionContents.parent();
                        w.editor.selection.select(selectionContents[0].firstChild);
                        w.editor.currentBookmark = w.editor.selection.getBookmark();
                        selectionContents.contents().unwrap();
                        w.dialogManager.getDialog('schemaTags').addSchemaTag({key: params.key, parentTag: parentTag});
                    }
                }
            });
        } else if (tag.struct) {
            if ($(tag.struct, w.editor.getBody()).attr('_tag')) {
                w.dialogManager.getDialog('schemaTags').changeSchemaTag({tag: tag.struct, key: params.key});
            }
        } 
    };
    
    tagger.splitTag = function() {
        var range = w.editor.selection.getRng(true);
        
        if (range.startContainer.nodeType === Node.TEXT_NODE) {
            var textNode = range.startContainer;
            var parent = textNode.parentNode;
            
            if (parent.getAttribute('_entity') != 'true') {
                
                var wrapString = '<'+parent.nodeName.toLowerCase();
                for (var i = 0; i < parent.attributes.length; i++) {
                    var attr = parent.attributes[i];
                    if (attr.name !== 'id') {
                        wrapString += ' '+attr.name+'="'+attr.value+'"';
                    }
                }
                wrapString += '></'+parent.nodeName.toLowerCase()+'>';
                
                parent.normalize();
                textNode.splitText(range.startOffset);
                var lastChild;
                for (var i = 0; i < parent.childNodes.length; i++) {
                    var child = parent.childNodes[i];
                    if (child.nodeType === Node.TEXT_NODE) {
                        lastChild = $(child).wrap(wrapString);
                    }
                }
                $(parent).contents().unwrap();
                w.editor.selection.setCursorLocation(lastChild[0]); // TODO doesn't work with spans on Chrome (at least)
                
            }
        }
        
    }
    
    tagger.convertTagToEntity = function($tag) {
        if ($tag != null) {
            var xmlString = w.converter.buildXMLString($tag);
            var xmlEl = w.utilities.stringToXML(xmlString).firstChild;

            var type = w.schemaManager.mapper.getEntityTypeForTag(xmlEl);
            var isNote = w.schemaManager.mapper.isEntityTypeNote(type);
            var info = w.schemaManager.mapper.getReverseMapping(xmlEl, type);

            if (isNote) {
                if (info.properties === undefined) {
                    info.properties = {};
                }
                info.properties.content = $tag.text();
                info.properties.noteContent = $tag.html();
            }

            var ref = $tag.attr('ref'); // matches ref or REF. FIXME hardcoded ref attribute
            var id = $tag.attr('id');

            w.selectElementById(id, !isNote);
            if (isNote) {
                // place the selection outside of the note tag
                w.editor.selection.collapse(false);
            }

            w.editor.currentBookmark = w.editor.selection.getBookmark(1);
            var newId = tagger.finalizeEntity(type, info);

            tagger.removeStructureTag(id, isNote); // TODO re-add structure tag if conversion was cancelled

            if (ref == null) {
                var tag = w.entitiesManager.getEntity(newId);
                w.editor.currentBookmark = w.editor.selection.getBookmark(1);
                var type = tag.getType();
                w.dialogManager.show(type, {type: type, entry: tag, convertedEntity: true});
            }
        }
    };
    
    /**
     * A general removal function for entities and structure tags
     * @param {String} id The id of the tag to remove
     */
    tagger.removeTag = function(id) {
        if (id != null) {
            if (w.entitiesManager.getEntity(id) !== undefined) {
                tagger.removeEntity(id);
            } else if (w.structs[id]) {
                tagger.removeStructureTag(id);
            }
        } else {
            if (w.entitiesManager.getCurrentEntity() != null) {
                tagger.removeEntity(w.entitiesManager.getCurrentEntity());
            } else if (w.editor.currentStruct != null) {
                tagger.removeStructureTag(w.editor.currentStruct);
            }
        }
    };
    
    /**
     * @param {String} id The id of the struct tag or entity to copy
     */
    tagger.copyTag = function(id) {
        var tag = tagger.getCurrentTag(id);
        if (tag.entity) {
            var clone;
            if (tag.entity.isNote()) {
                clone = $('#'+tag.entity.getId(), w.editor.getBody()).parent('.noteWrapper').clone(true);
            } else {
                clone = $('#'+tag.entity.getId(), w.editor.getBody()).clone();
            }
            w.editor.copiedEntity = clone[0];
        } else if (tag.struct) {
            var clone = $(tag.struct, w.editor.getBody()).clone();
            w.editor.copiedElement.element = clone[0];
            w.editor.copiedElement.selectionType = 0; // tag & contents copied
        }
    };
    
    /**
     * Pastes a previously copied tag
     * @fires Writer#contentChanged
     */
    tagger.pasteTag = function() {
        _doPaste(w.editor.copiedElement.element);
        w.editor.copiedElement = {selectionType: null, element: null};
    }

    /**
     * Performs a paste using the specified element at the current cursor point
     * @param {Element} element
     */
    function _doPaste (element) {
        if (element != null) {
            w.editor.selection.moveToBookmark(w.editor.currentBookmark);
            var sel = w.editor.selection;
            sel.collapse();
            var rng = sel.getRng(true);
            rng.insertNode(element);
            
            tagger.findDuplicateTags();
            
            w.editor.isNotDirty = false;
            w.event('contentChanged').publish(); // don't use contentPasted since we don't want to trigger copyPaste dialog
        }
    }
    
    /**
     * Displays the appropriate dialog for adding an entity
     * @param {String} type The entity type
     * @param {String} [tag] The element name
     */
    tagger.addEntity = function(type, tag) {
        var requiresSelection = w.schemaManager.mapper.doesEntityRequireSelection(type);
        var result;
        if (!requiresSelection && w.editor.selection.isCollapsed()) {
            result = w.VALID;
        } else {
            result = w.utilities.isSelectionValid(false);
        }
        if (result === w.NO_SELECTION) {
            w.dialogManager.show('message', {
                title: 'Error',
                msg: 'Please select some text before adding an entity.',
                type: 'error'
            });
        } else {
            w.editor.currentBookmark = w.editor.selection.getBookmark(1);
            if (result === w.VALID) {
                var childName;
                if (tag !== undefined) {
                    childName = tag;
                } else {
                    childName = w.schemaManager.mapper.getParentTag(type);
                }
                var validParents = w.utilities.getParentsForTag({tag: childName, returnType: 'names'});
                var parentTag = w.editor.currentBookmark.rng.commonAncestorContainer;
                while (parentTag.nodeType !== Node.ELEMENT_NODE) {
                    parentTag = parentTag.parentNode;
                }
                var parentName = parentTag.getAttribute('_tag');
                var isValid = validParents.indexOf(parentName) !== -1;
                if (isValid) {
                    w.dialogManager.show(type, {type: type});
                } else {
                    w.dialogManager.show('message', {
                        title: 'Invalid XML',
                        msg: 'The element <b>'+childName+'</b> is not a valid child of <b>'+parentName+'</b>.<br/><br/>Valid parents for '+childName+' are:<br/><ul><li>'+validParents.join('</li><li>')+'</ul>',
                        type: 'error'
                    });
                }
            } else if (result === w.OVERLAP) {
                if (w.allowOverlap === true) {
                    w.dialogManager.show(type, {type: type});
                } else {
                    w.dialogManager.confirm({
                        title: 'Warning',
                        msg: 'You are attempting to create overlapping entities or to create an entity across sibling XML tags, which is not allowed in this editor mode.<br/><br/>If you wish to continue, the editor mode will be switched to <b>XML and RDF (Overlapping Entities)</b> and only RDF will be created for the entity you intend to add.<br/><br/>Do you wish to continue?',
                        callback: function(confirmed) {
                            if (confirmed) {
                                w.allowOverlap = true;
                                w.mode = w.XMLRDF;
                                w.dialogManager.show(type, {type: type});
                            }
                        }
                    });
                }
            }
        }
    };
    
    /**
     * Updates the tag and infos for an entity.
     * @param {Entity} entity
     * @param {Object} info The info object
     * @param {Object} info.attributes Key/value pairs of attributes
     * @param {Object} info.properties Key/value pairs of Entity properties
     * @param {Object} info.cwrcInfo CWRC lookup info
     * @param {Object} info.customValues Any additional custom values
     */
    function updateEntityInfo(entity, info) {
        var id = entity.getId();
        
        // add attributes to tag
        var tag = $('[name='+id+'][_tag]', w.editor.getBody());
        if (tag.length === 1) {
            for (var key in info.attributes) {
                if (w.converter.reservedAttributes[key] !== true) {
                    var val = info.attributes[key];
                    tag.attr(key, w.utilities.escapeHTMLString(val));
                }
            }
        }
        
        // the following is mostly here to support TEI keyword entities
        if (info.properties.content !== undefined && info.properties.content !== entity.getContent()) {
            if (entity.isNote()) {
                var textTag = w.schemaManager.mapper.getTextTag(entity.getType());
                tag.find('[_tag='+textTag+']').text(info.properties.content);
            }
        }

        sanitizeObject(info.attributes);
        sanitizeObject(info.customValues);
        
        // set attributes
        entity.setAttributes(info.attributes);
        delete info.attributes;
        
        // set properties
        if (info.properties !== undefined) {
            for (var key in info.properties) {
                if (entity.hasOwnProperty(key)) {
                    entity[key] = info.properties[key];
                }
            }
        }
        
        // set lookup info
        if (info.cwrcInfo !== undefined) {
            entity.setLookupInfo(info.cwrcInfo);
            delete info.cwrcInfo;
        }
        
        // set custom values
        for (var key in info.customValues) {
            entity.setCustomValue(key, info.customValues[key]);
        }
    }
    
    /**
     * Converts string values of this object into valid XML strings
     * @param {Object} obj The object of strings/arrays/objects
     */
    function sanitizeObject(obj) {
        for (var key in obj) {
            var val = obj[key];
            if ($.isArray(val)) {
                for (var i = 0; i < val.length; i++) {
                    obj[key][i] = w.utilities.convertTextForExport(val[i]);
                }
            } else if ($.isPlainObject(val)) {
                for (var subkey in val) {
                    obj[key][subkey] = w.utilities.convertTextForExport(val[subkey]);
                }
            } else {
                obj[key] = w.utilities.convertTextForExport(val);
            }
        }
    }
    
    /**
     * Add the remaining entity info to its entry
     * @protected
     * @param {String} type Then entity type
     * @param {Object} info The entity info
     * @returns {String} id The new entity ID
     */
    tagger.finalizeEntity = function(type, info) {
        if (info != null) {
            var id = w.getUniqueId('ent_');
            
            sanitizeObject(info.attributes);
            sanitizeObject(info.customValues);

            w.editor.selection.moveToBookmark(w.editor.currentBookmark);
            var sel = w.editor.selection;
            var range = sel.getRng(true);
            var content = sel.getContent();

            var config = {
                id: id,
                type: type,
                isNote: w.schemaManager.mapper.isEntityTypeNote(type),
                content: content,
                tag: w.schemaManager.mapper.getParentTag(type),
                attributes: info.attributes,
                customValues: info.customValues,
                cwrcLookupInfo: info.cwrcInfo
            };

            if (info.properties && info.properties.noteContent) {
                if (info.properties.content === undefined || info.properties.content === '') {
                    info.properties.content = info.properties.noteContent;
                }
            }
            $.extend(config, info.properties);

            // create entity here so we can set content properly before adding it to the manager
            var entity = new Entity(config);
            
            tagger.addEntityTag(entity, range);
            var entry = w.entitiesManager.addEntity(entity);

            $.when(
                w.utilities.getUriForEntity(entry),
                w.utilities.getUriForAnnotation(),
                w.utilities.getUriForDocument(),
                w.utilities.getUriForTarget(),
                w.utilities.getUriForSelector(),
                w.utilities.getUriForUser()
            ).then(function(entityUri, annoUri, docUri, targetUri, selectorUri, userUri) {
                var lookupInfo = entry.getLookupInfo();
                if (lookupInfo !== undefined && lookupInfo.id) {
                    // use the id already provided
                    entityUri = lookupInfo.id;
                }
                entry.setUris({
                    entityId: entityUri,
                    annotationId: annoUri,
                    docId: docUri,
                    targetId: targetUri,
                    selectorId: selectorUri,
                    userId: userUri
                });
            });
            
            return id;
        }
        w.editor.currentBookmark = null;
        w.editor.focus();
    };
    
    /**
     * Update the entity info
     * @fires Writer#entityEdited
     * @param {String} id The entity id
     * @param {Object} info The entity info
     */
    tagger.editEntity = function(id, info) {
        updateEntityInfo(w.entitiesManager.getEntity(id), info);
        w.editor.isNotDirty = false;
        w.event('entityEdited').publish(id);
    };
    
    /**
     * Paste a previously copied entity
     * @fires Writer#entityPasted
     */
    tagger.pasteEntity = function() {
        _doPaste(w.editor.copiedEntity);
        w.editor.copiedEntity = null;
    };
    
    /**
     * Remove an entity
     * @fires Writer#entityRemoved
     * @param {String} id The entity id
     * @param {Boolean} [removeContents] Remove the contents as well
     */
    tagger.removeEntity = function(id, removeContents) {
        id = id || w.entitiesManager.getCurrentEntity();
        removeContents = removeContents || false;
        
        var entity = w.entitiesManager.getEntity(id);

        var node = $('[name="'+id+'"]', w.editor.getBody());
        var parent = node[0].parentNode;

        if (entity.isNote()) {
            var wrapper = node.parent('.noteWrapper');
            parent = wrapper[0].parentNode;
            wrapper.remove();
        } else {
            if (removeContents) {
                node.remove();
            } else {
                var contents = node.contents();
                if (contents.length > 0) {
                    contents.unwrap();
                } else {
                    node.remove();
                }
            }
        }
        parent.normalize();
        
        w.entitiesManager.removeEntity(id);
        
        w.editor.undoManager.add();
    };
    
    /**
     * Add an entity tag.
     * @param {Entity} entity The entity to tag
     * @param {Range} range The DOM range to apply the tag to
     */
    tagger.addEntityTag = function(entity, range) {
        var id = entity.getId();
        var type = entity.getType();
        var parentTag = entity.getTag();

        if (parentTag === undefined) {
            parentTag = w.schemaManager.mapper.getParentTag(type);
        }

        var tagAttributes = {};
        for (var key in entity.attributes) {
            if (w.converter.reservedAttributes[key] !== true) {
                tagAttributes[key] = w.utilities.escapeHTMLString(entity.attributes[key]);
            }
        }

        if (entity.isNote()) {
            // handling for note type entities
            var tag = w.editor.dom.create(
                'span',
                $.extend(tagAttributes, {
                    '_entity': true, '_note': true, '_tag': parentTag, '_type': type, 'class': 'entity '+type+' start end', 'name': id, 'id': id
                }),
                entity.getNoteContent()
            );

            var sel = w.editor.selection;
            sel.setRng(range);
            if (tinymce.isWebKit) {
                // chrome seems to mess up the range slightly if not set again
                sel.setRng(range);
            }
            sel.collapse(false);
            range = sel.getRng(true);
            range.insertNode(tag);

            tagger.addNoteWrapper(tag, type);
        } else {
            if (range.startContainer.parentNode != range.endContainer.parentNode) {
                var nodes = w.utilities.getNodesInBetween(range.startContainer, range.endContainer);
                
                var startRange = range.cloneRange();
                startRange.setEnd(range.startContainer, range.startContainer.length);
                var start = w.editor.dom.create('span', {
                    '_entity': true, '_type': type, 'class': 'entity '+type+' start', 'name': id
                }, '');
                startRange.surroundContents(start);
                
                $.each(nodes, function(index, node) {
                    $(node).wrap('<span _entity="true" _type="'+type+'" class="entity '+type+'" name="'+id+'" />');
                });
                
                var endRange = range.cloneRange();
                endRange.setStart(range.endContainer, 0);
                var end = w.editor.dom.create('span',{
                    '_entity': true, '_type': type, 'class': 'entity '+type+' end', 'name': id
                }, '');
                endRange.surroundContents(end);
            } else {
                var start = w.editor.dom.create(
                    'span',
                    $.extend(tagAttributes, {
                        '_entity': true, '_tag': parentTag, '_type': type, 'class': 'entity '+type+' start end', 'name': id, 'id': id
                    }),
                    ''
                );
                range.surroundContents(start);
            }
        }
        
        w.editor.undoManager.add();
    };
    
    tagger.addNoteWrapper = function(tag, type) {
        $(tag)
            .wrap('<span class="noteWrapper '+type+'" />')
            .parent().on('click', function(e) {
                var $target = $(e.target);
                if ($target.hasClass('noteWrapper')) {
                    $target.toggleClass('hide');
                }
            });
    };

    /**
     * Adds a structure tag to the document, based on the params.
     * @fires Writer#tagAdded
     * @param params An object with the following properties:
     * @param params.bookmark A tinymce bookmark object, with an optional custom tagId property
     * @param params.attributes Various properties related to the tag
     * @param params.action Where to insert the tag, relative to the bookmark (before, after, around, inside); can also be null
     */
    tagger.addStructureTag = function(params) {
        var bookmark = params.bookmark;
        var attributes = params.attributes;
        var action = params.action;
        
        sanitizeObject(attributes);
        
        var id = w.getUniqueId('struct_');
        attributes.id = id;
        attributes._textallowed = w.utilities.canTagContainText(attributes._tag);
        w.structs[id] = attributes;
        w.editor.currentStruct = id;
        
        var $node;
        if (bookmark.tagId) {
            // this is used when adding tags through the structure tree
            if ($.isArray(bookmark.tagId)) {
                $node = $('#'+bookmark.tagId.join(',#'), w.editor.getBody());
            } else {
                $node = $('#'+bookmark.tagId, w.editor.getBody());
            }
        } else {
            // this is meant for user text selections
            var node = bookmark.rng.commonAncestorContainer;
            while (node.nodeType == Node.TEXT_NODE || (node.nodeType == Node.ELEMENT_NODE && !node.hasAttribute('_tag'))) {
                node = node.parentNode;
            }
            $node = $(node);
        }

        // noteWrapper handling
        var $noteWrapper = null;
        var entityType = w.schemaManager.mapper.getEntityTypeForTag($node.attr('_tag'));
        if (entityType !== null && w.schemaManager.mapper.isEntityTypeNote(entityType)) {
            $noteWrapper = $node.parent('.noteWrapper');
        }
        
        var tagName = w.utilities.getTagForEditor(attributes._tag);
        var open_tag = '<'+tagName;
        for (var key in attributes) {
            if (key === 'id' || key.match(/^_/) != null || w.converter.reservedAttributes[key] !== true) {
                open_tag += ' '+key+'="'+attributes[key]+'"';
            }
        }
        open_tag += '>';
        var close_tag = '</'+tagName+'>';
        
        var selection = '\uFEFF';
        var content = open_tag + selection + close_tag;
        if (action == 'before') {
            if ($noteWrapper !== null) {
                $noteWrapper.before(content);
            } else {
                $node.before(content);
            }
        } else if (action == 'after') {
            if ($noteWrapper !== null) {
                $noteWrapper.after(content);
            } else {
                $node.after(content);
            }
        } else if (action == 'around') {
            if ($node.length > 1) {
                $node.wrapAll(content);
            } else {
                if ($noteWrapper !== null) {
                    $noteWrapper.wrap(content);
                } else {
                    $node.wrap(content);
                }
            }
        } else if (action == 'inside') {
            $node.wrapInner(content);
        } else {
            // default action = add
            w.editor.selection.moveToBookmark(bookmark);
            selection = w.editor.selection.getContent();
            if (selection == '') selection = '\uFEFF';
            content = open_tag + selection + close_tag;

            var range = w.editor.selection.getRng(true);
            var tempNode = $('<span data-mce-bogus="1">', w.editor.getDoc());
            range.surroundContents(tempNode[0]);
            tempNode.replaceWith(content);
        }
        
        var newTag = $('#'+id, w.editor.getBody());
        w.event('tagAdded').publish(newTag[0]);
        
        w.editor.undoManager.add();
        
        if (selection == '\uFEFF') {
            w.selectElementById(id, true);
        } else if (action == undefined) {
            // place the cursor at the end of the tag's contents
            var rng = w.editor.selection.getRng(true);
            rng.selectNodeContents($('#'+id, w.editor.getBody())[0]);
            rng.collapse(false);
            w.editor.selection.setRng(rng);
        }
    };
    
    /**
     * Change the attributes of a tag, or change the tag itself.
     * @fires Writer#tagEdited
     * @param tag {jQuery} A jQuery representation of the tag
     * @param attributes {Object} An object of attribute names and values
     */
    tagger.editStructureTag = function(tag, attributes) {
        // TODO add undo support
        
        sanitizeObject(attributes);
        
        var id = tag.attr('id');
        attributes.id = id;
        
        if (tag.attr('_tag') != attributes._tag) {
            // change the tag
            var tagName;
            if (tag.parent().is('span')) {
                // force inline if parent is inline
                tagName = 'span';
            } else {
                tagName = w.utilities.getTagForEditor(attributes._tag);
            }
            
            tag.contents().unwrap().wrapAll('<'+tagName+' id="'+id+'" />');
            
            tag = $('#'+id, w.editor.getBody());
            for (var key in attributes) {
                if (key.match(/^_/) != null || w.converter.reservedAttributes[key] !== true) {
                    tag.attr(key, attributes[key]);
                }
            }
        } else {
            $.each($(tag[0].attributes), function(index, att) {
                if (w.converter.reservedAttributes[att.name] !== true) {
                    tag.removeAttr(att.name);
                }
            });
            
            for (var key in attributes) {
                if (w.converter.reservedAttributes[key] !== true) {
                    tag.attr(key, attributes[key]);
                }
            }
        }
        
        w.structs[id] = attributes;
        w.event('tagEdited').publish(tag[0]);
    };
    
    /**
     * Remove a structure tag
     * @fires Writer#tagRemoved
     * @param {String} id Then tag id
     * @param {Boolean} [removeContents] True to remove tag contents as well
     */
    tagger.removeStructureTag = function(id, removeContents) {
        id = id || w.editor.currentStruct;
        
        if (removeContents == undefined) {
            if (w.tree && w.tree.currentlySelectedNodes.length > 0 && w.tree.selectionType != null) {
                removeContents = true;
            }
        }

        var node = $('#'+id, w.editor.getBody());
        var entry = w.entitiesManager.getEntity(id);
        if (removeContents) {
            if (entry && entry.isNote()) {
                node.parent('.noteWrapper').remove();
            } else {
                node.remove();
            }
        } else {
            var parent = node.parent();
            var contents = node.contents();
            if (contents.length > 0) {
                contents.unwrap();
            } else {
                node.remove();
            }
            if (entry && entry.isNote()) {
                contents = parent.contents();
                if (contents.length > 0) {
                    contents.unwrap();
                } else {
                    parent.remove();
                }
            }
            parent[0].normalize();
        }
        
        w.editor.undoManager.add();
        
        w.event('tagRemoved').publish(id);
        
        w.editor.currentStruct = null;
    };
    
    /**
     * Remove a structure tag's contents
     * @fires Writer#tagContentsRemoved
     * @param {String} id The tag id
     */
    // TODO refactor this with removeStructureTag
    tagger.removeStructureTagContents = function(id) {
        id = id || w.editor.currentStruct;
        
        var node = $('#'+id, w.editor.getBody());
        node.contents().remove();
        
        w.editor.undoManager.add();
        
        w.event('tagContentsRemoved').publish(id);
    };
    
    w.event('tagRemoved').subscribe(tagger.findNewAndDeletedTags);
    w.event('tagContentsRemoved').subscribe(tagger.findNewAndDeletedTags);
    w.event('contentPasted').subscribe(tagger.findDuplicateTags);
    
    return tagger;
};

module.exports = Tagger;