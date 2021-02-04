/**
 * Navigates the schema JSON to get parents, children, and attributes for tags or paths.
 * Paths are essentially XPaths, however only element names and the child axis "/" are supported, e.g. TEI/text/body/div/p
 */

import { get as lodashGet, set as lodashSet } from 'lodash';
import objectScan from 'object-scan';
import { filterByTags, limitByPosition } from './schemaNavigatorFilter';

//CONSTANTS
export const ATTRIBUTE = 'attribute';
export const DEFINE = 'define';
export const ELEMENT = 'element';
export const REF = 'ref';

export const CHOICE = 'choice';
export const ONE_OR_MORE = 'oneOrMore';
export const OPTIONAL = 'optional';
export const ZERO_OR_MORE = 'zeroOrMore';

export const GROUP = 'group';

export const PATTERN_CODES = new Set([
	CHOICE,
	ONE_OR_MORE,
	OPTIONAL,
	ZERO_OR_MORE,
	GROUP,
]);

//variables
let schemaJSON;
let schemaElements;

export const setSchemaJSON = (json) => {
	schemaJSON = json;
	schemaJSON = reprocessJson(schemaJSON);
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
		// eslint-disable-next-line no-unused-vars
		filterFn: ({ key, value, context }) => {
			types.add(value.name); //Just add the availables types in the schema to a SET. For testing purposes.
			if (elementTypesToProcess.has(value.name)) {
				addMetadata(schema, key, value.name);
				// context.elements.push(key);
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
		
		//Is empty tag
		const isEmptyTagKey = [...path, 'isEmptyTag'];
		const children = getElementChildren(element);
		const isEmptyTag = children.length === 0 ? true : false;
		lodashSet(schema, isEmptyTagKey, isEmptyTag);
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
 * Proxy Function: Filters tags for an element using tags already present
 * in the document in the context of the cursor.
 * @param {Array} tags Tags to be filtered
 * @param {Array} presentTags Tags present in the document
 * @returns {Array} Filtered tags
 */
const filterByPresentTags = (tags, presentTags) => {
	const filteredTags = filterByTags(tags, presentTags);
	// console.log(filteredTags)
	return filteredTags;
};

/**
 * Proxy Function: Filters tags for an element using
 * the position of the current tag in the document.
 * @param {Object} {} Parameters
 * @param {Array} filteredTags Tags to be filtered
 * @param {String} direction Direction to check: before, after, or both
 * @param {Object} element The element of reference
 * @param {Object} context Contain the children, sibling, and parents of the element of reference
 * @returns {Array} Filtered tags
 */
const limitByTagPosition = ({ tags, direction, element, context }) => {
	const filteredTags = limitByPosition({
		tags,
		direction,
		context,
		element,
	});
	return filteredTags;
};

/**
 * Returns an array of valid children for a particular path
 * @param {String} path The path
 * @returns {Array} Collection children tags
 */
export const getChildrenForPath = (path) => {
	const grammarElement = getEntryForPath(path);
	// console.log(grammarElement);
	let childrenElements = getElementChildren(grammarElement);
	childrenElements = postProcessPattern(childrenElements);
	console.log(childrenElements);
	// console.log('!!!!!!!!');
	return childrenElements;
	// return [];
};

const postProcessPattern = (tags) => {
	//process pattern
	//each pair of name and index is a pattern
	//multiple pairs means nested patterns
	tags = tags.map((child) => {
		if (!child.patternPath) return child;

		//reverse patternPath because it was backwarded collected (deep to root)
		let patternPath = [...child.patternPath].reverse();
		patternPath = patternPath.reduce(function(result, value, index, array) {
			if (index % 2 === 0) result.push(array.slice(index, index + 2));
			return result;
		}, []);

		child.pattern = patternPath;
		// child.patternSet = patternSet;
		return child;
	});

	return tags;
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
			return (contextGrammar = { tag: definition });
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
const getElementChildren = (grammarElement, level = 0) => {
	// console.group(`getElementChildren: ${level}`);
	// console.log(grammarElement);

	const elementTypes = new Set([ELEMENT, REF]);

	//FILTER FUNCION WITHIN OBJECT SCAN
	const filter = ({ key, context, value, parents }) => {
		// console.group(`filter: ${level} - ${value.name}:${value?.attributes?.name ?? ''}`);
		// console.log({key, value, parents});

		// * Skip if not ELEMENT OR REF
		if (!elementTypes.has(value.name)) {
			// console.groupEnd();
			return;
		}

		//? SKIP FOR DEBUG PURSPUSES
		// console.log(`---${value.name}`);
		// if (value.attributes.name.includes('model.phrase')
		// 	|| value.attributes.name.includes('model.global')
		// 	// || value.attributes.name.includes('model.inter')
		// 	|| value.attributes.name.includes('model.gLike'))
		// {
		// 	// console.groupEnd();
		// 	return;
		// }

		// * Working variable
		let item = value;
		// console.log({value});

		// * if item is REF, get and replace for DEFINITION.
		if (value.name === REF) item = { ...getDefinitionByName(item.attributes.name) };
		// if (value?.attributes?.name === 'anchor') console.log(item);

		//* IMPORTANT: if the definition is not one of the key elements type [REF, ELEMENT],
		//* DRILL DOWN RECURSIVELLY calling getElementChildren function until find the tag's element children
		if (!elementTypes.has(item.name)) {
			// console.log('DRILL DOWN');
			item = getElementChildren(item, level + 1);
		}

		// * process Pattern
		let patternPath = parseTagPattern(key, parents);
		// console.log({name: item.name,patternPath});

		//* Add to collection
		const addToContextChildren = (elem) => {
			// * Only consider 'element' (i.e., not ref or attr)
			if (elem.name !== ELEMENT) {
				// console.groupEnd();
				return;
			}

			// console.log({elem,patternPath});
			// * add or append pattern path
			if (patternPath.length > 0) {
				elem.patternPath = elem.patternPath
					? [...elem.patternPath, ...patternPath]
					: patternPath;
			}

			//add
			context.children.push(elem);
		};

		// if array add one at a time;
		if (Array.isArray(item)) {
			item.forEach((_item) => addToContextChildren(_item));
		} else {
			addToContextChildren(item);
		}

		// console.groupEnd();
	};

	// Traverse the tree
	const collection = objectScan(['**.elements'], {
		useArraySelector: false,
		rtn: 'context',
		filterFn: ({ key, context, value, parents }) => filter({ key, context, value, parents }),
		breakFn: ({ value, key }) => value?.name === ELEMENT && key.length > 1,
	})(grammarElement, { children: [] });

	// console.log(collection.children);
	// console.log('******');
	// console.groupEnd();
	return collection.children;
};

//each pair of pattern name and index is a level of pattern.
//Multiple pairs means nested pattern
const parseTagPattern = (key, parents) => {
	// Pattern
	key.reverse(); // reverse keys to follow the same direction as parents (from top to bottom)

	const patternPath = [];

	// patternPath.push(`--${item.attributes.name}`);
	while (parents.length > 0) {
		const _parent = parents[0];
		const _key = key[0];

		if (_parent.name === ELEMENT) break;

		//pattenr index
		if (PATTERN_CODES.has(patternPath[patternPath.length - 1]) && Array.isArray(_parent))
			patternPath.push(_key);

		//pattern name
		if (PATTERN_CODES.has(_parent.name)) patternPath.push(_parent.name);

		parents.shift();
		key.shift();
	}

	//If partern group is mission, it is most probable that it is a unique group
	//Add ggto
	if (PATTERN_CODES.has(patternPath[patternPath.length - 1])) patternPath.push(0);

	return patternPath;
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
const getElementParents = (grammarElement, level = 0) => {
	// console.group(`getElementParents: ${level}`);
	// console.log(grammarElement);

	//Reduce child data
	const childData = grammarElement?.tag ? grammarElement.tag : grammarElement;
	const child = {
		name: childData.name,
		type: childData.type,
		fullPath: childData.fullPath,
		attributes: childData.attributes,
	};

	const elementTypes = new Set([ELEMENT, REF]);

	//FILTER FUNCION WITHIN OBJECT SCAN
	const filter = ({ context, value, parents }) => {
		// * Skip if not ELEMENT OR REF
		if (!elementTypes.has(value.name)) return;
		// console.log({ value, parents });

		// // * Skip if not ELEMENT OR REF
		// if (!elementTypes.has(value.name)) {
		// 	console.groupEnd();
		// 	return;
		// }

		// *focus on the specific element
		if (value?.attributes?.name === child.attributes.name) {
			// console.group(`filter: ${level} - ${value.name}:${value?.attributes?.name ?? ''}`);

			//Find the first parent element that is and element or DEFINE it
			let parentElement = parents.find(
				(parent) =>
					parent.name === ELEMENT ||
					(parent.name === DEFINE && parent.attributes.name !== child.attributes.name)
			);
			// console.log(parentElement);

			//* IMPORTANT: if parent DEFINEs and ELEMENT,
			//* DRILL UP RECURSIVELLY calling getElementParents function until find the tag's element parent
			if (parentElement?.name === DEFINE) {
				// console.log('DRILL DOWN');
				parentElement = getElementParents(parentElement, level + 1);
			}

			//* Add to collection
			const addToContext = (elem) => {
				if (elem && elem?.attributes?.name !== child.attributes.name) {
					context.parents.push({ ...elem, child });
				}
			};

			// if array add one at a time;
			if (Array.isArray(parentElement)) {
				parentElement.forEach((item) => addToContext(item));
			} else {
				addToContext(parentElement);
			}

			// console.groupEnd();
		}
	};

	// Traverse the tree
	const collection = objectScan(['**.elements'], {
		useArraySelector: false,
		rtn: 'context',
		filterFn: ({ key, context, value, parents }) => filter({ key, context, value, parents }),
	})(schemaJSON, { parents: [] });

	// console.log(collection.parents);
	// console.log('******');
	// console.groupEnd();

	return collection.parents;
};

export default {
	getChildrenForPath,
	getDefinitionByFullPath,
	getParentsForPath,
	filterByPresentTags,
	limitByTagPosition,
	setSchemaElements,
	setSchemaJSON,
};
