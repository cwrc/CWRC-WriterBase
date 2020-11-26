// ! Write better documentation
/**
 * APPLY FILTERS
 * Use filters to limit tag availability
 * If no filters, return
 * @param { Object } element Element to be filtered
 * @param { Array } filters Collection of filters
 * @returns { Array } filteredTags
 */
export const filter = (elements, contextchildrenTagsName) => {

	const filters = buildFilter(elements, contextchildrenTagsName)

	//if no filter, return all
	if (filters.length === 0) return elements;

	//Apply one filter at a time
	let filteredTags = [...elements];
	filters.forEach((filter) => {
		filteredTags = filteredTags.filter((tag) => {
			if (filter.name !== tag.pattern.name) return tag; // not affected by the filter

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
 * BUILD FILTER
 *
 * @param { Object } element The element to be filtered
 * @param { Array } contextchildrenTagsName The tags already present in the document
 */
const buildFilter = (elements, contextchildrenTagsName) => {
	const filters = [];

	// Get document tags details
	const documentTags = elements.filter((child) =>
		contextchildrenTagsName.has(child.attributes.name)
	);

	// Get patterns to process based on the element to be filtered
	const patternsToProcess = new Set(
		elements.map((tag) => {
			if (tag?.pattern) return tag.pattern.name;
		})
	);

	// Add filter to each available pattern
	patternsToProcess.forEach((pattern) => {
		const filter = addFilterPattern(
			pattern,
			documentTags.filter((tag) => tag.pattern.name === pattern)
		);
		if (filter) filters.push(filter);
	});

	return filters;
};

/**
 * ADD FILTER SELECTOR
 * @param { String } pattern The pattern name
 * @param { Array } tags The collection of tags that belongs to a pattern
 */
const addFilterPattern = (pattern, tags) => {
	if (pattern === 'oneOrMore') return filterOneOrMore(pattern, tags);
	if (pattern === 'zeroOrMore') return filterZeroOrMore(pattern, tags);
	if (pattern === 'optional') return filterOptional(pattern, tags);
};

/**
 * FILTER PATERN ONE OR MORE
 * A. INSTANCES: Only tags unique to an instance of this pattern can be use to filter.
 * if a tag used on the document belongs to an instance of this patter, exclude all the other instances
 * B. CHOICE: if an instance of this pattern is NOT a choice, exclude the elemetns already used on the document.
 *
 * @param { String } pattern The pattern name
 * @param { Array } tags The collection of tags that belongs to a pattern
 * @returns { Object } filter
 */
const filterOneOrMore = (pattern, tags) => {
	const filter = { name: pattern };

	// A. PATTERN INSTANCE
	const patternInstancesToInclude = new Set();
	const uniquetags = tags.filter((tag) => {
		const occurrence = tags.filter((t) => t.attributes.name == tag.attributes.name);
		if (occurrence.length > 1) return;
		patternInstancesToInclude.add(tag.pattern.index);
		return tag;
	});

	// store if more than one
	if (patternInstancesToInclude.size > 0) {
        filter.instancesToInclude = patternInstancesToInclude;
    }

	// B. PATTERNS CHOICE
	const elementsToExclude = new Set();
	tags.forEach((tag) => {
		if (tag.pattern.isChoice === false) elementsToExclude.add(tag);
	});

	// store if more than one
	if (elementsToExclude.size > 0) filter.elementsToExclude = elementsToExclude;

	// return null if nothing to filter
	if (!filter.instancesToInclude && !filter.elementsToExclude) return null;

	return filter;
};

/**
 * FILTER PATERN ZERO OR MORE
 * A. INSTANCES: Only tags unique to an instance of this pattern can be use to filter.
 * if a tag used on the document belongs to an instance of this patter, exclude all the other instances
 * B. CHOICE: if an instance of this pattern is NOT a choice, exclude the elemetns already used on the document.
 *
 * @param { String } pattern The pattern name
 * @param { Array } tags The collection of tags that belongs to a pattern
 * @returns { Object } filter
 */
const filterZeroOrMore = (pattern, tags) => {
	const filter = { name: pattern };

	// A. PATTERN INSTANCE
	const patternInstancesToInclude = new Set();
	const uniquetags = tags.filter((tag) => {
		const occurrence = tags.filter((t) => t.attributes.name == tag.attributesname);
		if (occurrence.length > 1) return;
		patternInstancesToInclude.add(tag.pattern.index);
		return tag;
	});

	// store if more than one
	if (patternInstancesToInclude.size > 0) filter.instancesToInclude = patternInstancesToInclude;

	// B. PATTERNS CHOICE
	const elementsToExclude = new Set();
	tags.forEach((tag) => {
		if (tag.pattern.isChoice === false) elementsToExclude.add(tag);
	});

	// store if more than one
	if (elementsToExclude.size > 0) filter.elementsToExclude = elementsToExclude;

	// return null if nothing to filter
	if (!filter.instancesToInclude && !filter.elementsToExclude) return null;

	return filter;
};

/**
 * FILTER PATERN OPTIONAL
 * Assess CHOICE on each pattern instance.
 * If CHOICE IS PRESENT, exclude the pattern already used
 * If CHOICE IS NOT PRESENT. exlude the element already used
 *
 * @param { String } pattern The pattern name
 * @param { Array } tags The collection of tags that belongs to a pattern
 * @returns { Object } filter
 */
const filterOptional = (pattern, tags) => {
	const filter = { name: pattern };

	const instancesToExclude = new Set();
	const elementsToExclude = new Set();

	tags.forEach((tag) => {
		if (tag.pattern.isChoice) instancesToExclude.add(tag.pattern.index);
		if (!tag.pattern.isChoice) elementsToExclude.add(tag);
	});

	// store if more than one
	if (instancesToExclude.size > 0) filter.instancesToExclude = instancesToExclude;
	if (elementsToExclude.size > 0) filter.elementsToExclude = elementsToExclude;

	// return null if nothing to filter
	if (!filter.instancesToExclude && !filter?.elementsToExclude) return null;

	return filter;
};

export default {
	filter,
};
