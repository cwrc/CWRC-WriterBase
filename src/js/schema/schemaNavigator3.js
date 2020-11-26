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
	schemaJSON = addMetadataToElements(json);
	// console.log(schemaJSON);
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
const addMetadataToElements = (schema) => {
	//seach for all Tag elements
	//use the attribute "@name" as query
	const elements = objectScan(['*.**.element.@name'], {
		useArraySelector: false,
	})(schema);

	const refs = objectScan(['*.**.ref.@name'], {
		useArraySelector: false,
	})(schema);

	// console.log(elements)
	// console.log(elements.length)

	//loop trough the elements to add extra metadada
	elements.forEach((path) => {
		path.pop();
		// console.log(path)

		// Get the element using the path
		const element = lodashGet(schema, path);

		//full path
		const fullPathKey = [...path, 'fullPath'];
		lodashSet(schema, fullPathKey, path);

		//key
		const keyName = [...path, '#name'];
		const key = 'element';
		lodashSet(schema, keyName, key);

		// documentation
		const documentationKey = [...path, 'documentation'];
		const documentation = getDocumentation(element);
		lodashSet(schema, documentationKey, documentation);

		//fullname
		const fullname = documentation ? getFullNameFromDocumentation(documentation) : null;
		if (fullname) {
			const fullNameKey = fullname ? [...path, 'fullName'] : null;
			lodashSet(schema, fullNameKey, fullname);
		}

		//Pattern
		const reversedPath = [...path];
		reversedPath.reverse();
		reversedPath.shift(); //remove selft

		const pattern = {
			name: null,
			instance: 0,
			isChoice: false,
		};

		for (const [index, element] of reversedPath.entries()) {
			if (element === 'element' || pattern.name) break;
			if (patternCodes.has(element)) pattern.name = element;
			if (typeof element === 'number') pattern.instance = element;
			if (element === 'choice') pattern.isChoice = true;
		}

		if (pattern.name !== null) {
			const patternKey = [...path, 'pattern'];
			lodashSet(schema, patternKey, pattern);
		}
	});

	refs.forEach((path) => {
		path.pop();
		// console.log(path)

		// Get the element using the path
		const ref = lodashGet(schema, path);

		// console.log(ref)

		//full path
		const fullPathKey = [...path, 'fullPath'];
		lodashSet(schema, fullPathKey, path);

		// //key
		const keyName = [...path, '#name'];
		const key = 'ref';
		lodashSet(schema, keyName, key);

		//Pattern
		const reversedPath = [...path];
		reversedPath.reverse();
		reversedPath.shift(); //remove selft

		const pattern = {
			name: null,
			instance: 0,
			isChoice: false,
		};

		for (const [index, element] of reversedPath.entries()) {
			if (element === 'element' || pattern.name) break;
			if (patternCodes.has(element)) pattern.name = element;
			// if (element === 'optional' || element === 'oneOrMore' || element === 'zeroOrMore') {
			// 	pattern.name = element;
			// }
			if (typeof element === 'number') pattern.instance = element;
			if (element === 'choice') pattern.isChoice = true;
		}

		if (pattern.name !== null) {
			const patternKey = [...path, 'pattern'];
			lodashSet(schema, patternKey, pattern);
		}
	});

	// console.log(refs)
	// console.log(refs.length)

	// console.log(schema)

	return schema;
};

/**
 * Check if the element has [a:documentation] tag
 * Remove whitespaces
 * Return documentation
 * @param {Object} element The element
 * @returns {String}
 */
const getDocumentation = (element) => {
	if (!element['a:documentation']) return '';

	let doc = element['a:documentation']?.['_']
		? element['a:documentation']?.['_']
		: element['a:documentation'];

	doc = doc.replace(/\s+/g, ' ');

	return doc;
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
	const defs = schemaJSON.define;
	const definition = defs.find((def) => def['@name'] === name);

	if (!definition) {
		console.warn(`SchemaNavigator: No definition found for ${name}`);
		return null;
	}

	return definition;
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

	//start from the root of schema
	let contextGrammar = schemaJSON;

	//* Loop through the PATH levels to find the correnspondent element.
	// Use the level's element as context to the next level
	pathTags.forEach((tag) => {
		if (tag === '') return;

		//traverse the tree to find the elements or references that matches the path level
		let matchTags = objectScan(['*.**.(element|ref).**'], {
			useArraySelector: false,
			rtn: 'entry',
			filterFn: ({ getValue }) => getValue()?.['@name'] === tag,
		})(contextGrammar);

		//* If there is more than one
		// Get the one that is an eleement (which means locally defined)
		let element = matchTags.find(([key, value]) => value['#name'] === 'element');

		//if no "element" is found, use the first match;
		if (!element) element = matchTags[0];

		//desconstruct and get parent.
		const [key, value] = element;

		//if reference (ref), get element from global 	definition and pass it as nex context
		if (value['#name'] === 'ref') {
			const definition = getDefinition(value['@name']);
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

	const parentData = (grammarElement.tag?.element) ? grammarElement.tag.element : grammarElement.tag;

	// Parent
	const {['#name']: elementType, ['@name']: elementName, fullPath} = parentData;
	const parent = {
		['#name']: elementType,
		['@name']: elementName,
		fullPath
	};

	// Traverse the tree 
	const collection = objectScan(['*.**.(element|ref)'], {
		useArraySelector: false,
		rtn: 'context',
		filterFn: ({context, key, value}) => {

			// Get fullname if reference
			if (value['#name'] === 'ref') {
				const definition = lodashGet(schemaJSON, value.fullPath);
				const fulllName = definition.fullName ?? '';
				value = {...value, fulllName}
			}

			//Add to collection
			context.children.push({
				...value,
				parent,
				relativePath: key,
			})
		},
		breakFn: ({ getValue, key }) => {
			return getValue()['#name'] === 'element' && key.length > 1;
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

	const childData = (grammarElement.tag?.element) ? grammarElement.tag.element : grammarElement.tag;

	// Child
	const {['#name']: elementType, ['@name']: elementName, fullPath} = childData;
	const child = {
		['#name']: elementType,
		['@name']: elementName,
		fullPath
	};

	// Traverse the tree 
	const collection = objectScan(['*.**.(element|ref)'], {
		useArraySelector: false,
		rtn: 'context',
		filterFn: ({ getValue, getParents, context }) => {

			//focus on the specific element
			if (getValue()['@name'] === child['@name']) {

				//collect the firt element parent
				for (const parent of getParents()) {
					if (parent['#name'] === 'element') {
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
