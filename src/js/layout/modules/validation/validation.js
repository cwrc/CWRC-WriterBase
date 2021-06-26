import dedent from 'dedent';
import $ from 'jquery';
import 'jquery-ui/ui/widgets/button';

/**
 * @class Validation
 * @param {Object} config
 * @param {Writer} config.writer
 * @param {String} config.parentId
 */
function Validation({ writer, parentId }) {
  const w = writer;

  const id = w.getUniqueId('validation_');

  $(`#${parentId}`).append(
    dedent(`
			<div class="moduleParent">
				<div id="${id}" class="moduleContent">
					<ul class="validationList"></ul>
				</div>
				<div id="${id}_buttons" class="moduleFooter">
					<button type="button" role="validate">Validate</button>
					<button type="button" role="clear">Clear</button>
				</div>
			</div>
    `)
  );

  w.event('contentChanged').subscribe(() => {
    validation.clearResult();
    validation.validate();
  });

  w.event('documentLoaded').subscribe(() => {
    validation.clearResult();
    validation.validate();
  });

  w.event('validationRequested').subscribe(() => {
    const list = $(`#${id} > ul`);

    list.empty();
    list.append(
      dedent(`
				<li class="ui-state-default">
					<span class="loading"></span>
          Validating...
          <span id="validating-percentage"></span>
				</li>
			`)
    );

    w.layoutManager.showModule('validation');
    validation.validate();
  });

  w.event('documentValidated').subscribe((valid, result) => {
    $(`#${id}_indicator`).hide();
    validation.showValidationResult(result);
  });

  w.event('documentValidating').subscribe((partDone) => {
    const pct = `${Math.floor(partDone * 100)}%`;
    $(`#${id}`).find('#validating-percentage').text(pct);
  });

  /**
   * @lends Validation.prototype
   */
  const validation = {};

  validation.validate = async () => {
    await w.overmindActions.validator.workerValidate();
  };

  /**
   * Processes a validation response from the server.
   * @param result {object} The actual response
   * @param result.valid {boolean} Whether the document is valid or not
   * @param result.errors {array} List of errors
   */
  validation.showValidationResult = ({ valid, errors }) => {
    const list = $(`#${id} > ul`);
    list.empty();

    if (valid) {
      list.append(createSucessMessageComponent());
      // w.layoutManager.hideModule('validation');
      return;
    }

    w.layoutManager.showModule('validation');

    w.tagger.removeNoteWrappersForEntities();

    // console.log(errors);
    errors.forEach((error) => {
      // convert xpath to jquery selector
      const path = getElementPathOnEditor(error.target.xpath ?? error.element.xpath);
      const docEl = $(path, w.editor.getBody());
      const id = docEl.attr('id') ?? null;

      //build compontent
      const errorComponent = createErrorMessageComponent(error);

      //append elemente
      const item = list.append(errorComponent.html).find('li:last');
      item.data('id', id);
      item.data('data', errorComponent.data);
      item.find('[class="moreButton"]').on('click', function () {
        const icon = $(this).find('span');
        const opened = $(icon).hasClass('ui-icon-caret-1-n');
        if (opened) {
          $(icon).addClass('ui-icon-caret-1-s');
          $(icon).removeClass('ui-icon-caret-1-n');
          $(this).parent().find('#details').empty();
        } else {
          $(icon).addClass('ui-icon-caret-1-n');
          $(icon).removeClass('ui-icon-caret-1-s');
          createDocumentationComponent($(this).parent());
        }
      });
    });

    w.tagger.addNoteWrappersForEntities();

    list.find('li').on('click', function () {
      list.find('li').removeClass('selected');
      $(this).addClass('selected');

      const id = $(this).data('id');
      w.utilities.selectElementById(id);
    });
  };

  const createSucessMessageComponent = () => {
    return dedent(`
			<li class="ui-state-default">
				<span class="ui-icon ui-icon-check"></span>
				Your document is valid!
			</li>
		`);
  };

  const getElementPathOnEditor = (xpath) => {
    let editorPath = '';
    const tags = xpath.split('/');

    for (const tag of tags) {
      const tagName = tag.match(/^\w+(?=\[)?/);

      if (tagName !== null) {
        let index = tag.match(/\[(\d+)\]/);
        if (index === null) {
          index = 0;
        } else {
          index = parseInt(index[1]);
          index--; // xpath is 1-based and "eq()" is 0-based
        }

        //accumulates
        editorPath += `*[_tag="${tagName[0]}"]:eq(${index}) > `;
      }
    }

    editorPath = editorPath.substr(0, editorPath.length - 3); //remove final xpath index?

    return editorPath;
  };

  /*
		error types
		- AttributeNameError
		- AttributeValueError
		- ElementNameError
		- ChoiceError
		- ValidationError (more severe?)
	*/
  const createErrorMessage = ({ type, msg, target, element }) => {
    switch (type) {
      case 'ElementNameError':
        msg = `Tag
          <span
            class="element"
            ${target.fullName ? `data-tooltip="${target.fullName}"` : ''}
          >
            ${target.name}
          </span>
          not allowed in
          <span
            class="element"
            ${element.fullName ? `data-tooltip="${element.fullName}"` : ''}
          >
            ${element.name}
          </span>
        `;
        break;
      case 'AttributeNameError':
        msg = `Attribute
          <span
            class="element"
            ${target.fullName ? `data-tooltip="${target.fullName}"` : ''}
          >
            ${target.name}
          </span>
          not allowed in
          <span
            class="element"
            ${element.fullName ? `data-tooltip="${element.fullName}"` : ''}
          >
            ${element.name}
          </span>
        `;
        break;
      case 'AttributeValueError':
        msg = `Invalid attribute value for 
          <span
            class="element"
            ${target.fullName ? `data-tooltip="${target.fullName}"` : ''}
          >
            ${target.name}
          </span>
          in
          <span
            class="element"
            ${element.fullName ? `data-tooltip="${element.fullName}"` : ''}
          >
            ${element.name}
          </span>
        `;
        break;
      case 'ValidationError':
        msg = `Text not allowed in  
          <span
            class="element"
            ${element.fullName ? `data-tooltip="${element.fullName}"` : ''}
          >
            ${element.name}
          </span>
        `;
        break;
    }
    return msg;
  };

  const createErrorMessageComponent = (data) => {
    const { type } = data;
    const errorMessage = createErrorMessage(data);

    const html = dedent(`
			<li>
				<span class="ui-icon ${type === 'ValidationError' ? 'ui-icon-alert' : 'ui-icon-info'}"></span>
				${errorMessage}
				<div class="moreButton">
					<span class="ui-icon ui-icon-caret-1-s"></span>
				</div>
				<div id="details"></div>
			</li>
		`);

    return { html, data };
  };

  const createDocumentationComponent = async ($item) => {
    const { target, element } = $item.data().data;

    $($item).show();
    const $details = $item.find('#details');

    const html = dedent(`
			<div class="documentation">
				${
          target.name
            ? `<div class="text">
						<u>${target.name}</u>: ${target.documentation}
					</div>`
            : ''
        }
				<div class="text">
					<u>${element.name}</u>: ${element.documentation}
				</div>
			</div>
      <div class="possible"></div>
			<div class="xpath">
				<u>XPath</u>: ${target.xpath ?? element.xpath}
			</div>
		`);

    $details.append(html);

    let possibilities;
    if ($item.data().data.possibilities) {
      possibilities = $item.data().data.possibilities;
    } else {
      possibilities = await getPossible($item.data().data);
      const data = $item.data().data;
      data.possibilities = possibilities;
      $item.data('data', data);
    }

    const $possibleHTML = $item.find('.possible');
    let possibleItems = '<span>Expected </span>';

    if (possibilities.possibleNodes.length > 0) {
      possibilities.possibleNodes.map(({ name }) => {
        if (name === 'endTag') name = 'end of tag';
        possibleItems += dedent(`
          <span class="element">
            ${name}
          </span>
        `);
      });

      possibleItems += '<span> or </span>';
    }

    possibilities.possibleTags.map(({ name, fullName }) => {
      possibleItems += dedent(`
        <span
          class="element"
          ${fullName ? `data-tooltip="${fullName}"` : ''}
        >
					${name}
				</span>
			`);
    });

    $possibleHTML.append(possibleItems);
  };

  const getPossible = async ({ type, target, element }) => {
    const response = await w.overmindActions.validator.workerGetPossibleFromError({
      type,
      target,
      element,
    });
    if (!response) return [];
    return response;
  };

  validation.clearResult = () => {
    $(`#${id}_indicator`).hide();
    $(`#${id} > ul`).empty();
  };

  const $validateButton = $(`#${id}_buttons button[role=validate]`).button();
  $validateButton.click(() => validation.validate({ userRequest: true }));

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
