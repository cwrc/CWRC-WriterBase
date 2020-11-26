/**
 * Navigates the schema JSON to get parents, children, and attributes for tags or paths.
 * Paths are essentially XPaths, however only element names and the child axis "/" are supported, e.g. TEI/text/body/div/p
 */

import { get as lodashGet, set as lodashSet } from 'lodash';
import objectScan from 'object-scan';
import { filter } from './schemaNavigatorFilter';

let schemaJSON;
let schemaElements;

const patternCodes = new Set(['oneOrMore', 'zeroOrMore', 'optional']);

export const setSchemaJSON = (json) => {
	schemaJSON = reprocessJson(json);
	console.log(schemaJSON);
	return;
};

export const setSchemaElements = (elements) => (schemaElements = elements);

/**
 * Add Metadata to the Schema
 * : fullname & documentation
 * Returns Schema
 * @param {Object} schema The schema in json format
 * @returns {Object}
 */
const reprocessJson = (schema) => {
	console.time('JSON SCHEMA REPROCESS')
	const types = new Set();

	const elementTypesToProcess = new Set(['element', 'ref', 'attribute' ])

	const tags = objectScan(['*.**.elements'], {
		useArraySelector: false,
		rtn: 'context',
		filterFn: ({ key, value, context }) => {
			types.add(value.name);
			if (elementTypesToProcess.has(value.name)) {
				addMetadata(schema, key, value);
				context.elements.push(key);
			}
		},
	})(schema, {
		elements: [],
		refs: [],
		attributes: [],
	});

	console.log(types);
	console.timeEnd('JSON SCHEMA REPROCESS')

	return schema;
};

const addMetadata = (schema, path, type) => {
	// console.log(path)

	// Get the element using the path
	const element = lodashGet(schema, path);
	// console.log(element)

	// full path
	const fullPathKey = [...path, 'fullPath'];
	lodashSet(schema, fullPathKey, path);


	// documentation & Full name
	if (type === 'element') {
		const documentation = getDocumentation(element);
		if (documentation) {
			const documentationKey = [...path, 'documentation'];
			lodashSet(schema, documentationKey, documentation);
		
			//fullname
			const fullName = documentation ? getFullNameFromDocumentation(documentation) : null;
			if (fullname) {
				const fullNameKey = [...path, 'fullName'];
				lodashSet(schema, fullNameKey, fullName);
			}
		}
	}

	//Pattern
	const clonePath = [...path];
	clonePath.pop(); //remove itself

	const pattern = {
		name: null,
		index: 0,
		isChoice: false,
	};

	// Query Up
	while (clonePath.length > 0) {
		const parent = lodashGet(schema, clonePath);
		
		if (element === 'element' || pattern.name) break;
		if (patternCodes.has(parent.name)) {
			pattern.name = parent.name;
			pattern.index = clonePath[clonePath.length-1];
		}
		if (parent.name === 'choice') pattern.isChoice = true;
		clonePath.pop();
	}

	if (pattern.name !== null) {
		const patternKey = [...path, 'pattern'];
		lodashSet(schema, patternKey, pattern);
	}
}

/**
 * Check if the element has [a:documentation] tag
 * Remove whitespaces
 * Return documentation
 * @param {Object} element The element
 * @returns {String}
 */
const getDocumentation = (element) => {
	const doc = element?.elements[0];
	if (doc.name !== 'a:documentation') return null;
	let text = doc?.elements[0]?.text;
	text = text.replace(/\s+/g, ' ');
	return text;
};

/**
 * Parses the passed documentation string and returns the full name.
 * If the tag name is an abbreviation, we expect the full name to be at the beginning of the documentation, in parentheses.
 * @param {String} documentation The documentation string
 * @returns {String}
 */
const getFullNameFromDocumentation = (doc) => {
	const hit = /^\((.*?)\)/.exec(doc);
	if (hit === null) return '';
	return hit[1];
};

/**
 * Gets the schema definition for a specified name
 * @param {String} name The name
 * @returns {Object|Null}
 */
const getDefinition = (name) => {
	const definition = schemaJSON.elements[0].elements.find((def) => (
		def.name === 'define' && def.attributes.name === name
	));
	const element = definition.elements[0];

	if (!element) {
		console.warn(`SchemaNavigator: No definition found for ${name}`);
		return null;
	}

	return element;
};

/**
 * Gets the schema definition for a specified name
 * @param {String} name The name
 * @returns {Object|Null}
 */
const getDefinitionByFullPath = (fullPath) => {
	return lodashGet(schemaJSON, fullPath);
};

const filterByPresentTags = (tags, presentTags) => {
	const contextualAvailbaleTags = filter(tags, presentTags);
	// console.log(contextualAvailbaleTags)
	return contextualAvailbaleTags
}

/**
 * Returns an array of valid children for a particular path
 * @param {String} path The path
 * @param {Array} context Array of tags in the local context tag
 * @returns {Array}
 */
export const getChildrenForPath = (path) => {
	// console.log(path);

	// console.time('getChildrenForPath');
	const grammarElement = getEntryForPath({ path });
	// console.log(grammarElement)
	const childrenElements = getElementChildren(grammarElement);
	// console.log(childrenElements)
	// console.timeEnd('getChildrenForPath');

	return childrenElements;
};

/**
 * Returns an array of valid parents for a particular path
 * @param {String} path The path
 * @param {Array} context Array of tags in the local context tag
 * @returns {Array}
 */
export const getParentsForPath = (path) => {
	// console.log(path);

	// console.time('getParentForPath');
	const grammarElement = getEntryForPath({ path });
	// console.log(grammarElement)
	const parentElements = getElementParents(grammarElement);
	// console.log(parentElements)

	// console.timeEnd('getParentForPath');

	return parentElements;
};

/**
 * Uses a XPATH to find the related entry in the Schema (JSON).
 * @param Objects Contains the following
 * @param {String} path A forward slash delimited pseudo-xpath
 * @param {String} formatResult How the result will be formated. It can be either 'path' [Array] or 'object' [Object]
 * @returns {Object}
 */
const getEntryForPath = ({ path, formatResult = 'path' }) => {
	//* Clean and split XPATH
	const cleanPath = path.replace(/\[\d+\]/g, ''); // remove any indexing
	const pathTags = cleanPath.split('/');

	const elementTypes = new Set(['element', 'ref'])

	//start from the root of schema
	let contextGrammar = schemaJSON;

	//* Loop through the PATH levels to find the correnspondent element.
	// Use the level's element as context to the next level
	pathTags.forEach((tag) => {
		if (tag === '') return;
		// console.log(tag)

		//traverse the tree to find the elements or references that matches the path level
		let matchTags = objectScan(['*.**.elements'], {
			useArraySelector: false,
			rtn: 'entry',
			filterFn: ({ value }) => {
				return elementTypes.has(value.name) && value?.attributes?.name === tag;
			},
		})(contextGrammar);

		// console.log(matchTags)

		//* If there is more than one
		// Get the one that is an eleement (which means locally defined)
		let element = matchTags.find(([key, value]) => value.name === 'element');

		//if no "element" is found, use the first match;
		if (!element) element = matchTags[0];

		//desconstruct and get parent.
		const [key, value] = element;

		//if reference (ref), get element from global definition and pass it as nex context
		if (value.name === 'ref') {
			const definition = getDefinition(value.attributes.name);
			contextGrammar = { tag: definition };
		} else {
			//* wrap the result in an object for better parsing
			contextGrammar = { tag: value };
		}
	});

	// console.log(contextGrammar);

	return contextGrammar;
};

/**
 * Traverse the tree to find first level elements or references.
 * Returns all the element children of an element schema entry
 * - filterFn: collect fullname if 'ref', add relative path and parent metadata, and push element the results
 * - breakFn: avoids getting deeper into the tree because it might be getting metadata from locally defined tag
 * @param {Object} element The schema entry
 * @returns {Array} children elements
 */
const getElementChildren = (grammarElement) => {
	// Parent
	//reduce parent data
	const parentData = (grammarElement?.tag) ? grammarElement.tag : grammarElement;
	const parent = {
		name: parentData.name,
		type: parentData.type,
		fullPath: parentData.fullPath,
		attributes: parentData.attributes,
	};

	const elementTypes = new Set(['element', 'ref'])
	
	// Traverse the tree 
	const collection = objectScan(['*.**.elements'], {
		useArraySelector: false,
		rtn: 'context',
		filterFn: ({context, key, value}) => {

			if (!elementTypes.has(value.name)) return;

			// Get fullname if reference
			if (value.name === 'ref') {
				const definition = lodashGet(schemaJSON, value.fullPath);
				const fullName = definition.fullName ?? '';
				value = {...value, fullName}
			}

			//Add to collection
			context.children.push({
				...value,
				parent,
				relativePath: key,
			})
			
		},
		breakFn: ({ value, key }) => {
			return value.name === 'element' && key.length > 1;
		},
	})(grammarElement.tag, { children: [] });

	return collection.children;
};


/**
 * Traverse the tree to find parents for a tag.
 * Returns all the parents for an element schema entry
 * - filterFn: focus in the elment in question, collect the first 'element' parent, add child metadata and push element the results
 * @param {Object} element The schema entry
 * @returns {Array} parent elements
 */
const getElementParents = (grammarElement) => {
	// Child
	//reduce child data
	const childData = (grammarElement?.tag) ? grammarElement.tag : grammarElement;
	const child = {
		name: childData.name,
		type: childData.type,
		fullPath: childData.fullPath,
		attributes: childData.attributes,
	};

	const elementTypes = new Set(['element', 'ref'])

	// Traverse the tree 
	const collection = objectScan(['*.**.elements'], {
		useArraySelector: false,
		rtn: 'context',
		filterFn: ({ value, parents, context }) => {

			if (!elementTypes.has(value.name)) return;

			//focus on the specific element
			if (value?.attributes?.name === child.attributes.name) {
				// console.log(value)

				//collect the firt element parent
				for (const parent of parents) {
					if (parent.name === 'element') {
						context.parents.push({ ...parent, child });
						break;
					}
				}
			}
		},
	})(schemaJSON, {parents: []});

	return collection.parents;
};

export default {
	setSchemaJSON,
	setSchemaElements,
	getChildrenForPath,
	getParentsForPath,
	filterByPresentTags,
	getDefinitionByFullPath
};
