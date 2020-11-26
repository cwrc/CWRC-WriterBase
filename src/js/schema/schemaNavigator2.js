/**
 * Navigates the schema JSON to get parents, children, and attributes for tags or paths.
 * Paths are essentially XPaths, however only element names and the child axis "/" are supported, e.g. TEI/text/body/div/p
 */

import { concat, get as lodashGet, set as lodashSet } from 'lodash';
import objectScan from 'object-scan';


let schemaJSON;
let schemaJSON_alt1;
let schemaJSON_alt2;
let schemaJSON_alt3;
let schemaJSON_alt4;
let schemaJSON_alt5;
let schemaElements;


export const setSchemaJSON = (json, alternative) => {
	if (alternative === 'ObjTree') {
		// schemaJSON_alt1 = json;
		schemaJSON_alt1 = addMetadataToElements(json);
		console.log(schemaJSON_alt1);
	}
	if (alternative === 'xml2js') schemaJSON_alt2 = json;
	if (alternative === 'xml-js-compact') schemaJSON_alt3 = json;
	if (alternative === 'xml-js') schemaJSON_alt4 = json;
    if (alternative === 'fxp') schemaJSON_alt5 = json;
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

	//skip root
	const grammar = schema.grammar;

	//seach for all Tag elements
	//use the attribute "@name" as query
	// filter: check if the parent or parent's parent is an element tag and parent is not an attribute or ref
	// parent: means that the @name belongs to an object element (e.g., element['@name']: 'P')
	// parent's parent: means that @name belongs to an array of elments' objects (e.g., element[3]['@name']: 'place' )
	// Returns an array contain the path to find the element (e.g., define[47].element.oneOrMore[43].element['@name'])
	const elements = objectScan(['*.++.element.**.@name'], {
		filterFn: ({ property, key }) => {
			return key[key.length - 2] === 'element'	//belongs to an element Object
				|| key[key.length - 3] === 'element'	//bellongs to and array of element objects
				&& key[key.length - 2] !== 'attribute'  //does not belongs to an attribute
				&& key[key.length - 2] !== 'ref'; 		//does not belongs to a ref
		},
	})(grammar);

	console.log(elements.length)

	let a = 0;

	//loop trough the elements to add extra metadada
	elements.forEach((path) => {
		
		//* IMPORTANT
		// The path goes directly to the attribute '@name'
		// We must move one one level down to get the element object
		//(e.g., define[47].element.oneOrMore[43].element['@name'])
		path.pop();

		// Get the element using the path
		const element = lodashGet(schema.grammar,path)

		//get extra metadata

		//tree patg
		const treePathKey = [...path, 'treePath'];

		//key
		const keyKey = [...path, 'key'];
		const key = 'element';

		//documentation
		const documentationKey = [...path, 'documentation'];
		const documentation = getDocumentation(element)

		//fullname
		const fullname = (documentation) ? getFullNameFromDocumentation(documentation) : null;
		const fullNameKey = (fullname) ? [...path, 'fullName'] : null;
		

		//more
		//check grouping info on the last nested instance of this element
		const localElementIndex = path.lastIndexOf('element', -3); //get parent element to which this element belongs (if any)
		const localElementPath = path.slice(localElementIndex);
		
		// console.log(localElementPath.length)
		if (localElementPath.length > 1) {
			// console.log(localElementPath);
			a += 1;
			// console.log('**',path,localElementPath)

			const partOfGroupChildrenKey = [...path, 'partOfGroupChildren'];
			let partOfGroupChildren = null;
			if (localElementPath.includes('oneOrMore')) {
				partOfGroupChildren = 'oneOrMore';
			} else if (localElementPath.includes('zeroOrMore')) {
				partOfGroupChildren = 'zeroOrMore';
			} else if (localElementPath.includes('optional')) {
				partOfGroupChildren = 'optional';
			}
			
			const isChoiceKey = [...path, 'isChoice'];
			const isChoice = localElementPath.includes('choice') ? true : false;

			const isPartOfGroupKey = [...path, 'isPartOfGroup'];
			const isPartOfGroup = localElementPath.includes('group') ? true : false;

			if (partOfGroupChildren) lodashSet(schema.grammar,partOfGroupChildrenKey, partOfGroupChildren)
			if (isChoice) lodashSet(schema.grammar,isChoiceKey, isChoice)
			if (isPartOfGroup) lodashSet(schema.grammar,isChoiceKey, isPartOfGroup)
		}
		
		//save metadata into the schema
		lodashSet(schema.grammar,treePathKey, path)
		lodashSet(schema.grammar,keyKey, key)
		lodashSet(schema.grammar,documentationKey, documentation)

		if (fullname) lodashSet(schema.grammar,fullNameKey, fullname)
		
	});

	console.log(a)

	console.log(schema.grammar)

	return schema;
}

/**
 * Check if the element has [a:documentation] tag
 * Remove whitespaces
 * Return documentation
 * @param {Object} element The element
 * @returns {String}
 */
const getDocumentation = (element) => {
	if (!element['a:documentation']) return '';

	let doc = (element['a:documentation']?.['#text'])
		? element['a:documentation']?.['#text']
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
	const defs = schemaJSON_alt1.grammar.define;
	const definition = defs.find((def) => def['@name'] === name);

	if (!definition) {
		console.warn(`SchemaNavigator: No definition found for ${name}`);
		return null;
	}

	return definition;
};

/**
 * Returns an array of valid children for a particular path
 * @param {String} path The path
 * @param {Array} context Array of tags in the local context tag
 * @returns {Array}
 */
export const getChildrenForPath = (path, contextchildrenTags) => {
	console.log(path);

	console.time('getChildrenForPath_ObjectTree');
    const grammarElement = getEntryForPath({path});
	const childrenElements = getElementChildren(grammarElement);
	const contextualAvailbaleTags = filterByContextTags(childrenElements,contextchildrenTags);
	const children = buildAndSortMinimalTagObjects(contextualAvailbaleTags);
	console.log(children);
	console.timeEnd('getChildrenForPath_ObjectTree');

	return children;
};

/**
 * Returns an array of valid children for a particular path
 * @param {String} path The path
 * @param {Array} context Array of tags in the local context tag
 * @returns {Array}
 */
export const getParentsForPath = (path, contextchildrenTags) => {
	console.log(path);

	console.time('getParentForPath_ObjectTree');
    const element = getEntryForPath(path);
	// const childrenElements = getElementChildren(element);
	// // const contextualAvailbaleTags = filterByContextTags(childrenElements,contextchildrenTags);
	// // const contextualAvailbaleTags2 = filterByContextTags2(element,contextchildrenTags);
	// const contextualAvailbaleTags3 = filterByContextTags3(childrenElements,contextchildrenTags);
	// // const children = buildAndSortMinimalTagObjects(contextualAvailbaleTags3);
	// const children = buildAndSortMinimalTagObjects(contextualAvailbaleTags3);
	// console.log(children);
	// console.timeEnd('getParentForPath_ObjectTree');

	// if (context && context.length > 0) children = checkValidKeysRestriction(children, context);
	// _sortEntries(children);

	return children;
};

/**
 * Uses a XPATH to find the related entry in the Schema (JSON).
 * @param Objects Contains the following 
 * @param {String} path A forward slash delimited pseudo-xpath
 * @param {String} formatResult How the result will be formated. It can be either 'path' [Array] or 'object' [Object]
 * @returns {Object}
 */
const getEntryForPath = ({ path, formatResult = 'path' }) => {
	//Shortcut to grammar (root)
	const grammar = schemaJSON_alt1.grammar;

	//* Clean and split XPATH
	const cleanPath = path.replace(/\[\d+\]/g, ''); // remove any indexing
	const pathTags = cleanPath.split('/');

	//start from the root of schema
	let contextGrammar = grammar;

	//* Loop through the PATH levels to find the correnspondent element.
	// Use the level's element as context to the next level
	pathTags.forEach((tag) => {
		if (tag === '') return;

		//traverse the tree to find the elements or references that matches the path level
		let matchTags = objectScan(['*.**.(element|ref).**'], {
			rtn: 'entry',
			filterFn: ({ getValue }) => getValue()?.['@name'] === tag,
		})(contextGrammar);

		console.log(matchTags)

		//* If there is more than one
		// Get the one that is an eleement (which means locally defined)
		let element = matchTags.find((tag) => {
			const [key, value] = tag;
			const parent =
				typeof key[key.length - 1] === 'number' ? key[key.length - 2] : key[key.length - 1];
			return parent === 'element';
		});

		//if no "element" is found, use the first match;
		if (!element) element = matchTags[0];

		//desconstruct and get parent.
		const [key, value] = element;
		const parent =
			typeof key[key.length - 1] === 'number' ? key[key.length - 2] : key[key.length - 1];

		//if reference (ref), get element from global 	definition and pass it as nex context
		if (parent === 'ref') {
			const definition = grammar.define.find((item) => item['@name'] === value['@name']);
			contextGrammar = {key, value, definition};
		} else {
			console.log(contextGrammar)
			//* wrap the result in an object for better parsing
			contextGrammar = {key, value};
			console.log(contextGrammar);
			console.log('------')
		}
	});

	

	console.log(contextGrammar);
	console.log(grammar.define.findIndex((item) => item['@name'] === contextGrammar['@name']));

	return contextGrammar;
};

/**
 * Returns all the element children of an element schema entry
 * @param {Object} element The schema entry
 * @returns {Array}
 */
const getElementChildren = (grammarElement) => {

	console.log(grammarElement)

	// Traverse the tree to find first level elements or references.
	// breakFn: avoids getting deeper into the tree
	// (because it might be getting metadata from locally defined tag)
	const tags = objectScan(['*.++.(element|ref).**'], {
		rtn: 'entry',
		filterFn: ({ property }) => (
			property === '@name'
		),
		breakFn: ({ getKey, property }) => (
			getKey().includes('element') && property !== 'element'
		),
	})(grammarElement.element);

	//transform and extract metadata
	const list = tags.map((tag) => {
		const [key, name] = tag;

		//* IMPORTANT
		// The path goes directly to the attribute '@name'
		// We must move one  level down to get the tag object
		//(e.g., oneOrMore[1].choice.ref.[43]['@name'])
		key.pop();

		let partOfGroupChildren = null;
		if (key.includes('oneOrMore')) {
			partOfGroupChildren = 'oneOrMore';
		} else if (key.includes('zeroOrMore')) {
			partOfGroupChildren = 'zeroOrMore';
		} else if (key.includes('optional')) {
			partOfGroupChildren = 'optional';
		}

		const isChoice = key.includes('choice') ? true : false;
		const isPartOfGroup = key.includes('group') ? true : false;
		const type = key.includes('element') ? 'element' : 'ref';

		const element = (type === 'element') ? lodashGet(grammarElement,key) : null; 

		const child = {
			name,
			path: key,
			type,
			isPartOfGroup,
			partOfGroupChildren,
			isChoice
		}

		// if (type === 'element') child.element = lodashGet(grammarElement.element,key);

		return child
	})

	const result = {
		constextElement: grammarElement,
		children: list
	};

	console.log(result);
	return result;
};

/**
 * Filter
 */
const filterByContextTags = (elements,contextchildrenTagsName) => {

	//find elements unique to each groupType

	// console.log(elements);

	let uniqueForOneOrMore = [];
	let uniqueForZeroOrMore = [];
	let uniqueForOptional = [];

	// console.log(elements);

	elements.forEach((element) => {
		const [key, name] = element;
		if (uniqueForOneOrMore.find((unique) => unique.name === name && unique.key.includes('oneOrMore'))) {
			uniqueForOneOrMore = uniqueForOneOrMore.filter((unique) => unique.name !== name);
			return;
		}
		uniqueForOneOrMore.push({name,key})
	});

	// console.log({uniqueForOneOrMore});


	//set group restrictions
	let oneOrMoreRestrictionGroups = new Set();
	let zenoOrMoreRestrictionGroups = new Set();
	let optionalRestrictionGroups = new Set();

	uniqueForOneOrMore.forEach(({name, key}) => {
		if (contextchildrenTagsName.includes(name)) {
			let oneOrMorePostion = null;
			const group = key.find((level, i) => {
				if (oneOrMorePostion !== null) return true;
				if (level === 'oneOrMore') oneOrMorePostion = i;
			})
			oneOrMoreRestrictionGroups.add(group);
		}
	});

	//filter elements
	const list = elements.filter((element) => {
		const [key, name] = element;
		let oneOrMorePostion = null;
		const group = key.find((level, i) => {
			if (oneOrMorePostion !== null) return true;
			if (level === 'oneOrMore') oneOrMorePostion = i;
		})
		if (oneOrMoreRestrictionGroups.has(group)) return true;
	})

	// console.log(list);

	return list;
}


/**
 * Get details, reduce, and sort available tags for the document context
 * @param {Array} tags avalable tags for the document context
 * @returns {Array} list: only name and fullName (if available)
 */
const buildAndSortMinimalTagObjects = (tags) => {

	//get element details
	const list = tags.map((tag) => {
		const [key, name] = tag;
		const element = lodashGet(schemaJSON_alt1.grammar,key)
		console.log(name,key,element)
		return { name, fullName: ''};
	});

	list.sort((a, b) => {
		const nameA = a.name.toUpperCase(); // ignore upper and lowercase
		const nameB = b.name.toUpperCase(); // ignore upper and lowercase
		if (nameA < nameB) return -1;
		if (nameA > nameB) return 1;
		return 0; // names must be equal
	});

	return list;
}

export default {
	setSchemaJSON,
	setSchemaElements,
	getChildrenForPath,
};
