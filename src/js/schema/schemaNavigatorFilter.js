import { ONE_OR_MORE, OPTIONAL, ZERO_OR_MORE } from './schemaNavigator4';

/**
 * Filters tags for an element using tags already present in the document in the context of the cursor.
 * @param {Array} tags Tags to be filtered
 * @param {Array} presentTags Tags present in the document
 * @returns {Array} Filtered tags
 */
export const filter = (tags, presentTags) => {
	// Build filters
	const filters = buildFilter(tags, presentTags);

	//if no filter, return all
	if (filters.length === 0) return tags;

	//Apply one filter at a time
	let filteredTags = [...tags];
	filters.forEach((filter) => {
		filteredTags = filteredTags.filter((tag) => {
			// not affected by the filter
			if (filter.name !== tag.pattern.name) return tag;

			if (filter.instancesToInclude && filter.instancesToInclude.has(tag.pattern.index)) {
				return tag;
			}

			if (filter.instancesToExclude && !filter.instancesToExclude.has(tag.pattern.index)) {
				return tag;
			}

			if (filter.elementsToInclude && filter.elementsToInclude.has(tag.pattern.index)) {
				return tag;
			}

			if (filter.elementsToExclude && !filter.elementsToExclude.has(tag.pattern.index)) {
				return tag;
			}
		});
	});

	return filteredTags;
};

/**
 * Builds Filters
 *
 * @param { Object } tags The tags to be filtered
 * @param { Array } presentTags The tags already present in the document
 */
const buildFilter = (tags, presentTags) => {
	const filters = [];
	// console.log(presentTags);

	const presentTagsName = new Set(presentTags.map((tag) => {
		return tag.tagName;
	}));

	// Only use the tags present in the document to create filters.
	const documentTags = tags.filter((child) => presentTagsName.has(child.attributes.name));

	// Get patterns to process based on the elements to be filtered
	const patternsToProcess = new Set(
		tags.map((tag) => {
			if (tag?.pattern) return tag.pattern.name;
		})
	);

	// Create a filter to each pattern
	patternsToProcess.forEach((patternName) => {
		const filter = createFilterPattern(
			patternName,
			documentTags.filter((tag) => tag.pattern.name === patternName)
		);
		if (filter) filters.push(filter);
	});

	return filters;
};

/**
 * Creates a Filter selector
 * @param { String } pattern The pattern name
 * @param { Array } tags The collection of tags that belongs to a pattern
 */
const createFilterPattern = (patternName, tags) => {
	if (patternName === ONE_OR_MORE) return filterOneOrMore(patternName, tags);
	if (patternName === OPTIONAL) return filterOptional(patternName, tags);
	if (patternName === ZERO_OR_MORE) return filterZeroOrMore(patternName, tags);
};

/**
 * Creates Filter Pattern: ONE OR MORE
 * - A. INSTANCES: Only tags unique to an instance of this pattern can be use to filter.
 *  - if a tag used on the document belongs to an instance of this pattern, exclude all the other instances
 * - B. CHOICE: if an instance of this pattern is NOT a choice, exclude the elemetns already used on the document.
 *
 * @param { String } pattern The pattern name
 * @param { Array } tags The collection of tags that belongs to a pattern
 * @returns { Object } The Filter
 */
const filterOneOrMore = (pattern, tags) => {
	const filter = { name: pattern };

	// A. PATTERN INSTANCE
	const patternInstancesToInclude = new Set();
	tags.filter((tag) => {
		const occurrence = tags.filter((t) => t.attributes.name == tag.attributes.name);
		if (occurrence.length > 1) return;
		patternInstancesToInclude.add(tag.pattern.index);
		return tag;
	});

	if (patternInstancesToInclude.size > 0) {
		filter.instancesToInclude = patternInstancesToInclude;
	}

	// B. PATTERNS CHOICE
	const elementsToExclude = new Set();
	tags.forEach((tag) => {
		if (tag.pattern.isChoice === false) elementsToExclude.add(tag);
	});

	if (elementsToExclude.size > 0) filter.elementsToExclude = elementsToExclude;

	// return null if nothing to filter
	if (!filter.instancesToInclude && !filter.elementsToExclude) return null;

	return filter;
};

/**
 * Creates Filter Pattern: ZERO OR MORE
 *  - A. INSTANCES: Only tags unique to an instance of this pattern can be use to filter.
 *    - if a tag used on the document belongs to an instance of this pattern, exclude all the other instances
 *  - B. CHOICE: if an instance of this pattern is NOT a choice, exclude the elemetns already used on the document.
 *
 * @param { String } pattern The pattern name
 * @param { Array } tags The collection of tags that belongs to a pattern
 * @returns { Object } The filter
 */
const filterZeroOrMore = (pattern, tags) => {
	const filter = { name: pattern };

	// A. PATTERN INSTANCE
	const patternInstancesToInclude = new Set();
	tags.filter((tag) => {
		const occurrence = tags.filter((t) => t.attributes.name == tag.attributesname);
		if (occurrence.length > 1) return;
		patternInstancesToInclude.add(tag.pattern.index);
		return tag;
	});

	if (patternInstancesToInclude.size > 0) filter.instancesToInclude = patternInstancesToInclude;

	// B. PATTERNS CHOICE
	const elementsToExclude = new Set();
	tags.forEach((tag) => {
		if (tag.pattern.isChoice === false) elementsToExclude.add(tag);
	});

	if (elementsToExclude.size > 0) filter.elementsToExclude = elementsToExclude;

	// return null if nothing to filter
	if (!filter.instancesToInclude && !filter.elementsToExclude) return null;

	return filter;
};

/**
 * Creates Filter Pattern: OPTIONAL
 * Assess CHOICE on each pattern instance.
 *  - If CHOICE IS PRESENT, exclude the pattern already used
 *  - If CHOICE IS NOT PRESENT. exlude the element already used
 *
 * @param { String } pattern The pattern name
 * @param { Array } tags The collection of tags that belongs to a pattern
 * @returns { Object } The Filter
 */
const filterOptional = (pattern, tags) => {
	const filter = { name: pattern };

	const instancesToExclude = new Set();
	const elementsToExclude = new Set();

	tags.forEach((tag) => {
		if (tag.pattern.isChoice) instancesToExclude.add(tag.pattern.index);
		if (!tag.pattern.isChoice) elementsToExclude.add(tag);
	});

	if (instancesToExclude.size > 0) filter.instancesToExclude = instancesToExclude;
	if (elementsToExclude.size > 0) filter.elementsToExclude = elementsToExclude;

	// return null if nothing to filter
	if (!filter.instancesToExclude && !filter?.elementsToExclude) return null;

	return filter;
};

export default {
	filter,
};
