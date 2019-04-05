'use strict';

var $ = require('jquery');

function SchemaNavigator() {
    var schemaJSON;
    var schemaElements;
    
    /**
     * @lends SchemaNavigator.prototype
     */
    var sn = {};

    sn.setSchemaJSON = function(json) {
        schemaJSON = json;
    }
    sn.setSchemaElements = function(elements) {
        schemaElements = elements;
    }

    var useLocalStorage = false;//supportsLocalStorage();
    function supportsLocalStorage() {
        try {
            return 'localStorage' in window && window['localStorage'] !== null;
        } catch (e) {
            return false;
        }
    }

    function isArray(obj) {
        return toString.apply(obj) === '[object Array]';
    }

    function isObject(obj){
        return !!obj && Object.prototype.toString.call(obj) === '[object Object]';
    }

    /**
     * Gets a list from the schema of valid parents for a particular tag
     * @param config The config object
     * @param config.tag The element name to get parents of
     * @param [config.path] The path to the tag (optional)
     * @param config.returnType Either: "array", "object", "names" (which is an array of just the element names)
     */
    sn.getParentsForTag = function(config) {
        var parents = [];
        
        if (useLocalStorage) {
            var localData = localStorage['cwrc.'+config.tag+'.parents'];
            if (localData) {
                parents = JSON.parse(localData);
            }
        }
        
        if (parents.length === 0) {
            var elements = [];
            if (config.path) {
                var element = _getJsonEntryFromPath(config.path);
                if (element !== null) {
                    elements.push(element);
                }
            } else {
                elements = _getElementEntries(config.tag);
            }
            if (elements.length == 0) {
                console.warn('schemaNavigator: cannot find element for '+config.tag);
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
                        _getParentsJSON(defName, defHits, level, parents)
                        
                    } else if (parent.$key === 'element') {
                        parents.push({name: parent['@name'], level: 0});
                    }
                }

                parents.sort(function(a, b) {
                    if (a.name > b.name) return 1;
                    if (a.name < b.name) return -1;
                    return 0;
                });

                if (useLocalStorage) {
                    localStorage['cwrc.'+config.tag+'.parents'] = JSON.stringify(parents);
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
     * Gets a list from the schema of valid children for a particular tag
     * @param config The config object
     * @param config.tag The element name to get children of
     * @param [config.path] The path to the tag (optional). If provided, only returns results for the tag matching the path.
     * @param config.type The type of children to get: "element" or "attribute"
     * @param config.returnType Either: "array", "object", "names" (which is an array of just the element names)
     */
    sn.getChildrenForTag = function(config) {
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
                var element = _getJsonEntryFromPath(config.path);
                if (element !== null) {
                    elements.push(element);
                }
            } else {
                elements = _getElementEntries(config.tag);
            }
            if (elements.length == 0) {
                console.warn('schemaNavigator: cannot find element for '+config.tag);
            } else {
                for (var i = 0; i < elements.length; i++) {
                    var element = elements[i];
                    var defHits = {};
                    var level = 0;
                    _getChildrenJSON(element, defHits, level, config.type, children); 
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
     * Uses a path to find the related entry in the JSON schema.
     * @param {String} path A forward slash delimited pseudo-xpath
     * @returns {Object}
     */
    function _getJsonEntryFromPath(path) {
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
    };

    /**
     * Get the element entries for the element name
     * @param {String} name The element name
     * @returns {Array}
     */
    function _getElementEntries(name) {
        var matches = [];
        _queryDown(schemaJSON.grammar, function(item) {
            if (item.$key === 'element' && item['@name'] === name) {
                matches.push(item);
            }
        });
        return matches;
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
        var defs = schemaJSON.grammar.define;
        for (var i = 0, len = defs.length; i < len; i++) {
            var d = defs[i];
            if (d['@name'] == name) return d;
        }
        return null;
    }

    function _getFullNameFromDocumentation(documentation) {
        // if the tag name is an abbreviation, we expect the full name to be at the beginning of the doc, in parentheses
        var hit = /^\((.*?)\)/.exec(documentation);
        if (hit !== null) {
            return hit[1];
        }
        return '';
    }
    
    return sn;
}

module.exports = SchemaNavigator;
