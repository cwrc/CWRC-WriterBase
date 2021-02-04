import dedent from 'dedent';
import $ from 'jquery';
import 'jquery-ui/ui/widgets/button';

/**
 * @class Validation
 * @param {Object} config
 * @param {Writer} config.writer
 * @param {String} config.parentId
 * @param {String} config.validationUrl
 */
function Validation(config) {
	const w = config.writer;

	const validationUrl = config.validationUrl;
	if (validationUrl === undefined) console.error('Validation: no validationUrl specified!');

	const id = w.getUniqueId('validation_');

	$(`#${config.parentId}`).append(`
        <div class="moduleParent">
            <div id="${id}" class="moduleContent">
                <ul class="validationList"></ul>
            </div>
            <div id="${id}_buttons" class="moduleFooter">
                <button type="button" role="validate">Validate</button>
                <button type="button" role="clear">Clear</button>
            </div>
        </div>
    `);

	w.event('documentLoaded').subscribe(() => validation.clearResult());

	w.event('validationRequested').subscribe(() => {
		const list = $(`#${id} > ul`);
		list.empty();
		list.append(`
            <li class="ui-state-default">
                <span class="loading"></span> Validating...
            </li>`);
		w.layoutManager.showModule('validation');

		validation.validate();
	});

	w.event('documentValidated').subscribe((valid, resultDoc, docString) => {
		$(`#${id}_indicator`).hide();
		validation.showValidationResult(resultDoc, docString);
	});

	/**
	 * @lends Validation.prototype
	 */
	var validation = {};

	validation.validate = async () => {
		const docText = await w.converter.getDocumentContent(false);
		const schemaUrl = w.schemaManager.getXMLUrl();

		const body = new URLSearchParams();
		body.append('sch', schemaUrl);
		body.append('type', 'RNG_XML');
		body.append('content', docText);

		const response = await fetch(validationUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
			},
			body: body,
		}).catch(() => {
			w.dialogManager.show('message', {
				title: 'Error',
				msg: 'An error occurred while trying to validate the document.',
				type: 'error',
			});
			w.event('documentValidated').publish(null, '', '');
		});

		const results = await response.text();

		const valid = $('status', results).text() === 'pass';
		w.event('documentValidated').publish(valid, results, docText);
	};

	/**
	 * Processes a validation response from the server.
	 * @param resultDoc The actual response
	 * @param docString The doc string sent to the server for validation
	 */
	validation.showValidationResult = function(resultDoc, docString) {
		const list = $(`#${id} > ul`);
		list.empty();

		docString = docString.split('\n')[1]; // remove the xml header

		const status = $('status', resultDoc).text();

		if (status === 'pass') {
			list.append(
				`<li class="ui-state-default">
                    <span class="ui-icon ui-icon-check" style="float: left; margin-right: 4px;"></span>Your document is valid!
                </li>`
			);
		}

		w.tagger.removeNoteWrappersForEntities();

		$('warning', resultDoc).each(function(index, el) {
			let id = null;

			const type = el.nodeName;
			const message = $(this)
				.find('message')
				.text();
			const path = $(this)
				.find('path')
				.text();
			const elementId = $(this)
				.find('elementId')
				.text();
			const column = parseInt(
				$(this)
					.find('column')
					.text()
			);

			if (elementId !== '') id = elementId;

			let tags, tagName;

			if (id === null && path !== '') {
				// convert xpath to jquery selector
				let editorPath = '';
				tags = path.split('/');

				// for (var i = 0; i < tags.length; i++) {
				for (const tag of tags) {
					// var tag = tags[i];
					tagName = tag.match(/^\w+(?=\[)?/);

					if (tagName != null) {
						let index = tag.match(/\[(\d+)\]/);
						if (index === null) {
							index = 0;
						} else {
							index = parseInt(index[1]);
							index--; // xpath is 1-based and "eq()" is 0-based
						}
						editorPath += '*[_tag="' + tagName[0] + '"]:eq(' + index + ') > ';
					}
				}

				editorPath = editorPath.substr(0, editorPath.length - 3);
				const docEl = $(editorPath, w.editor.getBody());
				id = docEl.attr('id');
			}

			if (id == null && !isNaN(column)) {
				const docSubstring = docString.substring(0, column);
				tags = docSubstring.match(/<.*?>/g);

				if (tags !== null) {
					let tag = tags[tags.length - 1];
					id = tag.match(/id="(.*?)"/i);

					if (id === null) {
						let i;
						if (message.search('text not allowed here') !== -1) {
							// find the parent tag
							let level = 0;
							for (i = tags.length - 1; i > -1; i--) {
								tag = tags[i];
								if (tag.search('/') !== -1) {
									level++; // closing tag, add a level
								} else {
									level--; // opening tag, remove a level
								}
								if (level == -1) {
									const match = tag.match(/id="(.*?)"/i);
									if (match !== null && match[1]) id = match[1];
									break;
								}
							}
						} else {
							const tagMatch = tag.match(/<\/(.*)>/);
							if (tagMatch != null) {
								// it's and end tag, so find the matching start tag
								tagName = tagMatch[1];

								for (i = tags.length - 1; i > -1; i--) {
									tag = tags[i];
									const startTagName = tag.match(/<(.*?)\s/);
									if (startTagName !== null && startTagName[1] == tagName) {
										id = tag.match(/id="(.*?)"/i)[1];
										break;
									}
								}
							} else {
								// probably entity tag
							}
						}
					} else {
						id = id[1];
					}
				} else {
					// can't find any tags!
				}
			}

			if (id !== null) {
				let messageParts;
				const messageDivLoc = message.indexOf(';');
				if (messageDivLoc !== -1) {
					messageParts = [
						message.slice(0, messageDivLoc + 1),
						message.slice(messageDivLoc + 2),
					];
				} else {
					messageParts = [message];
				}

				let messageHtml = dedent(`
                    <li class="${type === 'warning' ? 'ui-state-error' : 'ui-state-highlight'}"
                        style="margin: 5px; padding: 10px; border-radius: 5px;"
                    >
                        <span
                            class="ui-icon ${type === 'warning' ? 'ui-icon-alert' : 'ui-icon-info'}"
                            style="float: left; margin-right: 4px; margin-top: 1px;"></span>
                 `);

				messageHtml += `<div>${messageParts[0]}</div>`;

				if (messageParts[1] !== undefined) {
					messageHtml += dedent(` 
                        <span class="message_more">more...</span>
                        <span style="display: none;">${messageParts[1]}</span>`);
				}

				messageHtml += `<div>Path: ${path}</div>`;

				messageHtml += '</li>';

				const item = list.append(messageHtml).find('li:last');
				item.find('[class="message_more"]').on('click', function() {
					$(this)
						.next('span')
						.show();
					$(this).hide();
				});

				item.data('id', id);
			} else {
				console.warn(`validation: couldn't find element for ${path}`);
			}
		});

		w.tagger.addNoteWrappersForEntities();

		list.find('li').on('click', function() {
			list.find('li').removeClass('selected');
			$(this).addClass('selected');

			const id = $(this).data('id');
			w.utilities.selectElementById(id);
		});

		w.layoutManager.showModule('validation');
	};

	validation.clearResult = () => {
		$(`#${id}_indicator`).hide();
		$(`#${id} > ul`).empty();
	};

	const $validateButton = $(`#${id}_buttons button[role=validate]`).button();
	$validateButton.click(() => validation.validate());

	const $clearButton = $(`#${id}_buttons button[role=clear]`).button();
	$clearButton.click(() => validation.clearResult());

	validation.destroy = () => {
		$validateButton.button('destroy');
		$clearButton.button('destroy');
	};

	// add to writer
	w.validation = validation;

	return validation;
}

export default Validation;
