'use strict';

var $ = require('jquery');
var ObjTree = require('objtree');

/**
 * @class Utilities
 * @param {Writer} writer
 */
function Utilities(writer) {
    var w = writer;
    
    // created in and used by convertTextForExport
    var $entitiesConverter;

    var useLocalStorage = false;//supportsLocalStorage();
    
    var BLOCK_TAG = 'div';
    var INLINE_TAG = 'span';
    
    /**
     * @lends Utilities
     */
    var u = {};
    
    u.getBlockTag = function() {
        return BLOCK_TAG;
    }
    
    u.getInlineTag = function() {
        return INLINE_TAG;
    }
    
    u.xmlToString = function(xmlData) {
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
    
    u.stringToXML = function(string) {
        if (window.ActiveXObject) {
            var oXML = new ActiveXObject("Microsoft.XMLDOM");
            oXML.loadXML(string);
            return oXML;
        } else {
            return (new DOMParser()).parseFromString(string, "text/xml");
        }
    };
    
    u.xmlToJSON = function(xml) {
        if ($.type(xml) == 'string') {
            xml = u.stringToXML(xml);
        }
        var xotree = new ObjTree();
        xotree.attr_prefix = '@';
        var json = xotree.parseDOM(xml);
        return json;
    };

    /**
     * Converts HTML entities to unicode, while preserving those that must be escaped as entities.
     * @param {String} text The text to convert
     * @returns {String} The converted text
     */
    u.convertTextForExport = function(text) {
        if ($entitiesConverter === undefined) {
            $entitiesConverter = $('<div style="display: none;"></div>').appendTo(w.layoutManager.getContainer());
        }
        var newText = text;
        if (newText != null) {
            if (newText.match(/&.+?;/gim)) { // match all entities
                $entitiesConverter[0].innerHTML = newText;
                newText = $entitiesConverter[0].innerText || $entitiesConverter[0].firstChild.nodeValue;
            }
            // the following characters must be escaped
            newText = newText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        }
        return newText;
    }
    
    u.addCSS = function(cssHref) {
        var fullHref = w.cwrcRootUrl+cssHref;
        if (document.querySelector('link[rel=stylesheet][href="'+fullHref+'"]')) {
            return;
        }
        $(document.head).append('<link type="text/css" rel="stylesheet" href="'+fullHref+'" />');
    }
    
    /**
     * @param content
     * @returns {String}
     */
    u.getTitleFromContent = function(content) {
        content = content.trim();
        if (content.length <= 34) return content;
        var title = content.substring(0, 34) + '&#8230;';
        return title;
    };
    
    u.getCamelCase = function(str) {
        return str.replace(/(?:^|\s)\w/g, function(match) {
            return match.toUpperCase();
        });
    };
    
    u.escapeHTMLString = function(value) {
        if (typeof value == 'string') {
            return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        } else {
            return value;
        }
    };
    
    u.unescapeHTMLString = function(value) {
        if (typeof value == 'string') {
            return value.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        } else {
            return value;
        }
    };
    
    u.getPreviousTextNode = function(node) {
        function doGet(currNode) {
            var prevNode = currNode.previousSibling;
            if (prevNode == null) {
                prevNode = currNode.parentNode.previousSibling;
                if (prevNode.nodeType == 1) {
                    prevNode = prevNode.lastChild;
                }
            }
            if (prevNode.nodeType == 3) {
                return prevNode;
            } else {
                return doGet(prevNode);
            }
        }
        
        var prevTextNode = doGet(node);
        return prevTextNode;
    };
    
    u.getNextTextNode = function(node) {
        function doGet(currNode) {
            var nextNode = currNode.nextSibling;
            if (nextNode == null) {
                nextNode = currNode.parentNode.nextSibling;
                if (nextNode.nodeType == 1) {
                    nextNode = nextNode.firstChild;
                }
            }
            if (nextNode.nodeType == 3) {
                return nextNode;
            } else {
                return doGet(nextNode);
            }
        }
        
        var nextTextNode = doGet(node);
        return nextTextNode;
    };
    
    /**
     * Returns an array of nodes that exist between the start and end nodes.
     * @param {Element} start The starting node
     * @param {Element} end The ending node
     * @returns {Array}
     */
    u.getNodesInBetween = function(start, end) {
        var nodes = [];
        
        function getChildNodes(parent, childNodes) {
            if (parent.childNodes.length > 0) {
                if (parent.childNodes.length === 1 && parent.childNodes[0].nodeType === Node.TEXT_NODE) {
                    childNodes.push(parent.childNodes[0]);
                } else {
                    for (var i = 0; i < parent.childNodes.length; i++) {
                        getChildNodes(parent.childNodes[i], childNodes);
                    }
                }
            } else {
                childNodes.push(parent);
            }
        }
        
        function doGet(currNode) {
            if($.contains(currNode, end)) {
                var nextNode = null;
                for (var i = 0; i < currNode.childNodes.length; i++) {
                    var child = currNode.childNodes[i];
                    if($.contains(child, end)) {
                        nextNode = child;
                        break;
                    } else if (child === end) {
                        break;
                    } else {
                        var childNodes = [];
                        getChildNodes(child, childNodes);
                        nodes = nodes.concat(childNodes);
                    }
                }
                if (nextNode != null) {
                    doGet(nextNode);
                }
            } else {
                var nextNode = null;
                while (nextNode == null) {
                    nextNode = currNode.nextSibling;
                    if (nextNode == null) {
                        nextNode = currNode.parentNode.nextSibling;
                    }
                    if (nextNode == null) {
                        currNode = currNode.parentNode;
                    }
                }
                if (nextNode === end) {
                    return;
                }
                if ($.contains(nextNode, end) === false) {
                    var childNodes = [];
                    getChildNodes(nextNode, childNodes);
                    nodes = nodes.concat(childNodes);
                }
                doGet(nextNode);
            }
        }
        
        doGet(start);
        
        // filter out entities and bogus nodes
        nodes = nodes.filter(function(n) {
            if (n.nodeType === Node.ELEMENT_NODE && (n.getAttribute('_entity') != null || n.getAttribute('data-mce-bogus') != null)) {
                return false;
            } else {
                return true;
            }
        });
        
        return nodes;
    };
    
    /**
     * Checks the user selection for overlap issues and entity markers.
     * @param isStructTag Is the tag a structure tag
     * @param structAction How is the tag being inserted? (before/after/around/inside)
     * @returns {Integer}
     */
    u.isSelectionValid = function(isStructTag, structAction) {
        var sel = w.editor.selection;
        
        // disallow empty entities
        if (!isStructTag && sel.isCollapsed()) return w.NO_SELECTION;
        
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
                if (end == null) return w.NO_COMMON_PARENT;
                range.setEnd(end, end.length);
            }
            var start = findTextNode(range.startContainer, 'forward'); 
            if (start == null) return w.NO_COMMON_PARENT;
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
        
        if (!structAction) {
            fixRange(range);
        }
        
        // TODO add handling for when inside overlapping entity tags
        if (range.startContainer.parentNode != range.endContainer.parentNode) {
            if (range.endOffset === 0 && range.endContainer.previousSibling === range.startContainer.parentNode) {
                // fix for when the user double-clicks a word that's already been tagged
                range.setEnd(range.startContainer, range.startContainer.length);
            } else {
                if (isStructTag) {
                    return w.NO_COMMON_PARENT;
                } else {
                    return w.OVERLAP;
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
            if (count != 0) return w.OVERLAP;
        }
        
        return w.VALID;
    };

    /**
     * Verifies that the child has a valid parent.
     * @param {String} childName The child tag name
     * @param {String} parentName The parent tag name
     * @return {Boolean}
     */
    u.isTagValidChildOfParent = function(childName, parentName) {
        var validParents = u.getParentsForTag({tag: childName, returnType: 'names'})
        return validParents.indexOf(parentName) !== -1;
    };
    
    /**
     * Check to see if any of the entities overlap.
     * @returns {Boolean}
     */
    u.doEntitiesOverlap = function() {
        // remove highlights
        w.entitiesManager.highlightEntity();
        
        var overlap = false;
        w.entitiesManager.eachEntity(function(id, entity) {
            var markers = w.editor.dom.select('[name="'+id+'"]');
            if (markers.length > 1) {
                var start = markers[0];
                var end = markers[markers.length-1];
                if (start.parentNode !== end.parentNode) {
                    overlap = true;
                    return false; // stop looping through entities
                }
            }
        });
        return overlap;
    };
    
    /**
     * Removes entities that overlap other entities.
     */
    u.removeOverlappingEntities = function() {
        w.entitiesManager.highlightEntity();
        
        w.entitiesManager.eachEntity(function(id, entity) {
            var markers = w.editor.dom.select('[name="'+id+'"]');
            if (markers.length > 1) {
                var start = markers[0];
                var end = markers[markers.length-1];
                if (start.parentNode !== end.parentNode) {
                    w.tagger.removeEntity(id);
                }
            }
        });
    };
    
    /**
     * Converts boundary entities (i.e. entities that overlapped) to tag entities, if possible.
     */
    u.convertBoundaryEntitiesToTags = function() {
        w.entitiesManager.eachEntity(function(id, entity) {
            var markers = w.editor.dom.select('[name="'+id+'"]');
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
                    var $tag = $(w.editor.dom.create('span', {}, ''));
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
        });
    };
    
    u.isTagBlockLevel = function(tagName) {
        if (tagName == w.schemaManager.getRoot()) return true;
        return w.editor.schema.getBlockElements()[tagName] != null;
    };
    
    u.isTagEntity = function(tagName) {
        var type = w.schemaManager.mapper.getEntityTypeForTag(tagName);
        return type != null;
    };
    
    u.getTagForEditor = function(tagName) {
        return u.isTagBlockLevel(tagName) ? BLOCK_TAG : INLINE_TAG;
    };
    
    u.getRootTag = function() {
        return $('[_tag]:first', w.editor.getBody());
    };
    
    u.getDocumentationForTag = function(tag) {
        var element = $('element[name="'+tag+'"]', w.schemaManager.schemaXML);
        var doc = $('a\\:documentation, documentation', element).first().text();
        return doc;
    };
    
    u.getFullNameForTag = function(tag) {
        var element = $('element[name="'+tag+'"]', w.schemaManager.schemaXML);
        var doc = $('a\\:documentation, documentation', element).first().text();
        return getFullNameFromDocumentation(doc);
    };
    
    function getFullNameFromDocumentation(documentation) {
        // if the tag name is an abbreviation, we expect the full name to be at the beginning of the doc, in parentheses
        var hit = /^\((.*?)\)/.exec(documentation);
        if (hit !== null) {
            return hit[1];
        }
        return '';
    }
    
    function supportsLocalStorage() {
        try {
            return 'localStorage' in window && window['localStorage'] !== null;
        } catch (e) {
            return false;
        }
    }
    
    function _queryUp(context, matchingFunc) {
        var continueQuery = true;
        while (continueQuery && context != null) {
            continueQuery = matchingFunc.call(this, context);
            if (continueQuery == undefined) continueQuery = true;
            context = context.$parent;
        }
    }

    /**
     * Moves recursively down a JSON "tree", calling the passed function on each property.
     * Function should return false to stop the recursion.
     * @param {Object} context The starting point for the recursion.
     * @param {Function} matchingFunc The function that's called on each property.
     * @param {Boolean} [processRefs] Automatically process refs, i.e. fetch their definitions
     */
    function _queryDown(context, matchingFunc, processRefs) {
        var continueQuery = true;
        
        var defHits = {};
        
        function doQuery(currContext) {
            if (continueQuery) {
                continueQuery = matchingFunc.call(this, currContext);
                if (continueQuery == undefined) continueQuery = true;
                for (var key in currContext) {
                    
                    // filter out metadata and attributes
                    if (key != '$parent' && key != '$key' && key.search('@') != 0) {
                        
                        var prop = currContext[key];
                        
                        if (processRefs === true && key === 'ref') {
                            var refs;
                            if (isArray(prop)) {
                                refs = prop;
                            } else {
                                refs = [prop];
                            }
                            var defs = [];
                            for (var j = 0; j < refs.length; j++) {
                                var name = refs[j]['@name'];
                                if (defHits[name] === undefined) {
                                    defHits[name] = true;
                                    var def = _getDefinition(name);
                                    doQuery(def);
                                }
                            }
                        } else {
                            if (isArray(prop)) {
                                for (var i = 0; i < prop.length; i++) {
                                    doQuery(prop[i]);
                                }
                            } else if (isObject(prop)) {
                                doQuery(prop);
                            }
                        }
                    }
                }
            } else {
                return;
            }
        }
        
        doQuery(context);
    }

    function _getDefinition(name) {
        var defs = w.schemaManager.schemaJSON.grammar.define;
        for (var i = 0, len = defs.length; i < len; i++) {
            var d = defs[i];
            if (d['@name'] == name) return d;
        }
        return null;
    }

    /**
     * Get the element entries for the element name
     * @param {String} name The element name
     * @returns {Array}
     */
    function _getElementEntries(name) {
        var matches = [];
        _queryDown(w.schemaManager.schemaJSON.grammar, function(item) {
            if (item.$key === 'element' && item['@name'] === name) {
                matches.push(item);
            }
        });
        return matches;
    }

    function isArray(obj) {
        return toString.apply(obj) === '[object Array]';
    }

    function isObject(obj){
        return !!obj && Object.prototype.toString.call(obj) === '[object Object]';
    }
    
    /**
     * @param currEl The element that's currently being processed
     * @param defHits A list of define tags that have already been processed
     * @param level The level of recursion
     * @param type The type of child to search for (element or attribute)
     * @param children The children to return
     */
    function _getChildrenXML(currEl, defHits, level, type, children) {
        // first get the direct types
        currEl.find(type).each(function(index, el) {
            var child = $(el);
            if (child.parents('element').length > 0 && level > 0) {
                return; // don't get elements/attributes from other elements
            }
            var docs = $('a\\:documentation, documentation', child).first().text();
            var fullName = getFullNameFromDocumentation(docs);
            var childObj = {
                name: child.attr('name'),
                fullName: fullName,
                level: level+0,
                documentation: docs
            };
            if (type == 'attribute') {
                childObj.required = child.parent('optional').length == 0;
                // TODO confirm defaultValue is being retrieved, seems like it's only in attributes
                childObj.defaultValue = $('a\\:defaultValue, defaultValue', child).first().text();
                var choice = $('choice', child).first();
                if (choice.length == 1) {
                    var choices = [];
                    $('value', choice).each(function(index, el) {
                        choices.push($(el).text());
                    });
                    childObj.choices = choices;
                }
            }
            children.push(childObj);
        });
        // now process the references
        currEl.find('ref').each(function(index, el) {
            var name = $(el).attr('name');
            if ($(el).parents('element').length > 0 && level > 0) {
                return; // don't get attributes from other elements
            }
            if (!defHits[name]) {
                defHits[name] = true;
                var def = $('define[name="'+name+'"]', w.schemaManager.schemaXML);
                _getChildren(def, defHits, level+1, type, children);
            }
        });
    };
    
    /**
     * @param currEl The element that's currently being processed
     * @param defHits A list of define tags that have already been processed
     * @param level The level of recursion
     * @param type The type of child to search for (element or attribute)
     * @param children The children to return
     * @param refParentProps For storing properties of a ref's parent (e.g. optional), if we're processing the ref's definition
     */
    function _getChildrenJSON(currEl, defHits, level, type, children, refParentProps) {
        // first get the direct types
        var hits = [];
        _queryDown(currEl, function(item) {
            if (item.$key === 'element' && item !== currEl) return false; // we're inside a different element so stop querying down
            
            if (item[type] != null) {
                hits = hits.concat(item[type]); // use concat incase item[type] is an array
            }
        });
        for (var i = 0; i < hits.length; i++) {
            var child = hits[i];
            
            var docs = null;
            _queryDown(child, function(item) {
                if (item['a:documentation']) {
                    docs = item['a:documentation'];
                    return false;
                }
            });
            if (docs != null && docs['#text'] !== undefined) {
                docs = docs['#text'];
            } else if (docs == null) {
                docs = '';
            }
            var fullName = getFullNameFromDocumentation(docs);
            
            if (child.anyName) {
                children.push('anyName');
                return;
            }
            
            var duplicate = false;
            children.every(function(entry, index, array) {
                if (entry.name === child['@name']) {
                    duplicate = true;
                    return false;
                }
                return true;
            });
            
            if (!duplicate) {
                var childObj = {
                    name: child['@name'],
                    fullName: fullName,
                    level: level+0,
                    documentation: docs
                };
                
                if (type == 'element') {
                    if (refParentProps && refParentProps.optional != null) {
                        childObj.required = !refParentProps.optional;
                    } else {
                        childObj.required = false;
                    }
                } else if (type == 'attribute') {
                    if (refParentProps && refParentProps.optional != null) {
                        childObj.required = !refParentProps.optional;
                    } else {
                        childObj.required = true;
                        _queryUp(child.$parent, function(item) {
                            if (item.optional) {
                                childObj.required = false;
                                return false;
                            }
                        });
                    }
                    
                    var defaultVal = null;
                    _queryDown(child, function(item) {
                        if (item['@a:defaultValue']) {
                            defaultVal = item['@a:defaultValue'];
                            return false;
                        }
                    });
                    childObj.defaultValue = defaultVal || '';
                    
                    var choice = null;
                    _queryDown(child, function(item) {
                        if (item.choice) {
                            choice = item.choice;
                            return false;
                        }
                    });
                    if (choice != null) {
                        var choices = [];
                        var values = [];
                        _queryDown(choice, function(item) {
                            if (item.value) {
                                values = item.value;
                            }
                        });
                        for (var j = 0; j < values.length; j++) {
                            var val = values[j];
                            if (val['#text']) {
                                val = val['#text'];
                            }
                            choices.push(val);
                        }
                        childObj.choices = choices;
                    }
                }
                children.push(childObj);
            }
        }
        
        // now process the references
        hits = [];
        _queryDown(currEl, function(item) {
            if (item.$key === 'element' && item !== currEl) return false; // we're inside a different element so stop querying down
            
            if (item.ref) {
                hits = hits.concat(item.ref); // use concat incase item.ref is an array
            }
        });
        
        for (var i = 0; i < hits.length; i++) {
            var ref = hits[i];
            var name = ref['@name'];

            // store optional value
            var optional = null;
            _queryUp(ref, function(item) {
                if (item.$parent && item.$parent.$key) {
                    var parentKey = item.$parent.$key;
                    if (parentKey == 'choice' || parentKey == 'optional' || parentKey == 'zeroOrMore') {
                        // we're taking choice to mean optional, even though it could mean a requirement to choose one or more elements
                        optional = true;
                        return false;
                    } else if (parentKey == 'oneOrMore') {
                        optional = false;
                        return false;
                    }
                }
                return false;
            });
            
            if (!defHits[name]) {
                defHits[name] = true;
                var def = _getDefinition(name);
                _getChildrenJSON(def, defHits, level+1, type, children, {optional: optional});
            }
        }
    }
    
    /**
     * Gets a list from the schema of valid children for a particular tag
     * @param config The config object
     * @param config.tag The element name to get children of
     * @param [config.path] The path to the tag (optional)
     * @param config.type The type of children to get: "element" or "attribute"
     * @param config.returnType Either: "array", "object", "names" (which is an array of just the element names)
     */
    u.getChildrenForTag = function(config) {
        config.type = config.type || 'element';
        var children = [];
        var i;
        
        if (useLocalStorage) {
            var localData = localStorage['cwrc.'+config.tag+'.'+config.type+'.children'];
            if (localData) {
                children = JSON.parse(localData);
            }
        }
        
        if (children.length == 0) {
            var elements = [];
            if (config.path) {
                var element = u.getJsonEntryFromPath(config.path);
                if (element !== null) {
                    elements.push(element);
                }
            } else {
                elements = _getElementEntries(config.tag);
            }
            if (elements.length == 0) {
                console.warn('utilities: cannot find element for '+config.tag);
            } else {
                for (var i = 0; i < elements.length; i++) {
                    var element = elements[i];
                    var defHits = {};
                    var level = 0;
                    _getChildrenJSON(element, defHits, level, config.type, children); 
                    if (children.indexOf('anyName') != -1) {
                        children = [];
                        // anyName means include all elements
                        for (i = 0; i < w.schemaManager.schema.elements.length; i++) {
                            var el = w.schemaManager.schema.elements[i];
                            // TODO need to add more info than just the name
                            children.push({
                                name: el
                            });
                        }
                    }
                }
                
                children.sort(function(a, b) {
                    if (a.name > b.name) return 1;
                    if (a.name < b.name) return -1;
                    return 0;
                });
                
                if (useLocalStorage) {
                    localStorage['cwrc.'+config.tag+'.'+config.type+'.children'] = JSON.stringify(children);
                }
            }
        }
        
        if (config.returnType == 'object') {
            var childrenObj = {};
            for (i = 0; i < children.length; i++) {
                var c = children[i];
                childrenObj[c.name] = c;
            }
            return childrenObj;
        } else if (config.returnType == 'names') {
            var names = [];
            for (i = 0; i < children.length; i++) {
                names.push(children[i].name);
            }
            return names;
        } else {
            return children;
        }
    };
    
    /**
     * Uses a path to find the related entry in the JSON schema.
     * @param {String} path A forward slash delimited pseudo-xpath
     * @returns {Object}
     */
    u.getJsonEntryFromPath = function(path) {
        var context = w.schemaManager.schemaJSON.grammar;
        var match = null;
        
        var tags = path.split('/');
        for (var i = 0; i < tags.length; i++) {
            var tag = tags[i];
            if (tag !== '') {
                tag = tag.replace(/\[\d+\]$/, ''); // remove any indexing
                _queryDown(context, function(item) {
                    if (item['@name'] && item['@name'] === tag) {
                        context = item;
                        if (i === tags.length - 1) {
                            match = item;
                        }
                        return true;
                    }
                }, true);
            }
        }
        return match;
    };
    
    /**
     * Gets the children for a tag but only includes those that are required.
     * @param {String} tag The tag name.
     * @returns {Object}
     */
    u.getRequiredChildrenForTag = function(tag) {
        var tags = u.getChildrenForTag({tag: tag, type:'element', returnType:'object'});
        for (var key in tags) {
            if (tags[key].required != true) {
                delete tags[key];
            }
        }
        return tags;
    };
    
    /**
     * Gets a list from the schema of valid parents for a particular tag
     * @param config The config object
     * @param config.tag The element name to get parents of
     * @param [config.path] The path to the tag (optional)
     * @param config.returnType Either: "array", "object", "names" (which is an array of just the element names)
     */
    u.getParentsForTag = function(config) {
        var parents = [];
        
        function _getParentElementsFromJson(defName, defHits, level, parents) {
            var context = w.schemaManager.schemaJSON.grammar;
            var matches = [];
            _queryDown(context, function(item) {
                if (item.$key === 'ref' && item['@name'] === defName) {
                    matches.push(item);
                }
            });
            
            for (var i = 0; i < matches.length; i++) {
                var item = matches[i];
                var parent = item.$parent;
                while (parent !== undefined) {
                    if (parent.$key === 'element' || parent.$key === 'define') {
                        break;
                    } else {
                        parent = parent.$parent;
                    }
                }
                if (parent.$key === 'element') {
                    var docs = null;
                    _queryDown(parent, function(item) {
                        if (item['a:documentation']) {
                            docs = item['a:documentation'];
                            return false;
                        }
                    });
                    if (docs != null && docs['#text'] !== undefined) {
                        docs = docs['#text'];
                    } else if (docs == null) {
                        docs = '';
                    }
                    var fullName = getFullNameFromDocumentation(docs);
                    
                    parents.push({
                        name: parent['@name'],
                        fullName: fullName,
                        level: level,
                        documentation: docs
                    });
                } else {
                    if (!defHits[parent['@name']]) {
                        defHits[parent['@name']] = true;
                        _getParentElementsFromJson(parent['@name'], defHits, level+1, parents);
                    }
                }
            }
        }
        
        if (useLocalStorage) {
            var tag = config.tag;
            var localData = localStorage['cwrc.'+tag+'.parents'];
            if (localData) {
                parents = JSON.parse(localData);
            }
        }
        
        if (parents.length === 0) {
            var elements = [];
            if (config.path) {
                var element = u.getJsonEntryFromPath(config.path);
                if (element !== null) {
                    elements.push(element);
                }
            } else {
                elements = _getElementEntries(config.tag);
            }
            if (elements.length == 0) {
                console.warn('utilities: cannot find element for '+config.tag);
            } else {
                for (var i = 0; i < elements.length; i++) {
                    var el = elements[i];
                    var parent = el.$parent;
                    while (parent !== undefined) {
                        if (parent.$key === 'define' || parent.$key === 'element') {
                            break;
                        } else {
                            parent = parent.$parent;
                        }
                    }
                    
                    if (parent.$key === 'define') {
                        var defName = parent['@name'];
                        var defHits = [];
                        var level = 0;
                        _getParentElementsFromJson(defName, defHits, level, parents)
                        
                    } else if (parent.$key === 'element') {
                        parents.push({name: parent['@name'], level: 0});
                    }
                }
            }
        }
        
        var i;
        var len = parents.length;
        if (config.returnType == 'object') {
            var parentsObj = {};
            for (i = 0; i < len; i++) {
                var c = parents[i];
                parentsObj[c.name] = c;
            }
            return parentsObj;
        } else if (config.returnType == 'names') {
            var names = [];
            for (i = 0; i < len; i++) {
                names.push(parents[i].name);
            }
            return names;
        } else {
            return parents;
        }
    };
    
    /**
     * @param currEl The element that's currently being processed
     * @param defHits A list of define tags that have already been processed
     * @param level The level of recursion
     * @param canContainText Whether the element can contain text
     */
    function checkForText(currEl, defHits, level, canContainText) {
        if (canContainText.isTrue) {
            return false;
        }
        
        // check for the text element
        var textHits = currEl.find('text');
        if (textHits.length > 0) {
            canContainText.isTrue = true;
            return false;
        }
        
        // now process the references
        currEl.find('ref').each(function(index, el) {
            var name = $(el).attr('name');
            if ($(el).parents('element').length > 0 && level > 0) {
                return; // don't get attributes from other elements
            }
            if (!defHits[name]) {
                defHits[name] = true;
                var def = $('define[name="'+name+'"]', w.schemaManager.schemaXML);
                return checkForText(def, defHits, level+1, canContainText);
            }
        });
    }
    
    /**
     * Checks to see if the tag can contain text, as specified in the schema
     * @param {string} tag The tag to check
     * @returns boolean
     */
    u.canTagContainText = function(tag) {
        if (tag == w.schemaManager.getRoot()) return false;
        
        if (useLocalStorage) {
            var localData = localStorage['cwrc.'+tag+'.text'];
            if (localData) return localData == 'true';
        }
        
        var element = $('element[name="'+tag+'"]', w.schemaManager.schemaXML);
        var defHits = {};
        var level = 0;
        var canContainText = {isTrue: false}; // needs to be an object so change is visible outside of checkForText
        checkForText(element, defHits, level, canContainText);
        
        if (useLocalStorage) {
            localStorage['cwrc.'+tag+'.text'] = canContainText.isTrue;
        }
        
        return canContainText.isTrue;
    };
    
    /**
     * Checks to see if the tag can have attributes, as specified in the schema
     * @param {string} tag The tag to check
     * @returns boolean
     */
    u.canTagHaveAttributes = function(tag) {
        var atts = u.getChildrenForTag({tag: tag, type: 'attribute', returnType: 'array'});
        return atts.length != 0;
    };
    
    /**
     * Get the XPath for an element, using the cwrc _tag attributes.
     * Adapted from the firebug source.
     * @param {Element} element The (cwrc) element to get the XPath for
     * @returns string
     */
    u.getElementXPath = function(element) {
        var paths = [];
        
        // Use nodeName (instead of localName) so namespace prefix is included (if any).
        for (; element && element.nodeType == 1; element = element.parentNode)
        {
            var index = 0;
            for (var sibling = element.previousSibling; sibling; sibling = sibling.previousSibling)
            {
                // Ignore document type declaration.
                if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE)
                    continue;

                if (sibling.getAttribute) {
                    if (sibling.getAttribute('_tag') == element.getAttribute('_tag')) {
                        ++index;
                    }
//                    else if (sibling.getAttribute('_tag') == null && sibling.nodeName == element.nodeName) {
//                        ++index;
//                    }
                }
            }

            var tagName = element.getAttribute('_tag');// || element.nodeName;
            if (tagName != null) {
                var pathIndex = (index ? "[" + (index+1) + "]" : "");
                paths.splice(0, 0, tagName + pathIndex);
            }
        }

        return paths.length ? "/" + paths.join("/") : null;
    };

    /**
     * Runs the specified xpath on the specified doc.
     * Adds support for default namespace.
     * @param {Document} doc
     * @param {String} xpath
     * @returns {Node} The result, or null
     */
    u.evaluateXPath = function(doc, xpath) {
        var nsr = doc.createNSResolver(doc.documentElement);
        var defaultNamespace = doc.documentElement.getAttribute('xmlns');

        function nsResolver(prefix) {
            return nsr.lookupNamespaceURI(prefix) || defaultNamespace;
        }

        // default namespace hack (http://stackoverflow.com/questions/9621679/javascript-xpath-and-default-namespaces)
        var foopath;
        if (defaultNamespace !== null) {
            // grouped matches: 1 separator, 2 axis, 3 namespace, 4 element name, 5 predicate
            // add foo namespace to the element name
            foopath = xpath.replace(/(\/{1,2})([\w-]+::)?(\w+?:)?(\w+)(\[.*?\])?/g, function(match, p1, p2, p3, p4, p5) {
                if (p3 !== undefined) {
                    // already has a namespace
                    return match;
                } else {
                    return [p1,p2,'foo:',p4,p5].join('');
                }
            });
        } else {
            foopath = xpath;
        }

        var result;
        try {
            result = doc.evaluate(foopath, doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        } catch (e) {
            console.warn('utilities.evaluateXPath: there was an error evaluating the xpath', e)
            return null;
        }
        return result.singleNodeValue;
    };
    
    /**
     * Gets the URI for the entity
     * @param {Object} entity The entity object
     * @returns {Promise} The promise object
     */
    u.getUriForEntity = function(entity) {
        var guid = u.createGuid();
        var uri = 'http://id.cwrc.ca/'+entity.getType()+'/'+guid;
        var dfd = new $.Deferred();
        dfd.resolve(uri);
        return dfd.promise();
    };
    
    /**
     * Gets the URI for the annotation
     * @param {Object} entity The entity object
     * @returns {Promise} The promise object
     */
    u.getUriForAnnotation = function() {
        var guid = u.createGuid();
        var uri = 'http://id.cwrc.ca/annotation/'+guid;
        var dfd = new $.Deferred();
        dfd.resolve(uri);
        return dfd.promise();
    };
    
    /**
     * Gets the URI for the document
     * @param {Object} entity The entity object
     * @returns {Promise} The promise object
     */
    u.getUriForDocument = function() {
        var guid = u.createGuid();
        var uri = 'http://id.cwrc.ca/doc/'+guid;
        var dfd = new $.Deferred();
        dfd.resolve(uri);
        return dfd.promise();
    };
    
    /**
     * Gets the URI for the target
     * @param {Object} entity The entity object
     * @returns {Promise} The promise object
     */
    u.getUriForTarget = function() {
        var guid = u.createGuid();
        var uri = 'http://id.cwrc.ca/target/'+guid;
        var dfd = new $.Deferred();
        dfd.resolve(uri);
        return dfd.promise();
    };
    
    /**
     * Gets the URI for the selector
     * @param {Object} entity The entity object
     * @returns {Promise} The promise object
     */
    u.getUriForSelector = function() {
        var guid = u.createGuid();
        var uri = 'http://id.cwrc.ca/selector/'+guid;
        var dfd = new $.Deferred();
        dfd.resolve(uri);
        return dfd.promise();
    };
    
    /**
     * Gets the URI for the user
     * @param {Object} entity The entity object
     * @returns {Promise} The promise object
     */
    u.getUriForUser = function() {
        var guid = u.createGuid();
        var uri = 'http://id.cwrc.ca/user/'+guid;
        var dfd = new $.Deferred();
        dfd.resolve(uri);
        return dfd.promise();
    };
    
    u.createGuid = function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    };
    
    /**
     * Get the offset position of an element, relative to cwrc-writer container
     * @param {Element} el The element
     * @returns {Object} position An object container top and left properties
     */
    u.getOffsetPosition = function(el) {
        var $el = $(el);
        var position = $el.position();
        var parent = w.layoutManager.getContainer();
        
        var offP = $el.offsetParent();
        while(parent.find(offP).length == 1) {
            var pos = offP.position();
            position.top += pos.top;
            position.left += pos.left;
            
            offP = offP.offsetParent();
        }
        
        return position;
    };
    
    /**
     * Constrain a value. Useful when positioning an element within another element.
     * @param {Number} value The x or y value of the element
     * @param {Number} max The max to constrain within
     * @param {Number} size The size of the element
     * @returns {Number} value The constrained value
     */
    u.constrain = function(value, max, size) {
        if (value < 0) {
            return 0;
        }

        if (value + size > max) {
            value = max - size;
            return value < 0 ? 0 : value;
        }

        return value;
    }

    u.destroy = function() {
        if ($entitiesConverter !== undefined) {
            $entitiesConverter.remove();
        }
    };
    
    return u;
};

module.exports = Utilities;