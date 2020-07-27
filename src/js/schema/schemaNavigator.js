'use strict';

var $ = require('jquery');

/**
 * Navigates the schema JSON to get parents, children, and attributes for tags or paths.
 * Paths are essentially XPaths, however only element names and the child axis "/" are supported, e.g. TEI/text/body/div/p
 */
function SchemaNavigator() {
    /**
     * @lends SchemaNavigator.prototype
     */
    var sn = {};

    var schemaJSON;
    sn.setSchemaJSON = function(json) {
        schemaJSON = json;
    }

    var schemaElements;
    sn.setSchemaElements = function(elements) {
        schemaElements = elements;
    }

    /**
     * Returns an array of valid parents for a particular tag
     * @param {String} tag The element name
     * @returns {Array}
     */
    sn.getParentsForTag = function(tag) {
        var elements = _getEntriesForTag(tag);
        if (elements.length == 0) {
            console.warn('schemaNavigator: cannot find element for '+tag);
            return [];
        } else {
            var parents = [];
            for (var i = 0; i < elements.length; i++) {
                parents = parents.concat(_getElementParents(elements[i]));
            }
            _sortEntries(parents);
            return parents;
        }
    }

    /**
     * Returns an array of valid parents for a particular path
     * @param {String} path The path
     * @returns {Array}
     */
    sn.getParentsForPath = function(path) {
        var element = _getEntryForPath(path);
        if (element === null) {
            console.warn('schemaNavigator: cannot find element for '+path);
            return [];
        } else {
            var parents = _getElementParents(element);
            _sortEntries(parents);
            return parents;
        }
    }

    /**
     * Returns an array of valid children for a particular tag
     * @param {String} tag The element name
     * @returns {Array}
     */
    sn.getChildrenForTag = function(tag) {
        var elements = _getEntriesForTag(tag);
        if (elements.length == 0) {
            console.warn('schemaNavigator: cannot find element for '+tag);
            return [];
        } else {
            var children = [];
            for (var i = 0; i < elements.length; i++) {
                children = children.concat(_getElementChildren(elements[i], 'element'));
            }
            _sortEntries(children);
            return children;
        }
    }

    /**
     * Returns an array of valid children for a particular path
     * @param {String} path The path
     * @returns {Array}
     */
    sn.getChildrenForPath = function(path) {
        var element = _getEntryForPath(path);
        if (element === null) {
            console.warn('schemaNavigator: cannot find element for '+path);
            return [];
        } else {
            var children = _getElementChildren(element, 'element');
            _sortEntries(children);
            return children;
        }
    }

    /**
     * Returns an array of valid attributes for a particular tag
     * @param {String} tag The element name
     * @returns {Array}
     */
    sn.getAttributesForTag = (tag) => {
        const elements = _getEntriesForTag(tag);
        if (elements.length === 0) {
            // console.warn('schemaNavigator: cannot find element for '+tag);
            return [];
        }
        
        const children = elements.flatMap((element) => (_getElementChildren(element, 'attribute')));
        _sortEntries(children);
        return children;
    }

    /**
     * Returns an array of valid attributes for a particular path
     * @param {String} path The path
     * @returns {Array}
     */
    sn.getAttributesForPath = function(path) {
        var element = _getEntryForPath(path);
        if (element === null) {
            console.warn('schemaNavigator: cannot find element for '+path);
            return [];
        } else {
            var children = _getElementChildren(element, 'attribute');
            _sortEntries(children);
            return children;
        }
    }

    /**
     * Get the schema entries for a tag
     * @param {String} name The element name
     * @returns {Array}
     */
    function _getEntriesForTag(name) {
        var matches = [];
        _queryDown(schemaJSON.grammar, function(item) {
            if (item.$key === 'element' && item['@name'] === name) {
                matches.push(item);
            }
        });
        return matches;
    }

    /**
     * Uses a path to find the related entry in the schema.
     * @param {String} path A forward slash delimited pseudo-xpath
     * @returns {Object}
     */
    function _getEntryForPath(path) {
        var context = schemaJSON.grammar;
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
                            if (item['$key'] === 'element') {
                                match = item;
                                return false;
                            } else {
                                // the name matches but we're in define so drill down further
                                context = item;
                            }
                        }
                        return true;
                    }
                }, true);
            }
        }
        return match;
    }

    /**
     * Returns all the valid parents of an element schema entry
     * @param {Object} el The schema entry
     * @returns {Array}
     */
    function _getElementParents(el) {
        var parents = [];

        var parent = el.$parent;
        while (parent !== undefined) {
            if (parent.$key === 'define' || parent.$key === 'element') {
                break;
            } else {
                parent = parent.$parent;
            }
        }
        
        if (parent.$key === 'define') {
            _getParentsJSON(parent['@name'], {}, 0, parents);
        } else if (parent.$key === 'element') {
            parents.push({name: parent['@name'], level: 0});
        }

        return parents;
    }

    /**
     * Returns all the valid element or attribute children of an element schema entry
     * @param {Object} element The schema entry
     * @param {String} type Either "element" or "attribute"
     * @returns {Array}
     */
    function _getElementChildren(element, type) {
        var children = [];

        _getChildrenJSON(element, {}, 0, type, children); 
        if (children.indexOf('anyName') != -1) {
            children = [];
            // anyName means include all elements
            for (i = 0; i < schemaElements.length; i++) {
                var el = schemaElements[i];
                // TODO need to add more info than just the name
                children.push({
                    name: el
                });
            }
        }

        return children;
    }

    /**
     * Sort the schema entries by name in ascending order
     * @param {Array} entries An array of schema entries
     */
    function _sortEntries(entries) {
        entries.sort(function(a, b) {
            if (a.name > b.name) return 1;
            if (a.name < b.name) return -1;
            return 0;
        });
    }

    /**
     * Navigate the schema json to find all the parents for a schema definition name.
     * @param {String} defName The name of the schema definition entry
     * @param {Object} defHits A map to track what schema definitions have already been visited
     * @param {Integer} level Tracks the current tree depth
     * @param {Array} parents An array to store the results
     */
    function _getParentsJSON(defName, defHits, level, parents) {
        var context = schemaJSON.grammar;
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
                var fullName = _getFullNameFromDocumentation(docs);
                
                parents.push({
                    name: parent['@name'],
                    fullName: fullName,
                    level: level,
                    documentation: docs
                });
            } else {
                if (!defHits[parent['@name']]) {
                    defHits[parent['@name']] = true;
                    _getParentsJSON(parent['@name'], defHits, level+1, parents);
                }
            }
        }
    }

    /**
     * Navigate the schema json to find all the children for a schema entry
     * @param {Object} currEl The schema entry element that's currently being processed
     * @param {Object} defHits A map of define tags that have already been processed
     * @param {Integer} level The level of recursion
     * @param {String} type The type of child to search for (element or attribute)
     * @param {Array} children The children to return
     * @param {Object} refParentProps For storing properties of a ref's parent (e.g. optional), if we're processing the ref's definition
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
            var fullName = _getFullNameFromDocumentation(docs);
            
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
                        if (child.$parent.$key === 'element' || child.$parent.$key === 'oneOrMore') {
                            childObj.required = true;
                        } else {
                            childObj.required = false;
                        }
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
                    var list = null;
                    _queryDown(child, function(item) {
                        if (item.choice) {
                            choice = item.choice;
                        }
                        if (item.list) {
                            list = item.list;
                        }
                        if (choice !== null && list !== null) {
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

                    if (list !== null) {
                        // TODO
                    }

                    // TODO process data pattern using pcre-to-regexp
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
                    if (parentKey === 'choice' || parentKey === 'optional' || parentKey === 'zeroOrMore') {
                        // we're taking choice to mean optional, even though it could mean a requirement to choose one or more elements
                        optional = true;
                        return false;
                    } else if (parentKey === 'oneOrMore') {
                        optional = false;
                        return false;
                    }
                }
                return false;
            });
            
            if (!defHits[name]) {
                defHits[name] = true;
                var def = _getDefinition(name);
                if (def !== null) {
                    _getChildrenJSON(def, defHits, level+1, type, children, {optional: optional});
                }
            }
        }
    }

    /**
     * Moves up the schema JSON "tree", call the passed function on each entry.
     * Function should return false to stop moving up.
     * @param {Object} context A schema entry, the starting point.
     * @param {Function} matchingFunc The function that's called on each entry.
     */
    function _queryUp(context, matchingFunc) {
        var continueQuery = true;
        while (continueQuery && context != null) {
            continueQuery = matchingFunc.call(this, context);
            if (continueQuery == undefined) continueQuery = true;
            context = context.$parent;
        }
    }

    /**
     * Moves recursively down the schema JSON "tree", calling the passed function on each entry.
     * Function should return false to stop the recursion.
     * @param {Object} context A schema entry, the starting point.
     * @param {Function} matchingFunc The function that's called on each entry.
     * @param {Boolean} [processRefs] Automatically process refs, i.e. fetch their definitions
     */
    function _queryDown(context, matchingFunc, processRefs) {
        var continueQuery = true;
        
        var defHits = {};
        
        function isArray(obj) {
            return toString.apply(obj) === '[object Array]';
        }
        function isObject(obj){
            return !!obj && Object.prototype.toString.call(obj) === '[object Object]';
        }

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
                                    if (def !== null) {
                                        doQuery(def);
                                    }
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

    /**
     * Gets the schema definition for a specified name
     * @param {String} name The name
     * @returns {Object|Null}
     */
    function _getDefinition(name) {
        var defs = schemaJSON.grammar.define;
        for (var i = 0, len = defs.length; i < len; i++) {
            var d = defs[i];
            if (d['@name'] == name) return d;
        }
        
        console.warn('schemaNavigator: no definition found for', name);
        return null;
    }

    /**
     * Parses the passed documentation string and returns the full name.
     * If the tag name is an abbreviation, we expect the full name to be at the beginning of the documentation, in parentheses.
     * @param {String} documentation The documentation string
     * @returns {String}
     */
    function _getFullNameFromDocumentation(documentation) {
        var hit = /^\((.*?)\)/.exec(documentation);
        if (hit !== null) {
            return hit[1];
        }
        return '';
    }
    
    return sn;
}

module.exports = SchemaNavigator;
