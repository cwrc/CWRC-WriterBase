import { isEqual } from 'underscore';

/**
 * Navigates the schema JSON to get parents, children, and attributes for tags or paths.
 * Paths are essentially XPaths, however only element names and the child axis "/" are supported, e.g. TEI/text/body/div/p
 */
function SchemaNavigator() {
    /**
     * @lends SchemaNavigator.prototype
     */
    const sn = {};

    let schemaJSON;
    sn.setSchemaJSON = (json) => schemaJSON = json;

    let schemaElements;
    sn.setSchemaElements = (elements) => schemaElements = elements;

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
     * Returns an array of valid parents for a particular path
     * @param {String} path The path
     * @param {Array} context Array of tags in the local context tag
     * @returns {Array}
     */
    sn.getParentsForPath = (path,context) => {
        const element = _getEntryForPath(path);

        if (element === null) {
            console.warn('schemaNavigator: cannot find element for '+path);
            return [];
        };

        let parents = _getElementParents(element);
        if (context && context.length > 0) parents = checkValidKeysRestriction(parents, context);
        _sortEntries(parents);
        return parents;
    }

    /**
     * Returns an array of valid children for a particular path
     * @param {String} path The path
     * @param {Array} context Array of tags in the local context tag
     * @returns {Array}
     */
    sn.getChildrenForPath = (path,context) => {
        // console.log(path)

        console.time('_getEntryForPath_ObjTree_Original')
        const element = _getEntryForPath(path);
        // console.log(element)
        

        if (element === null) {
            console.warn(`schemaNavigator: cannot find element for ${path}`);
            return [];
        }
        
        let children = _getElementChildren(element, 'element');

        // console.log(children);

        console.timeEnd('_getEntryForPath_ObjTree_Original')


        // if (context && context.length > 0) children = checkValidKeysRestriction(children, context);
        // _sortEntries(children);
        
        return children;
    }

    /**
     * Returns an array of valid children for a particular path
     * After checking for restricions on local context 
     * @param {Array} children The the possible tags for the path
     * @param {Array} context Array of tags in the local context tag
     * @returns {Array}
     */
    const checkValidKeysRestriction = (avilablaTags, existingTags) => {
        //check if there are tags that will limit the options
        // console.log(children)
        // const keyIsPresent = children.find((key) => {
        //     return (
        //         context.includes(key.name)
        //         && key?.group?.length === 1
        //     );
        // });

        // // console.log(keyIsPresent);
        // //narrow options
        // if (keyIsPresent) {
        //     const groupRestriction = keyIsPresent.group[0];
        //     console.table(children);
        //     children = children.filter((key) => key.group.includes(groupRestriction));
        // };

        //-------------


         //check if there are tags that will limit the options
        console.log(avilablaTags)
        const groupsRestriction = [];

        avilablaTags.forEach((tag) => {

            // const tag = existingTags.includes(tag.name)
            if (!existingTags.includes(tag.name)) return
            if (!tag.patterns) return;

            const patterns = [...new Set(tag.patterns.map(item => item.name))];

            console.log(patterns);

            // return (
            //     existingTags.includes(key.name)
            //     && key?.group?.length === 1
            // );
        });

        // console.log(keyIsPresent);
        //narrow options
        // if (groupsRestriction.length > 0 ) {
        //     // const groupRestriction = keyIsPresent.group[0];
        //     avilablaTags = avilablaTags.filter((key) => key.patterns.includes(groupsRestriction));
        //     console.table(avilablaTags);
        // };
    
        return avilablaTags;
    };

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
    const _getEntryForPath = (path) => {
        let context = schemaJSON.grammar;
        let match = null;
        
        // console.log("^^^^^^");
        // console.time("Manually");
        const tags = path.split('/');
        for (let i = 0; i < tags.length; i++) {
            let tag = tags[i];
            if  (tag === '') continue;

            // console.log(tag)
           
            tag = tag.replace(/\[\d+\]$/, ''); // remove any indexing

            _queryDown(context, (item) => {
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

        // console.log(match)
        return match;
    }

    /**
     * Returns all the valid parents of an element schema entry
     * @param {Object} el The schema entry
     * @returns {Array}
     */
    const _getElementParents = (el) => {
        const parents = [];

        let parent = el.$parent;
        while (parent !== undefined) {
            if (parent.$key === 'define' || parent.$key === 'element') {
                break;
            }
            parent = parent.$parent;
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
    const _getElementChildren = (element, type) => {
        let children = [];

        _getChildrenJSON(element, {}, 0, type, children);

        if (children.indexOf('anyName') != -1) {
            children = [];
            // anyName means include all elements
            schemaElements.forEach((element) => {
                // TODO need to add more info than just the name [2018]
                children.push({
                    name: element
                });
            });
        }

        return children;
    }

    /**
     * Sort the schema entries by name in ascending order
     * @param {Array} entries An array of schema entries
     */
    const _sortEntries = (entries) => {
        entries.sort((a, b) => {
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
    const _getParentsJSON = (defName, defHits, level, parents) => {

        const context = schemaJSON.grammar;
        const matches = [];

        _queryDown(context, (item) => {
            if (item.$key === 'ref' && item['@name'] === defName) {
                matches.push(item);
            }
        });
        
        matches.forEach((item) => {
            let parent = item.$parent;

            while (parent !== undefined) {
                if (parent.$key === 'element' || parent.$key === 'define') {
                    break;
                } else {
                    parent = parent.$parent;
                }
            }

            if (parent.$key === 'element') {
                let documentation = null;

                _queryDown(parent, (item) => {
                    if (item['a:documentation']) {
                        documentation = item['a:documentation'];
                        return false;
                    }
                });

                if (documentation != null && documentation['#text'] !== undefined) {
                    documentation = documentation['#text'];
                } else if (documentation == null) {
                    documentation = '';
                }

                const fullName = _getFullNameFromDocumentation(documentation);
                
                parents.push({
                    name: parent['@name'],
                    fullName,
                    documentation,
                    level,
                });

            } else {
                if (!defHits[parent['@name']]) {
                    defHits[parent['@name']] = true;
                    _getParentsJSON(parent['@name'], defHits, level+1, parents);
                }
            }

        });
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
    const _getChildrenJSON = (currEl, defHits, level, type, children, refParentProps) => {
        // first get the direct types
        let hits = [];
        // console.log(currEl)
        if (refParentProps?.locallyDefined) {
            hits = [ ...hits, currEl]
        } else {
            _queryDown(currEl, (item) => {

                // console.log(item)
                if (item.$key === 'element' && item !== currEl) return false; // we're inside a different element so stop querying down

                // console.log(item[type])
                
                if (item[type] !== undefined) {
                    hits = [ ...hits, item[type]]  // use spread incase item[type] is an array
                    // hits = hits.concat(item[type]); // use concat incase item[type] is an array
                }
            });
        }
        // console.log(children)
        

        hits = hits.flat();
        // console.log(hits)
        // console.log(currEl, hits)
       
        hits.forEach((child) => {
        // for (var i = 0; i < hits.length; i++) {
            // var child = hits[i];
            
            let documentation = null;

            _queryDown(child, (item) => {
                if (item['a:documentation']) {
                    documentation = item['a:documentation'];
                    return false;
                }
            });

            if (documentation !== null && documentation['#text'] !== undefined) {
                documentation = documentation['#text'];
            } else if (documentation == null) {
                documentation = '';
            }

            const fullName = _getFullNameFromDocumentation(documentation);
            
            if (child.anyName) {
                children.push('anyName');
                return;
            }

            const duplicateEntry = children.find((entry) => entry.name === child['@name'])

            // console.log(child, duplicateEntry, refParentProps)

            if (duplicateEntry) {
                if (refParentProps.group !== null) {
                    if (!duplicateEntry.patterns) duplicateEntry.patterns = [];
                    duplicateEntry.patterns.push({
                        name: refParentProps.pattern,
                        group: refParentProps.group
                    });
                }
                return;
            }


            const childObj = {
                name: child['@name'],
                fullName,
                documentation,
                level: level+0,
            };

            // console.log(childObj, refParentProps)

            if (refParentProps && refParentProps?.group !== null) {
                childObj.patterns = [{
                    name: refParentProps.pattern,
                    group: refParentProps.group
                }]
            }
            
            if (type === 'element') {

                if (refParentProps && refParentProps?.optional !== null) {
                    childObj.required = !refParentProps.optional;
                } else {
                    if (child.$parent.$key === 'element' || child.$parent.$key === 'oneOrMore') {
                        childObj.required = true;
                    } else {
                        childObj.required = false;
                    }
                }

            } else if (type === 'attribute') {

                if (refParentProps?.optional != null) {
                    childObj.required = !refParentProps.optional;
                } else {
                    childObj.required = true;
                    _queryUp(child.$parent, (item) => {
                        if (item.optional) {
                            childObj.required = false;
                            return false;
                        }
                    });
                }
                
                let defaultVal = '';
                _queryDown(child, (item) => {
                    if (item['@a:defaultValue']) {
                        defaultVal = item['@a:defaultValue'];
                        return false;
                    }
                });
                childObj.defaultValue = defaultVal;

                let choice = null;
                let list = null;
                _queryDown(child, (item) => {
                    if (item.choice) choice = item.choice;
                    if (item.list) list = item.list;
                    if (choice !== null && list !== null) return false;
                });

                if (choice !== null) {

                    const choices = [];
                    let values = [];

                    _queryDown(choice, (item) => {
                        if (item.value) values = item.value;
                        if (!Array.isArray(values)) values = [values]
                    });

                    values.forEach((val) => {
                        if (val['#text']) val = val['#text'];
                        choices.push(val);
                    });
                    childObj.choices = choices;
                }

                if (list !== null) {
                    // TODO
                }

                // TODO process data pattern using pcre-to-regexp
            }

            children.push(childObj);
            // console.log(childObj)
        });
        
        // now process the references
        // console.log(hits)
        hits = [];
        _queryDown(currEl, (item) => {
            // console.log(item)
            // console.log(item.$parent === 'element')
            if (item.$key === 'element'
                && item.$parent.$key !== 'choice'
                && item !== currEl
            ) {
                return false; // we're inside a different element so stop querying down
            }

            const getRefGroup = (currentCollection, context) => {
                for (let i = 0; i < context.length; i++) {
                    const collection = context[i];
                    if (isEqual(currentCollection, collection)) return i;
                    // console.log({currentOneOrMore, collection, isequal: isEqual(currentOneOrMore, collection)})
                }
                return null;
            }
            
            if (item.ref) {

                let ref = item.ref;

                let patternName = null;
                let patternPath = null;

                if (item.$key === 'choice') {
                    if (item.$parent.$key === 'oneOrMore' || item.$parent.$key === 'zeroOrMore' || item.$parent.$key === 'optional') {
                        patternName = item.$parent.$key;
                        patternPath = item.$parent.$parent;
                    }
                }

                if (item.$key === 'oneOrMore' || item.$key === 'zeroOrMore' || item.$key === 'optional') {
                    patternName = item.$key;
                    patternPath = item.$parent;
                }

                if (!patternName) return;

                // console.log({item, patternPath, patternName, path:patternPath[patternName]});
                    

                if (Array.isArray(patternPath[patternName])) {
                    // console.log(item);
                    const currentCollection = item.$parent;
                    const context = patternPath[patternName];
                    const group = getRefGroup(currentCollection, context);
                    
                    // console.log(group);
                    if (group !== null) {
                        ref = ref.map((child) => {
                            child.group = group;
                            child.pattern = patternName;
                            // console.log(child);
                            return child;
                        });
                    }
                };

                // if (typeof patternPath[patternName] === 'object') {
                //     ref = ref.map((child) => {
                //         child.group = 0;
                //         child.pattern = patternName;
                //         // console.log(child);
                //         return child;
                //     });
                // };

                // if (item.$key === 'choice') {
               
                //     if (item.$parent.$key === 'oneOrMore' || item.$parent.$key === 'zeroOrMore' || item.$parent.$key === 'optional') {
                //         const parentKey = item.$parent.$key;

                //         if (Array.isArray(item.$parent.$parent[parentKey])) {
                //             // console.log(item);
                //             const currentCollection = item.$parent;
                //             const context = item.$parent.$parent[parentKey];
                //             const group = getRefGroup(currentCollection, context);
                //             // console.log(group);
                //             if (group !== null) {
                //                 ref = ref.map((child) => {
                //                     child.group = group;
                //                     child.pattern = parentKey;
                //                     // console.log(child);
                //                     return child;
                //                 });
                //             }
                //         }
                        
                //     }
                // }
                

                // console.log(ref)
                hits = hits.concat(ref); // use concat incase item.ref is an array
            }
        });
       
        hits.forEach((ref) => {
            
            const name = ref['@name'];

            // store extra values
            let optional = null;
            let pattern = null;


            _queryUp(ref, (item) => {
                if (item.$parent && item.$parent.$key) {
                    const parentKey = item.$parent.$key;
                    if (parentKey === 'choice' || parentKey === 'optional' || parentKey === 'zeroOrMore') {
                        // we're taking choice to mean optional, even though it could mean a requirement to choose one or more elements
                        optional = true;
                        // pattern = parentKey;
                        return false;
                    } else if (parentKey === 'oneOrMore') {
                        optional = false;
                        // pattern = parentKey;
                        return false;
                    }
                }
                return false;
            });
            
            // if (!defHits[name]) {
                defHits[name] = true;
                const def = _getDefinition(name);
                if (def !== null) {
                    _getChildrenJSON(def, defHits, level+1, type, children, {
                        optional,
                        pattern: ref.pattern,
                        group: ref.group
                    });
                }
            // }
        });
    }

    /**
     * Moves up the schema JSON "tree", call the passed function on each entry.
     * Function should return false to stop moving up.
     * @param {Object} context A schema entry, the starting point.
     * @param {Function} matchingFunc The function that's called on each entry.
     */
    function _queryUp(context, matchingFunc) {
        let continueQuery = true;
        while (continueQuery && context !== null) {
            continueQuery = matchingFunc.call(this, context);
            if (continueQuery === undefined) continueQuery = true;
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
        let continueQuery = true;
        
        const defHits = {};
        
        const isArray = (obj) => toString.apply(obj) === '[object Array]';
        const isObject = (obj) => (!!obj && Object.prototype.toString.call(obj) === '[object Object]');

        function doQuery(currContext) {

            if (!continueQuery) return; //stop recursion

            continueQuery = matchingFunc.call(this, currContext);
            if (continueQuery == undefined) continueQuery = true;

            for (let key in currContext) {
                
                // filter out metadata and attributes
                if (key !== '$parent' && key !== '$key' && key.search('@') != 0) {
                    
                    const prop = currContext[key];
                    
                    if (processRefs === true && key === 'ref') {
                        const refs = (isArray(prop)) ? prop : [prop];

                        // const defs = [];

                        refs.forEach((ref) => {
                            const name = ref['@name'];
                            if (defHits[name] === undefined) {
                                defHits[name] = true;
                                const def = _getDefinition(name);
                                if (def !== null) doQuery(def);
                            } 
                        });

                    } else {
                        if (isArray(prop)) {
                            prop.forEach((item) => doQuery(item))
                        } else if (isObject(prop)) {
                            doQuery(prop);
                        }
                    }
                }
            }
            
        }
        
        doQuery(context);
    }

    /**
     * Gets the schema definition for a specified name
     * @param {String} name The name
     * @returns {Object|Null}
     */
    const _getDefinition = (name) => {
		const defs = schemaJSON.grammar.define;

		const definition = defs.find((def) => def['@name'] === name);

		if (!definition) {
			console.warn('schemaNavigator: no definition found for', name);
			return null;
		}

		return definition;
	};

    /**
     * Parses the passed documentation string and returns the full name.
     * If the tag name is an abbreviation, we expect the full name to be at the beginning of the documentation, in parentheses.
     * @param {String} documentation The documentation string
     * @returns {String}
     */
    const _getFullNameFromDocumentation = (documentation) => {
        const hit = /^\((.*?)\)/.exec(documentation);
        if (hit === null) return '';
        return hit[1];
    }
    
    return sn;
}

export default SchemaNavigator;
