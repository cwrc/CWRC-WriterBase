import { ONE_OR_MORE, OPTIONAL, ZERO_OR_MORE, CHOICE } from './schemaNavigator2';

/**
 * Filters tags for an element using tags already present in the document in the context of the cursor.
 * @param {Array} tags Tags to be filtered
 * @param {Array} presentTags Tags present in the document
 * @returns {Array} Filtered tags
 */
export const filterByTags = (tags, presentTags) => {
	// Build filters
	const filters = buildFilter(tags, presentTags);

	//if no filter, return all
	if (filters.length === 0) return tags;

	//Apply one filter at a time
	let filteredTags = [...tags];
	filters.forEach((filter) => {
		if (filteredTags.length === 0) return;
		filteredTags = filteredTags.filter((tag) => {
			const pat = tag.pattern.find(([, name]) => name === filter.name);

			// not affected by the filter
			if (!pat) return tag;

			const [tagPatIndex] = pat;

			if (filter.instancesToInclude && filter.instancesToInclude.has(tagPatIndex)) {
				return tag;
			}

			if (filter.instancesToExclude && !filter.instancesToExclude.has(tagPatIndex)) {
				return tag;
			}

			if (filter.elementsToInclude && filter.elementsToInclude.has(tagPatIndex)) {
				return tag;
			}

			if (filter.elementsToExclude && !filter.elementsToExclude.has(tagPatIndex)) {
				return tag;
			}
		});
	});

	// console.log(filteredTags);
	return filteredTags;
};

// const is

/**
 * Builds Filters
 *
 * @param { Object } tags The tags to be filtered
 * @param { Array } presentTags The tags already present in the document
 */
const buildFilter = (tags, presentTags) => {
	const filters = [];
	// console.log(presentTags);

	const presentTagsName = new Set(presentTags.map(({ tagName }) => tagName));

	// Only use the tags present in the document to create filters.
	const documentTags = tags.filter(
		(child) => presentTagsName.has(child.attributes.name) && child?.pattern !== null
	);
	if (documentTags.length === 0) return [];

	// Get patterns to process based on the elements to be filtered
	const patternsToProcess = new Set();
	tags.map((tag) => {
		// if (tag?.pattern) {
		// 	tag.pattern.forEach(([, name]) => patternsToProcess.add(name));
		// }

		//get first level pattern
		if (tag?.pattern) {
			const [, name] = tag.pattern[0];
			patternsToProcess.add(name);
		}
	});

	// console.log(patternsToProcess);

	// Create a filter to each pattern
	// console.log(documentTags);
	patternsToProcess.forEach((patternName) => {
		const filter = createFilterPattern(
			patternName,
			documentTags.filter((tag) => {
				const patternsFlat = tag?.pattern?.flat();
				if (patternsFlat) return patternsFlat.includes(patternName);
			})
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
const filterOneOrMore = (patternName, tags) => {
	const filter = { name: patternName };

	// A. PATTERN INSTANCE
	const patternInstancesToInclude = new Set();
	// B. PATTERNS CHOICE
	const elementsToExclude = new Set();

	tags.forEach((tag) => {
		//skip if tag if double occurrence
		const occurrence = tags.filter((t) => t.attributes.name == tag.attributes.name);
		if (occurrence.length > 1) return;

		//INSTANCE - consider the instance of the first level Pattern
		const pat_1 = tag.pattern[0];
		const [pat_1_index, pat_1_name] = pat_1;
		if (pat_1_name === patternName) patternInstancesToInclude.add(pat_1_index);

		//CHOICE - consider if CHOICE is used as a second level pattern
		const pat_2 = tag.pattern[1];
		if (!pat_2) return;
		const [, pat_2_name] = pat_2;
		if (pat_2_name !== CHOICE) elementsToExclude.add(tag);
	});

	if (patternInstancesToInclude.size > 0) {
		filter.instancesToInclude = patternInstancesToInclude;
	}

	// // B. PATTERNS CHOICE
	// const elementsToExclude = new Set();
	// tags.forEach((tag) => {
	// 	//consider the pattern second level -if exists
	// 	const pat_2 = tag.pattern[1];
	// 	if (!pat_2) return;
	// 	const [, patName] = pat_2;
	// 	if (patName !== CHOICE) elementsToExclude.add(tag);
	// });

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
const filterZeroOrMore = (patternName, tags) => {
	const filter = { name: patternName };

	// A. PATTERN INSTANCE
	const patternInstancesToInclude = new Set();
	// B. PATTERNS CHOICE
	const elementsToExclude = new Set();

	tags.forEach((tag) => {
		//skip if tag if double occurrence
		const occurrence = tags.filter((t) => t.attributes.name == tag.attributes.name);
		if (occurrence.length > 1) return;

		//INSTANCE - consider the instance of the first level Pattern
		const pat_1 = tag.pattern[0];
		const [pat_1_index, pat_1_name] = pat_1;
		if (pat_1_name === patternName) patternInstancesToInclude.add(pat_1_index);

		//CHOICE - consider if CHOICE is used as a second level pattern
		const pat_2 = tag.pattern[1];
		if (!pat_2) return;
		const [, pat_2_name] = pat_2;
		if (pat_2_name !== CHOICE) elementsToExclude.add(tag);
	});

	if (patternInstancesToInclude.size > 0) {
		filter.instancesToInclude = patternInstancesToInclude;
	}

	// // B. PATTERNS CHOICE
	// const elementsToExclude = new Set();
	// tags.forEach((tag) => {
	// 	//consider the pattern second level -if exists
	// 	const pat_2 = tag.pattern[1];
	// 	if (!pat_2) return;
	// 	const [, patName] = pat_2;
	// 	if (patName !== CHOICE) elementsToExclude.add(tag);
	// });

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
const filterOptional = (patternName, tags) => {
	const filter = { name: patternName };

	const instancesToExclude = new Set();
	const elementsToExclude = new Set();

	tags.forEach((tag) => {
		//CHOICE - consider if CHOICE is used as a second level pattern
		const pat_2 = tag.pattern[1];
		if (!pat_2) elementsToExclude.add(tag);

		const [pat_2_index, pat_2_name] = pat_2;
		if (pat_2_name !== CHOICE) elementsToExclude.add(tag);
		if (pat_2_name === CHOICE) instancesToExclude.add(pat_2_index);
	});

	if (instancesToExclude.size > 0) filter.instancesToExclude = instancesToExclude;
	if (elementsToExclude.size > 0) filter.elementsToExclude = elementsToExclude;

	// return null if nothing to filter
	if (!filter.instancesToExclude && !filter?.elementsToExclude) return null;

	return filter;
};

export const limitByPosition = ({ tags, direction, element, context }) => {
	const PATTERN_CODES = new Set([ZERO_OR_MORE, ONE_OR_MORE]);

	const currentTag = context.siblingTags.find(
		(siblings) => siblings.attributes.name === element.getAttribute('_tag')
	);

	//if can't tind current tag
	if (!currentTag) return tags;

	const [currentTag_pat1_index, currentTag_pat1_name] = currentTag.pattern[0];

	const nextSibling = context.siblingTags.find(
		(siblings) => siblings.attributes.name === element.nextElementSibling?.getAttribute('_tag')
	);
	const [nextSibling_pat1_index] = nextSibling ? nextSibling.pattern[0] : [null];

	const previousSibling = context.siblingTags.find(
		(siblings) => (
			siblings.attributes.name === element.previousElementSibling?.getAttribute('_tag')
	));
	const [prevSibling_pat1_index] = previousSibling ? previousSibling.pattern[0] : [null];

	tags = tags.filter((tag) => {
		if (!tag.pattern) return tag;
		const [tag_pat1_index] = tag.pattern[0];

		//current
		if (tag_pat1_index === currentTag_pat1_index && PATTERN_CODES.has(currentTag_pat1_name)) {
			return tag;
		}

		// before
		if (
			(direction === 'before' || direction === 'both') &&
			tag_pat1_index < currentTag_pat1_index
		) {
			if (!previousSibling) return tag;
			if (tag_pat1_index === prevSibling_pat1_index) return tag;
		}

		// after
		if (
			(direction === 'after' || direction === 'both') &&
			tag_pat1_index > currentTag_pat1_index
		) {
			if (!nextSibling) return tag;
			if (tag_pat1_index === nextSibling_pat1_index) return tag;
		}
	});
	return tags;
};

export default {
	filterByTags,
	limitByPosition,
};
