'use strict';

var $ = require('jquery');
var Entity = require('entity');

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

    // tag insertion types (actions)
    tagger.ADD = 'add';
    tagger.BEFORE = 'before';
    tagger.AFTER = 'after';
    tagger.AROUND = 'around';
    tagger.INSIDE = 'inside';

    // isSelectionValid results
    tagger.NO_SELECTION = 'no_selection';
    tagger.NO_COMMON_PARENT = 'no_common_parent';
    tagger.OVERLAP = 'overlap';
    tagger.VALID = 'valid';

    /**
     * Get a tag by id, or get the currently selected tag.
     * @param {String} [id] The id (optional)
     * @returns {jQuery}
     */
    tagger.getCurrentTag = function(id) {
        if (id != null) {
            var tag = $('#'+id, w.editor.getBody());
            if (tag.length === 0) {
                // look for overlapping entity
                tag = $('[name="'+id+'"]', w.editor.getBody());
            }
            return tag;
        } else {
            return $(w.editor.selection.getNode());
        }
    };

    /**
     * Gets the attributes stored in the _attributes holder.
     * @param {Element} tag
     * @returns {Object}
     */
    tagger.getAttributesForTag = function(tag) {
        var attributes = tag.getAttribute('_attributes');
        if (attributes !== null) {
            var jsonAttrsString = attributes.replace(/&quot;/g, '"');
            var json = JSON.parse(jsonAttrsString);
            return json;
        } else {
            return {};
        }
    }

    /**
     * Adds (non-reserved) attributes to the tag. All attributes get added to the _attributes holder.
     * Overwrites previously set attributes.
     * Assumes the attributes object does not contain CWRC-Writer related attributes, e.g. _tag.
     * @param {Element} tag The tag
     * @param {Object} attributes A name/value map of attributes
     */
    tagger.setAttributesForTag = function(tag, attributes) {
        // remove previous attributes
        var currAttributes = tag.attributes;
        for (var i = currAttributes.length-1; i >=0; i--) {
            var attr = currAttributes[i];
            if (w.converter.reservedAttributes[attr.name] !== true) {
                tag.removeAttribute(attr.name);
            }
        }

        // set non-reserved attributes directly on the tag
        for (var attName in attributes) {
            if (w.converter.reservedAttributes[attName] === true) {
                continue;
            }
            tag.setAttribute(attName, attributes[attName]);
        }

        // set all attributes in the _attributes holder
        var jsonAttrsString = JSON.stringify(attributes).replace(/"/g, '&quot;');
        tag.setAttribute('_attributes', jsonAttrsString);
    }

    /**
     * Similar to setAttributesForTag but doesn't overwrite previously set attributes.
     * @param {Element} tag The tag
     * @param {Object} attributes A name/value map of attributes
     */
    tagger.addAttributesToTag = function(tag, attributes) {
        var currAttrs = tagger.getAttributesForTag(tag);

        for (var attName in attributes) {
            if (w.converter.reservedAttributes[attName] === true) {
                continue;
            }
            var attValue = attributes[attName];
            tag.setAttribute(attName, attValue);
            currAttrs[attName] = attValue;
        }

        var jsonAttrsString = JSON.stringify(currAttrs).replace(/"/g, '&quot;');
        tag.setAttribute('_attributes', jsonAttrsString);
    }
    
/**
     * Displays the appropriate dialog for adding a tag.
     * @param {String} tagName The tag name.
     * @param {String} action The tag insertion type to perform.
     * @param {String} [parentTagId] The id of the parent tag on which to perform the action. Will use editor selection if not provided.
     */
    tagger.addTagDialog = function(tagName, action, parentTagId) {
        if (tagName === w.schemaManager.getHeader()) {
            w.dialogManager.show('header');
            return;
        }

        var tagId = w.editor.currentBookmark.tagId; // set by structureTree
        if (tagId == null) {
            w.editor.selection.moveToBookmark(w.editor.currentBookmark);
            
            var cleanRange = action === tagger.ADD;
            var valid = isSelectionValid(true, cleanRange);
            if (valid !== tagger.VALID) {
                w.dialogManager.show('message', {
                    title: 'Error',
                    msg: 'Please ensure that the beginning and end of your selection have a common parent.<br/>For example, your selection cannot begin in one paragraph and end in another, or begin in bolded text and end outside of that text.',
                    type: 'error'
                });
                return;
            }

            // reset bookmark after possible modification by isSelectionValid
            w.editor.currentBookmark = w.editor.selection.getBookmark(1);
        }
        
        var tagPath = undefined;
        if (Array.isArray(parentTagId)) {
            // TODO multiple parent tags??
        } else if (action === tagger.ADD || action === tagger.INSIDE) { // TODO determine tagPath for other actions
            var parentTag;
            if (parentTagId === undefined) {
                var selectionParent = w.editor.currentBookmark.rng.commonAncestorContainer;
                if (selectionParent.nodeType === Node.TEXT_NODE) {
                    parentTag = $(selectionParent).parent();
                } else {
                    parentTag = $(selectionParent);
                }
            } else {
                parentTag = $('#'+parentTagId, w.editor.getBody());
            }
            tagPath = w.utilities.getElementXPath(parentTag[0]);
            tagPath += '/'+tagName;
        }

        w.dialogManager.getDialog('attributesEditor').show(tagName, tagPath, {}, function(attributes) {
            if (attributes !== null) {
                tagger.addStructureTag(tagName, attributes, w.editor.currentBookmark, action);
            }

            delete w.editor.currentBookmark.tagId;
        });
    }

    /**
     * A general edit function for entities and structure tags.
     * @param {String} id The tag id
     */
    tagger.editTagDialog = function(id) {
        var tag = tagger.getCurrentTag(id);
        if (tag.attr('_entity')) {
            w.editor.currentBookmark = w.editor.selection.getBookmark(1);
            var entry = w.entitiesManager.getEntity(tag.attr('id'));
            if (entry) {
                w.dialogManager.show(entry.getType(), {entry: entry});
            } else {
                console.warn('tagger.editTag: no entry for entity',tag);
            }
        } else {
            var tagName = tag.attr('_tag');
            if (tagName === w.schemaManager.getHeader()) {
                w.dialogManager.show('header');
            } else {
                var tagPath = w.utilities.getElementXPath(tag[0]);
                var attributes = tagger.getAttributesForTag(tag[0]);
                w.dialogManager.getDialog('attributesEditor').show(tagName, tagPath, attributes, function(newAttributes) {
                    if (newAttributes !== null) {
                        tagger.editStructureTag(tag, newAttributes);
                    }
                });
            }
        }
    };
    
    /**
     * A general change/replace function
     * @param {String} tagName The new tag name
     * @param {String} [id] The tag id. If undefined, will get the currently selected tag.
     */
    tagger.changeTagDialog = function(tagName, id) {
        var tag = tagger.getCurrentTag(id);
        if (tag.attr('_entity')) {
            w.dialogManager.confirm({
                title: 'Remove Entity?',
                msg: 'Changing this tag will remove the associated annotation. Do you want to proceed?',
                showConfirmKey: 'confirm-change-tag-remove-entity',
                type: 'info',
                callback: function(yes) {
                    if (yes) {
                        var newTag = tagger.removeEntity(id);
                        var tagPath = w.utilities.getElementXPath(newTag.parentElement);
                        tagPath += '/'+tagName;
                        var attributes = tagger.getAttributesForTag(newTag);
                        w.dialogManager.getDialog('attributesEditor').show(tagName, tagPath, attributes, function(newAttributes) {
                            if (newAttributes !== null) {
                                tagger.editStructureTag($(newTag), newAttributes, tagName);
                            }
                        });
                    }
                }
            });
        } else {
            var tagPath = w.utilities.getElementXPath(tag.parent()[0]);
            tagPath += '/'+tagName;
            var attributes = tagger.getAttributesForTag(tag[0]);
            w.dialogManager.getDialog('attributesEditor').show(tagName, tagPath, attributes, function(newAttributes) {
                if (newAttributes !== null) {
                    tagger.editStructureTag(tag, newAttributes, tagName);
                }
            });
        } 
    };

    /**
     * Displays the appropriate dialog for adding an entity
     * @param {String} type The entity type
     * @param {String} [tag] The element name
     */
    tagger.addEntityDialog = function(type, tag) {
        var requiresSelection = w.schemaManager.mapper.doesEntityRequireSelection(type);
        var result;
        if (!requiresSelection && w.editor.selection.isCollapsed()) {
            result = tagger.VALID;
        } else {
            result = isSelectionValid(false, true);
        }
        if (result === tagger.NO_SELECTION) {
            w.dialogManager.show('message', {
                title: 'Error',
                msg: 'Please select some text before adding an entity.',
                type: 'error'
            });
        } else {
            w.editor.currentBookmark = w.editor.selection.getBookmark(1);
            if (result === tagger.VALID) {
                var childName;
                if (tag !== undefined) {
                    childName = tag;
                } else {
                    childName = w.schemaManager.mapper.getParentTag(type);
                }
                var parentTag = w.editor.currentBookmark.rng.commonAncestorContainer;
                while (parentTag.nodeType !== Node.ELEMENT_NODE) {
                    parentTag = parentTag.parentNode;
                }
                var parentName = parentTag.getAttribute('_tag');
                var isValid = w.schemaManager.isTagValidChildOfParent(childName, parentName);
                if (isValid) {
                    w.dialogManager.show(type);
                } else {
                    w.dialogManager.show('message', {
                        title: 'Invalid XML',
                        msg: 'You cannot add a '+type+' entity in this location because its element <b>'+childName+'</b> is not a valid child of <b>'+parentName+'</b>.',
                        type: 'error'
                    });
                }
            } else if (result === tagger.OVERLAP) {
                if (w.allowOverlap === true) {
                    w.dialogManager.show(type);
                } else {
                    w.dialogManager.confirm({
                        title: 'Warning',
                        msg: '<p>You are attempting to create overlapping entities or to create an entity across sibling XML tags, which is not allowed in this editor mode.</p>'+
                        '<p>If you wish to continue, the editor mode will be switched to <b>XML and RDF (Overlapping Entities)</b> and only RDF will be created for the entity you intend to add.</p>'+
                        '<p>Do you wish to continue?</p>',
                        showConfirmKey: 'confirm-overlapping-entities',
                        type: 'info',
                        height: 350,
                        callback: function(confirmed) {
                            if (confirmed) {
                                w.allowOverlap = true;
                                w.mode = w.XMLRDF;
                                w.dialogManager.show(type);
                            }
                        }
                    });
                }
            }
        }
    };

    /**
     * A general removal function for entities and structure tags
     * @param {String} [id] The id of the tag to remove
     */
    tagger.removeTag = function(id) {
        var $tag = tagger.getCurrentTag(id);
        if ($tag.attr('_entity')) {
            tagger.removeEntity(id);
        } else {
            tagger.removeStructureTag(id);
        }
    };
    
    /**
     * @param {String} id The id of the struct tag or entity to copy
     */
    tagger.copyTag = function(id) {
        var tag = tagger.getCurrentTag(id);
        if (tag.attr('_entity')) {
            var clone;
            if (tag.attr('_note')) {
                clone = tag.parent('.noteWrapper').clone(true);
            } else {
                clone = tag.clone();
            }
            w.editor.copiedEntity = clone[0];
        } else {
            var clone = tag.clone();
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
     * Split a tag in two based on the current text selection.
     */
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
                $(parent).contents().each(function(index, el) {
                    el.setAttribute('id', w.getUniqueId('dom_'));
                }).unwrap();
                w.editor.selection.setCursorLocation(lastChild[0]); // TODO doesn't work with spans on Chrome (at least)

                w.editor.undoManager.add();
                w.event('contentChanged').publish();
            } else {
                console.warn('tagger.splitTag: cannot split an entity!');
            }
        } else {
            console.warn('tagger.splitTag: no text selection!');
        }
    }

    /**
     * Merge the contents of multiple tags into the first tag.
     * @param {Array} tags An array of tags (Element or jQuery) to merge
     */
    tagger.mergeTags = function(tags) {
        var newHtml = '';
        var nodesToRemove = [];
        for (var i = 0; i < tags.length; i++) {
            var $tag = $(tags[i]);
            newHtml += $tag.html();
            if (i > 0) {
                nodesToRemove.push('#'+$tag.attr('id'));
            }
        }
        
        $(tags[0]).html(newHtml);
        $(nodesToRemove.join(','), w.editor.getBody()).remove();
        
        w.editor.undoManager.add();
        w.event('contentChanged').publish();
    }

    /**
     * Performs a paste using the specified element at the current cursor point
     * @param {Element} element
     */
    var _doPaste = function(element) {
        if (element != null) {
            w.editor.selection.moveToBookmark(w.editor.currentBookmark);
            var sel = w.editor.selection;
            sel.collapse();
            var rng = sel.getRng(true);
            rng.insertNode(element);

            tagger.processNewContent(element);
            
            w.event('contentChanged').publish(); // don't use contentPasted since we don't want to trigger copyPaste dialog
        }
    }

    /**
     * Process newly added content
     */
    tagger.processNewContent = function(domContent) {
        var processNewNodes = function(currNode) {
            if (currNode.nodeType === Node.ELEMENT_NODE) {
                if (currNode.hasAttribute('_tag')) {
                    var oldId = currNode.getAttribute('id');

                    var newId = w.getUniqueId('dom_');
                    currNode.setAttribute('id', newId);

                    if (currNode.hasAttribute('_entity')) {
                        currNode.setAttribute('name', newId);

                        var oldEntity = w.entitiesManager.getEntity(oldId);
                        if (oldEntity !== undefined) {
                            var newEntity = oldEntity.clone();
                            newEntity.setId(newId);
                            w.entitiesManager.setEntity(newId, newEntity);
                        } else {
                            console.warn('processNewContent: copied entity tag had no Entity to clone for',oldId);
                            w.entitiesManager.addEntity({
                                id: newId,
                                tag: currNode.getAttribute('_tag'),
                                type: currNode.getAttribute('_type')
                            });
                        }
                    }
                }
            }
            for (var i = 0; i < currNode.childNodes.length; i++) {
                processNewNodes(currNode.childNodes[i]);
            }
        }

        processNewNodes(domContent);

        // TODO overlapping entities handling
        /*
        w.entitiesManager.eachEntity(function(id, entity) {
            var match = $('[name="'+id+'"]', w.editor.getBody());
            if (match.length > 1) {
                match.each(function(index, el) {
                    if (index > 0) {
                        var newEntity = w.entitiesManager.cloneEntity(id);
                        var newId = newEntity.getId();
                        w.entitiesManager.setEntity(newId, newEntity);
                        
                        var newTagStart = $(el);
                        var newTags = getCorrespondingEntityTags(newTagStart);
                        
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
        */
    };
    
    /**
     * Converts string values of this object into valid XML strings
     * @param {Object} obj The object of strings/arrays/objects
     * @param {Boolean} isAttributes Are these attributes?
     */
    var sanitizeObject = function(obj, isAttributes) {
        for (var key in obj) {
            var val = obj[key];
            if ($.isArray(val)) {
                for (var i = 0; i < val.length; i++) {
                    obj[key][i] = w.utilities.convertTextForExport(val[i], isAttributes);
                }
            } else if ($.isPlainObject(val)) {
                for (var subkey in val) {
                    obj[key][subkey] = w.utilities.convertTextForExport(val[subkey], isAttributes);
                }
            } else {
                obj[key] = w.utilities.convertTextForExport(val, isAttributes);
            }
        }
    }
    
    /**
     * Add the remaining entity info to its entry
     * @protected
     * @param {String} type Then entity type
     * @param {Object} info The entity info
     */
    tagger.finalizeEntity = function(type, info) {
        var isNamedEntity = w.schemaManager.mapper.isNamedEntity(type);
        var tagName = w.schemaManager.mapper.getParentTag(type);

        sanitizeObject(info.attributes, true);
        sanitizeObject(info.customValues, false);

        if (!isNamedEntity || (isNamedEntity && info.properties.uri)) {
            var config = {
                id: w.getUniqueId('dom_'),
                type: type,
                isNote: w.schemaManager.mapper.isEntityTypeNote(type),
                isNamedEntity: isNamedEntity,
                tag: tagName,
                attributes: info.attributes,
                customValues: info.customValues
            };

            if (info.properties && info.properties.noteContent) {
                if (info.properties.content === undefined || info.properties.content === '') {
                    info.properties.content = info.properties.noteContent;
                }
            }
            $.extend(config, info.properties);

            var entity = new Entity(config);

            w.schemaManager.mapper.updatePropertiesFromAttributes(entity);

            w.editor.selection.moveToBookmark(w.editor.currentBookmark);
            var range = w.editor.selection.getRng(true);
            tagger.addEntityTag(entity, range);

            w.entitiesManager.addEntity(entity);
        } else {
            tagger.addStructureTag(tagName, info.attributes, w.editor.currentBookmark, tagger.ADD);
        }

        // TODO is this necessary?
        w.editor.currentBookmark = null;
        w.editor.focus();
    };
    
    /**
     * Update the entity info
     * @fires Writer#entityEdited
     * @param {String} id The entity id
     * @param {Object} info The entity info
     * @param {Object} info.attributes Key/value pairs of attributes
     * @param {Object} info.properties Key/value pairs of Entity properties
     * @param {Object} info.customValues Any additional custom values
     */
    tagger.editEntity = function(id, info) {
        sanitizeObject(info.attributes, true);
        sanitizeObject(info.customValues, false);

        var entity = w.entitiesManager.getEntity(id);

        var $tag = $('[name='+id+']', w.editor.getBody());

        // set attributes
        entity.setAttributes(info.attributes);
        tagger.setAttributesForTag($tag[0], info.attributes);

        // named entity check
        var isNamedEntity = w.schemaManager.mapper.isNamedEntity(entity.getType());
        var uriAttribute = w.schemaManager.mapper.getAttributeForProperty(entity.getType(), 'uri');
        var removeEntity = isNamedEntity && info.attributes[uriAttribute] === undefined;

        if (removeEntity) {
            tagger.removeEntity(id);
        } else {
            // set properties
            if (info.properties !== undefined) {
                for (var key in info.properties) {
                    entity.setProperty(key, info.properties[key]);
                }
            }

            w.schemaManager.mapper.updatePropertiesFromAttributes(entity);
            
            // set custom values
            for (var key in info.customValues) {
                entity.setCustomValue(key, info.customValues[key]);
            }

            $tag.attr('_tag', entity.getTag());
            $tag.attr('_type', entity.getType());
            $tag.attr('class', 'entity start end '+entity.getType());
            
            // TODO rework the use of textTag so that this actually works
            // if (info.properties.content !== undefined && info.properties.content !== entity.getContent()) {
            //     if (entity.isNote()) {
            //         var textTag = w.schemaManager.mapper.getTextTag(entity.getType());
            //         $tag.find('[_tag='+textTag+']').text(info.properties.content);
            //     }
            // }

            w.event('entityEdited').publish(id);
        }
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
     * Removes the entity annotation and converts the entity back to a tag.
     * @fires Writer#entityRemoved
     * @param {String} entityId
     * @returns {Element} The tag
     */
    tagger.removeEntity = function(entityId) {
        entityId = entityId || w.entitiesManager.getCurrentEntity();

        var entity = w.entitiesManager.getEntity(entityId);

        var $tag = $('#'+entityId, w.editor.getBody());

        var tagName = $tag.attr('_tag');
        var attributes = tagger.getAttributesForTag($tag[0]);

        var hasSelection = w.editor.selection.getRng(true).collapsed === false;

        if (entity.isNote()) {
            tagger.removeNoteWrapper($tag);
        }

        // replace tag with tempSelection span
        $tag.wrapInner('<span id="tempSelection"/>');
        var $temp = $('#tempSelection', w.editor.getBody());
        $temp.unwrap();

        w.entitiesManager.removeEntity(entityId);
        
        // bookmark temp selection
        var rng = w.editor.selection.getRng(true);
        rng.selectNodeContents($temp[0]);
        w.editor.currentBookmark = w.editor.selection.getBookmark(1);
        
        var newTag = tagger.addStructureTag(tagName, attributes, w.editor.currentBookmark, tagger.ADD);

        var contents = $temp.contents();
        contents.unwrap(); // remove tempSelection span

        if (hasSelection) {
            _doReselect(contents);
        }

        // TODO how to undo this?
        // w.editor.undoManager.add();

        return newTag;
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
                tagAttributes[key] = entity.attributes[key];
            }
        }

        var jsonAttrsString = JSON.stringify(tagAttributes);
        jsonAttrsString = jsonAttrsString.replace(/"/g, '&quot;');

        if (entity.isNote()) {
            var noteContent = w.utilities.convertTextForExport(entity.getNoteContent());

            // var textTag = w.schemaManager.mapper.getTextTag(entity.getType());
            // if (textTag) {
            //     var textTagId = w.getUniqueId('dom_');
            //     noteContent = '<span id="'+textTagId+'" _tag="'+textTag+'">'+noteContent+'</span>';
            // }

            var tag = w.editor.dom.create(
                'span',
                $.extend(tagAttributes, {
                    '_entity': true, '_note': true, '_tag': parentTag, '_type': type, 'class': 'entity '+type+' start end', 'name': id, 'id': id, '_attributes': jsonAttrsString
                }),
                noteContent
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
                var nodes = getNodesInBetween(range.startContainer, range.endContainer, NodeFilter.SHOW_TEXT);
                
                var startRange = range.cloneRange();
                startRange.setEnd(range.startContainer, range.startContainer.length);
                var start = w.editor.dom.create('span', {
                    '_entity': true, '_type': type, 'class': 'entity '+type+' start', 'name': id, '_attributes': jsonAttrsString
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
                        '_entity': true, '_tag': parentTag, '_type': type, 'class': 'entity '+type+' start end', 'name': id, 'id': id, '_attributes': jsonAttrsString
                    }),
                    ''
                );
                range.surroundContents(start);
            }
        }
        
        w.editor.undoManager.add();
    };

    /**
     * Get the entity boundary tag (and potential inbetween tags) that corresponds to the passed tag.
     * @param {element} tag
     * @returns {jQuery}
     */
    var getCorrespondingEntityTags = function(tag) {
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
     * Returns an array of the nodes in between the specified start and end nodes
     * @param {Node} start The start node
     * @param {Node} end The end node
     * @param {NodeFilter} [filter] The NodeFilter, defaults to NodeFilter.SHOW_ALL
     */
    var getNodesInBetween = function(start, end, filter) {
        filter = filter == undefined ? NodeFilter.SHOW_ALL : filter;

        var nodes = [];
        
        var walker = start.ownerDocument.createTreeWalker(start.ownerDocument, filter, null, false);
        walker.currentNode = start;
        while (walker.nextNode()) {
            if (walker.currentNode === end) {
                break;
            }
            nodes.push(walker.currentNode);
        }

        // nodes = nodes.filter(function(n) {
        //     if (n.nodeType === Node.ELEMENT_NODE) {
        //         if ((filterEntities && n.getAttribute('_entity')) ||
        //             n.getAttribute('data-mce-bogus')) {
        //             return false;
        //         }
        //     }
        //     return true;
        // });

        return nodes;
    };
    
    tagger.addNoteWrapper = function(tag, type) {
        $(tag)
            .filter(':visible') // don't add to invisible tags
            .wrap('<span class="noteWrapper '+type+'" />')
            .parent().on('click', function(e) {
                var $target = $(e.target);
                if ($target.hasClass('noteWrapper')) {
                    $target.toggleClass('hide');
                }
            });
    };

    tagger.addNoteWrappersForEntities = function() {
        w.entitiesManager.eachEntity(function(id, entity) {
            if (entity.isNote()) {
                var note = $('#'+id, w.editor.getBody());
                tagger.addNoteWrapper(note, entity.getType());
            }
        });
    }

    tagger.removeNoteWrapper = function(tag) {
        $(tag).unwrap('.noteWrapper');
    }

    // remove all the noteWrapper elements.
    // needed when running evaluateXPath on cwrc docs and used in conjunction with addNoteWrappersForEntities.
    tagger.removeNoteWrappersForEntities = function() {
        w.entitiesManager.eachEntity(function(id, entity) {
            if (entity.isNote()) {
                tagger.removeNoteWrapper($('#'+id, w.editor.getBody()));
            }
        });
    }

    /**
     * Adds a structure tag to the document, based on the params.
     * @fires Writer#tagAdded
     * @param {String} tagName The tag name
     * @param {Object} attributes The tag attributes
     * @param {Object} bookmark A tinymce bookmark object, with an optional custom tagId property
     * @param {String} action Where to insert the tag, relative to the bookmark (before, after, around, inside); can also be null
     * @returns {Element} The new tag
     */
    tagger.addStructureTag = function(tagName, attributes, bookmark, action) {        
        sanitizeObject(attributes, true);

        var id = w.getUniqueId('dom_');
        
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
        
        var editorTagName = w.schemaManager.getTagForEditor(tagName);
        var open_tag = '<'+editorTagName+' id="'+id+'" _tag="'+tagName+'"'

        var jsonAttrs = {};
        for (var key in attributes) {
            if (w.converter.reservedAttributes[key] !== true) {
                open_tag += ' '+key+'="'+attributes[key]+'"';
            }
            jsonAttrs[key] = attributes[key];

        }
        var jsonAttrsString = JSON.stringify(jsonAttrs);
        jsonAttrsString = jsonAttrsString.replace(/"/g, '&quot;');
        open_tag += ' _attributes="'+jsonAttrsString+'">';

        var close_tag = '</'+editorTagName+'>';
        
        var selection = '\uFEFF';
        var content = open_tag + selection + close_tag;

        switch(action) {
            case tagger.BEFORE:
                if ($noteWrapper !== null) {
                    $noteWrapper.before(content);
                } else {
                    $node.before(content);
                }
                break;
            case tagger.AFTER:
                if ($noteWrapper !== null) {
                    $noteWrapper.after(content);
                } else {
                    $node.after(content);
                }
                break;
            case tagger.AROUND:
                if ($node.length > 1) {
                    $node.wrapAll(content);
                } else {
                    if ($noteWrapper !== null) {
                        $noteWrapper.wrap(content);
                    } else {
                        $node.wrap(content);
                    }
                }
                break;
            case tagger.INSIDE:
                $node.wrapInner(content);
                break;
            default:
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
            w.utilities.selectElementById(id, true);
        } else if (action == undefined) {
            // place the cursor at the end of the tag's contents
            var rng = w.editor.selection.getRng(true);
            rng.selectNodeContents($('#'+id, w.editor.getBody())[0]);
            rng.collapse(false);
            w.editor.selection.setRng(rng);
        }

        return newTag[0];
    };
    
    /**
     * Change the attributes of a tag, or change the tag itself.
     * @fires Writer#tagEdited
     * @param tag {jQuery} A jQuery representation of the tag
     * @param attributes {Object} An object of attribute names and values
     * @param [tagName] {String} A new tag name for this tag (optional)
     */
    tagger.editStructureTag = function(tag, attributes, tagName) {
        sanitizeObject(attributes, true);
        
        var id = tag.attr('id');
        
        if (tagName !== undefined && tagName !== tag.attr('_tag')) {
            // change the tag
            var editorTagName;
            if (tag.parent().is('span')) {
                // force inline if parent is inline
                editorTagName = 'span';
            } else {
                editorTagName = w.schemaManager.getTagForEditor(tagName);
            }
            
            tag.contents().unwrap().wrapAll('<'+editorTagName+' id="'+id+'" _tag="'+tagName+'"/>');
            
            tag = $('#'+id, w.editor.getBody());
        }

        tagger.setAttributesForTag(tag[0], attributes);
        
        w.event('tagEdited').publish(tag[0]);
    };
    
    /**
     * Remove a structure tag
     * @fires Writer#tagRemoved
     * @param {String} [id] The tag id
     * @param {Boolean} [removeContents] True to remove tag contents as well
     */
    tagger.removeStructureTag = function(id, removeContents) {
        if (removeContents == undefined) {
            if (w.tree && w.tree.currentlySelectedNodes.length > 0 && w.tree.selectionType != null) {
                removeContents = true;
            } else {
                removeContents = false;
            }
        }

        var tag = tagger.getCurrentTag(id);
        var entry = w.entitiesManager.getEntity(id);
        id = tag.attr('id');

        if (removeContents) {
            if (entry && entry.isNote()) {
                tagger.processRemovedContent(tag.parent('.noteWrapper')[0]);
                tag.parent('.noteWrapper').remove();
            } else {
                tagger.processRemovedContent(tag[0]);
                tag.remove();
            }
        } else {
            tagger.processRemovedContent(tag[0], false);

            var hasSelection = w.editor.selection.getRng(true).collapsed === false;

            var parent = tag.parent();
            var contents = tag.contents();
            if (contents.length > 0) {
                contents.unwrap();
            } else {
                tag.remove();
            }

            if (entry && entry.isNote()) {
                tagger.processRemovedContent(parent[0], false);
                contents = parent.contents();
                if (contents.length > 0) {
                    contents.unwrap();
                } else {
                    parent.remove();
                }
            }

            if (hasSelection) {
                _doReselect(contents);
            }

            parent[0].normalize();
        }
        
        w.editor.undoManager.add();
        
        w.event('tagRemoved').publish(id);
    };
    
    /**
     * Remove a structure tag's contents
     * @fires Writer#tagContentsRemoved
     * @param {String} [id] The tag id
     */
    tagger.removeStructureTagContents = function(id) {
        var tag = tagger.getCurrentTag(id);
        tag.contents().each(function(i, el) {
            tagger.processRemovedContent(el);
        }).remove();

        tag[0].textContent = '\uFEFF'; // insert zero-width non-breaking space so that empty tag isn't cleaned up by tinymce
        
        w.editor.undoManager.add();
        
        w.event('tagContentsRemoved').publish(id);
    };

    /**
     * Look for removed entities
     * @param {Element|Range} domContent
     * @param {Boolean} [processChildren] True to also process the children of domContent. Defaults to true.
     */
    tagger.processRemovedContent = function(domContent, processChildren) {
        processChildren = processChildren == undefined ? true : processChildren;

        var processRemovedNodes = function(currNode) {
            if (currNode.nodeType === Node.ELEMENT_NODE) {
                if (currNode.hasAttribute('_tag') && currNode.hasAttribute('_entity')) {
                    var id = currNode.getAttribute('name');
                    console.log('entity will be removed', id);
                    w.entitiesManager.removeEntity(id);
                }
            }
            if (processChildren) {
                for (var i = 0; i < currNode.childNodes.length; i++) {
                    processRemovedNodes(currNode.childNodes[i]);
                }
            }
        }

        if (domContent.commonAncestorContainer !== undefined) {
            // range
            processChildren = false;
            var nodes = getNodesInBetween(domContent.startContainer, domContent.endContainer);
            nodes.forEach(function(node) {
                processRemovedNodes(node);
            });
        } else {
            processRemovedNodes(domContent);
        }
    }

    /**
     * Re-select the contents of a node that's been removed
     * @param {jQuery} contents A selection of nodes
     */
    var _doReselect = function(contents) {
        var rng = w.editor.selection.getRng(true);
        contents = contents.toArray().filter(function(el) {
            return el.parentNode !== null; // if the node doesn't have a parent then we can't select it
        });

        if (contents.length > 0) {
            if (contents.length === 1) {
                rng.selectNodeContents(contents[0]);
            } else {
                // TODO selecting multiple nodes and then trying to add a tag doesn't work properly yet
                // rng.setStartBefore(contents[0]);
                // rng.setEndAfter(contents[contents.length-1]);
            }
        }
    }

    /**
     * Checks the user selection for overlap issues and entity markers.
     * @param {Boolean} isStructTag Is the tag a structure tag
     * @param {Boolean} cleanRange True to remove extra whitespace and fix text range that spans multiple parents
     * @returns {Integer}
     */
    var isSelectionValid = function(isStructTag, cleanRange) {
        var sel = w.editor.selection;
        
        // disallow empty entities
        if (!isStructTag && sel.isCollapsed()) return tagger.NO_SELECTION;
        
        var range = sel.getRng(true);
        // next line commented out as it messes up the selection in IE
//        range.commonAncestorContainer.normalize(); // normalize/collapse separate text nodes
        
        // fix for select all and root node select
        if (range.commonAncestorContainer.nodeName.toLowerCase() === 'body') {
            var root = w.editor.dom.select('body > *')[0];
            range.setStartBefore(root.firstChild);
            range.setEndAfter(root.lastChild);
        }
        
        function findTextNode(node, direction) {
            function doFind(currNode, dir, reps) {
                if (reps > 20) return null; // prevent infinite recursion
                else {
                    var newNode;
                    if (dir == 'back') {
                        newNode = currNode.lastChild || currNode.previousSibling || currNode.parentNode.previousSibling;
                    } else {
                        newNode = currNode.firstChild || currNode.nextSibling || currNode.parentNode.nextSibling;
                    }
                    if (newNode == null) return null;
                    if (newNode.nodeType == Node.TEXT_NODE) return newNode;
                    return doFind(newNode, dir, reps++);
                }
            }
            return doFind(node, direction, 0);
        }
        
        // TODO rework this
        // fix for when start and/or end containers are element nodes
        if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
            var end = range.endContainer;
            if (end.nodeType != Node.TEXT_NODE || range.endOffset === 0) {
                end = findTextNode(range.endContainer, 'back');
                if (end == null) return tagger.NO_COMMON_PARENT;
                range.setEnd(end, end.length);
            }
            var start = findTextNode(range.startContainer, 'forward'); 
            if (start == null) return tagger.NO_COMMON_PARENT;
            range.setStart(start, 0);
        }
        if (range.endContainer.nodeType === Node.ELEMENT_NODE) {
            // don't need to check nodeType here since we've already ensured startContainer is text
            range.setEnd(range.startContainer, range.startContainer.length);
        }
        
        /**
         * Removes whitespace surrounding the range.
         * Also fixes cases where the range spans adjacent text nodes with different parents.
         */
        function fixRange(range) {
            var content = range.toString();
            var match = content.match(/^\s+/);
            var leadingSpaces = 0, trailingSpaces = 0;
            if (match != null) {
                leadingSpaces = match[0].length;
            }
            match = content.match(/\s+$/);
            if (match != null) {
                trailingSpaces = match[0].length;
            }
            
            function shiftRangeForward(range, count, reps) {
                if (count > 0 && reps < 20) {
                    if (range.startOffset < range.startContainer.length) {
                        range.setStart(range.startContainer, range.startOffset+1);
                        count--;
                    }
                    if (range.startOffset == range.startContainer.length) {
                        var nextTextNode = findTextNode(range.startContainer, 'forward');
                        if (nextTextNode != null) {
                            range.setStart(nextTextNode, 0);
                        }
                    }
                    shiftRangeForward(range, count, reps++);
                }
            }
            
            function shiftRangeBackward(range, count, reps) {
                if (count > 0 && reps < 20) {
                    if (range.endOffset > 0) {
                        range.setEnd(range.endContainer, range.endOffset-1);
                        count--;
                    }
                    if (range.endOffset == 0) {
                        var prevTextNode = findTextNode(range.endContainer, 'back');
                        if (prevTextNode != null) {
                            range.setEnd(prevTextNode, prevTextNode.length);
                        }
                    }
                    shiftRangeBackward(range, count, reps++);
                }
            }
            
            shiftRangeForward(range, leadingSpaces, 0);
            shiftRangeBackward(range, trailingSpaces, 0);
            
            sel.setRng(range);
        }
        
        if (cleanRange) {
            fixRange(range);
        }
        
        // TODO add handling for when inside overlapping entity tags
        if (range.startContainer.parentNode != range.endContainer.parentNode) {
            if (range.endOffset === 0 && range.endContainer.previousSibling === range.startContainer.parentNode) {
                // fix for when the user double-clicks a word that's already been tagged
                range.setEnd(range.startContainer, range.startContainer.length);
            } else {
                if (isStructTag) {
                    return tagger.NO_COMMON_PARENT;
                } else {
                    return tagger.OVERLAP;
                }
            }
        }
        
        // extra check to make sure we're not overlapping with an entity
        if (isStructTag || w.allowOverlap === false) {
            var c;
            var currentNode = range.startContainer;
            var ents = {};
            while (currentNode != range.endContainer) {
                currentNode = currentNode.nextSibling;
                c = $(currentNode);
                if (c.attr('_entity') != null && c.attr('_tag') != null) {
                    if (ents[c.attr('name')]) {
                        delete ents[c.attr('name')];
                    } else {
                        ents[c.attr('name')] = true;
                    }
                }
            }
            var count = 0;
            for (var id in ents) {
                count++;
            }
            if (count != 0) return tagger.OVERLAP;
        }
        
        return tagger.VALID;
    };
    
    return tagger;
};

module.exports = Tagger;