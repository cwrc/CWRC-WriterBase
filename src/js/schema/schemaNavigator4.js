/**
 * Navigates the schema JSON to get parents, children, and attributes for tags or paths.
 * Paths are essentially XPaths, however only element names and the child axis "/" are supported, e.g. TEI/text/body/div/p
 */

import { get as lodashGet, set as lodashSet } from 'lodash';
import objectScan from 'object-scan';
import { filter } from './schemaNavigatorFilter';

//CONSTANTS
export const ATTRIBUTE = 'attribute';
export const DEFINE = 'define';
export const ELEMENT = 'element';
export const REF = 'ref';

export const CHOICE = 'choice';
export const ONE_OR_MORE = 'oneOrMore';
export const OPTIONAL = 'optional';
export const ZERO_OR_MORE = 'zeroOrMore';

export const PATTERN_CODES = new Set([ONE_OR_MORE, OPTIONAL, ZERO_OR_MORE]);

//variables
let schemaJSON;
let schemaElements;

export const setSchemaJSON = (json) => {
	schemaJSON = reprocessJson(json);
	console.log(schemaJSON);
	return;
};

// eslint-disable-next-line no-unused-vars
export const setSchemaElements = (elements) => (schemaElements = elements);

/**
 * Reprocesses JSON: Add Metadata to the Schema
 * ALL: { fullPathKey }
 * Where Patterns apply: {pattern: {name, index, isChoice} }
 * ELEMENTS only: { fullname, documetation }
 * Returns Schema
 * @param {Object} schema The schema in json format
 * @returns {Object} The schema reprocessed
 */
const reprocessJson = (schema) => {
	console.time('JSON SCHEMA REPROCESS');
	const elementTypesToProcess = new Set([ATTRIBUTE, ELEMENT, REF]);

	const types = new Set();

	//Get all nodes that match the types to reprocess
	objectScan(['*.**.elements'], {
		useArraySelector: false,
		rtn: 'context',
		filterFn: ({ key, value, context }) => {
			types.add(value.name); //Just add the availables types in the schema to a SET. For testing purposes.
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
	console.timeEnd('JSON SCHEMA REPROCESS');

	return schema;
};

/**
 * Adds Metadata to an element
 * ALL: { fullPathKey }
 * Where Patterns apply: {pattern: {name, index, isChoice} }
 * ELEMENTS only: { fullname, documetation }
 * @param {Object} schema The schema in json format
 * @param {Array} path A list of keys to access the element on the schema
 * @param {Object} type The type of element: e.g., element, attribute, ref
 * @returns {Array} The path to the element.
 */
const addMetadata = (schema, path, type) => {
	// Get the element using the path
	const element = lodashGet(schema, path);

	// Full path
	const fullPathKey = [...path, 'fullPath'];
	lodashSet(schema, fullPathKey, path);

	// ELEMENT: Full Name & Documentation
	if (type === ELEMENT) {
		const documentation = getDocumentation(element);
		if (documentation) {
			const documentationKey = [...path, 'documentation'];
			lodashSet(schema, documentationKey, documentation);
		}

		const fullName = documentation ? getFullNameFromDocumentation(documentation) : null;
		if (fullName) {
			const fullNameKey = [...path, 'fullName'];
			lodashSet(schema, fullNameKey, fullName);
		}
	}

	// Pattern
	const clonePath = [...path];
	clonePath.pop(); //Remove itself

	const pattern = {
		name: null,
		index: 0,
		isChoice: false,
	};

	// Query Up to find the pattern information. Stop on the parent ELEMENT.
	while (clonePath.length > 0) {
		const parent = lodashGet(schema, clonePath);

		if (element === ELEMENT || pattern.name) break;
		if (PATTERN_CODES.has(parent.name)) {
			pattern.name = parent.name;
			pattern.index = clonePath[clonePath.length - 1];
		}
		if (parent.name === CHOICE) pattern.isChoice = true;
		clonePath.pop();
	}

	// Store pattern
	if (pattern.name !== null) {
		const patternKey = [...path, 'pattern'];
		lodashSet(schema, patternKey, pattern);
	}

	return path;
};

/**
 * Gets element's documention
 * if it has the tag [a:documentation].
 * Remove whitespaces if needed.
 * @param {Object} element The element
 * @returns {String} The documentation
 */
const getDocumentation = (element) => {
	const doc = element?.elements[0];
	if (doc.name !== 'a:documentation') return null;
	let text = doc?.elements[0]?.text;
	text = text.replace(/\s+/g, ' ');
	return text;
};

/**
 * Parses documentation string and returns the full name.
 * If the tag name is an abbreviation, we expect the full name to be at the beginning of the documentation, in parentheses.
 * @param {String} documentation The documentation string
 * @returns {String} The full name
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
const getDefinitionByName = (name) => {
	const definition = schemaJSON.elements[0].elements.find(
		(def) => def.name === DEFINE && def.attributes.name === name
	);
	const element = definition?.elements[0];

	if (!element) {
		console.warn(`SchemaNavigator: No definition found for ${name}`);
		return null;
	}

	return element;
};

/**
 * Gets the schema definition for a specified path
 * @param {Array} fullPath The path
 * @returns {Object|Null}
 */
const getDefinitionByFullPath = (fullPath) => {
	return lodashGet(schemaJSON, fullPath);
};

/**
 * Proxy Function: Filters tags for an element using tags already present in the document in the context of the cursor.
 * @param {Array} tags Tags to be filtered
 * @param {Array} presentTags Tags present in the document
 * @returns {Array} Filtered tags
 */
const filterByPresentTags = (tags, presentTags) => {
	const filteredTags = filter(tags, presentTags);
	// console.log(filteredTags)
	return filteredTags;
};

/**
 * Returns an array of valid children for a particular path
 * @param {String} path The path
 * @returns {Array} Collection children tags
 */
export const getChildrenForPath = (path) => {
	const grammarElement = getEntryForPath(path);
	// console.log(grammarElement)
	const childrenElements = getElementChildren(grammarElement);
	// console.log(childrenElements)
	return childrenElements;
};

/**
 * Returns an array of valid parents for a particular path
 * @param {String} path The path
 * @returns {Array} Collection parent tags
 */
export const getParentsForPath = (path) => {
	// console.time('getParentForPath');
	const grammarElement = getEntryForPath(path);
	// console.log(grammarElement)
	const parentElements = getElementParents(grammarElement);
	// console.log(parentElements)
	return parentElements;
};

/**
 * Uses a XPATH to find the related entry in the Schema (JSON).
 * @param {String} path A forward slash delimited pseudo-xpath
 * @returns {Object} The element
 */
const getEntryForPath = (path) => {
	// Clean and split XPATH
	const cleanPath = path.replace(/\[\d+\]/g, ''); // remove any indexing
	const pathTags = cleanPath.split('/');

	//look for these type of elements
	const elementTypes = new Set([ELEMENT, REF]);

	//start from the root of schema
	let contextGrammar = schemaJSON;

	// Loop through the PATH levels to find the correnspondent element.
	// Use the element on each level as context to the next level
	// console.log(path, pathTags);
	pathTags.forEach((tag) => {
		if (!tag || tag === '') return;

		//traverse the tree to find the elements or references that matches the path level
		let matchTags = objectScan(['*.**.elements'], {
			useArraySelector: false,
			rtn: 'entry',
			filterFn: ({ value }) => {
				return elementTypes.has(value.name) && value?.attributes?.name === tag;
			},
		})(contextGrammar);

		// TODO 
		if (matchTags.length === 0) {
			const definition = getDefinitionByName(tag);
			return contextGrammar = { tag: definition };
		}

		// If there is more than one elment
		// Get the one that is an eleement type (which means locally defined element)
		// eslint-disable-next-line no-unused-vars
		let element = matchTags.find(([key, value]) => value.name === ELEMENT);

		//if no element type is found, use the first match;
		if (!element) element = matchTags[0];

		//deconstruct to get th element.
		// eslint-disable-next-line no-unused-vars
		let [key, value] = element;

		//If it is an reference (ref), get element from global definition and pass it as the next context
		if (value.name === REF) {
			const definition = getDefinitionByName(value.attributes.name);
			value = definition;
		}

		// wrap the result in an object for better parsing
		contextGrammar = { tag: value };
	});

	return contextGrammar;
};

/**
 * Traverses the tree to find first level children (elements and references).
 * Returns all the element children of an element schema entry
 * - filterFn:
 * 	- Collects fullname if 'ref'.
 * 	- Adds relative path and parent metadata.
 * - breakFn:
 * 	- Avoids getting deeper into the tree because it might be getting metadata from locally defined tags
 * @param {Object} element The schema entry
 * @returns {Array} children elements
 */
const getElementChildren = (grammarElement) => {
	//Reduce parent data
	const parentData = grammarElement?.tag ? grammarElement.tag : grammarElement;
	const parent = {
		name: parentData.name,
		type: parentData.type,
		fullPath: parentData.fullPath,
		attributes: parentData.attributes,
	};

	const elementTypes = new Set([ELEMENT, REF]);

	// Traverse the tree
	const collection = objectScan(['*.**.elements'], {
		useArraySelector: false,
		rtn: 'context',
		filterFn: ({ context, key, value }) => {
			if (!elementTypes.has(value.name)) return;

			// Get fullname if reference
			if (value.name === REF) {
				const definition = lodashGet(schemaJSON, value.fullPath);
				const fullName = definition.fullName ?? '';
				value = { ...value, fullName };
			}

			//Add to collection
			context.children.push({
				...value,
				parent,
				relativePath: key,
			});
		},
		breakFn: ({ value, key }) => value.name === ELEMENT && key.length > 1,
	})(grammarElement.tag, { children: [] });

	return collection.children;
};

/**
 * Traverse the tree to find parents for a tag.
 * Returns all the parents for an element schema entry
 * - filterFn:
 * 	- Focuses in a particular element.
 * 	- Collect the first 'element type' parent.
 * 	- Adds child metadata.
 * @param {Object} element The schema entry
 * @returns {Array} parent elements
 */
const getElementParents = (grammarElement) => {
	//Reduce child data
	const childData = grammarElement?.tag ? grammarElement.tag : grammarElement;
	const child = {
		name: childData.name,
		type: childData.type,
		fullPath: childData.fullPath,
		attributes: childData.attributes,
	};

	const elementTypes = new Set([ELEMENT, REF]);

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
					if (parent.name === ELEMENT) {
						context.parents.push({ ...parent, child });
						break;
					}
				}
			}
		},
	})(schemaJSON, { parents: [] });

	return collection.parents;
};

export default {
	getChildrenForPath,
	getDefinitionByFullPath,
	getParentsForPath,
	filterByPresentTags,
	setSchemaElements,
	setSchemaJSON,
};
