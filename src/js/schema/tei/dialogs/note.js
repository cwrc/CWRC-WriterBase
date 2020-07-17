const $ = require('jquery');
const DialogForm = require('dialogForm');


const defaultTypeOptions = [
    { value: 'researchNote', label: 'Research Note', title: 'Internal to projects' },
    { value: 'scholarNote', label: 'Scholarly Note', title: 'Footnotes/endnotes' },
    { value: 'annotation', label: 'Annotation', title: 'Informal notes' },
    { value: 'other', label: 'Other', title: 'Other Notes' },
];

module.exports = function(writer, parentEl) {

    const type = 'note';

    const atts = writer.schemaManager.getAttributesForTag(type);
    const typeAtt = atts.find(({name}) => name === 'type');

    const typeRequired = (typeAtt.required) ? 'required' : '';
    
    
	const id = writer.getUniqueId('noteForm_');
	const html = `
    <div class="annotationDialog">
        <div>
            <label for="${id}_type"><b>Type</b></label>
            <select id="${id}_type" name="${id}_type" data-type="select" data-mapping="type" ${typeRequired}></select>
            <div id="${id}_noteOtherTypeSlot">
                <br/>
                <label for="${id}_noteOtherType"><b>Define Type</b></label>
                <input type="text" id="${id}_noteOtherType" data-type="textbox" data-mapping="otherType" style="margin-right: 10px;"/>
            </div>
        </div>
        <div>
            <label for="${id}_noteContent">Note text</label>
            <textarea id="${id}_noteContent" data-type="textbox" data-mapping="prop.noteContent" style="width: 98%; height: 100px;"></textarea>
            <p>You will be able to tag and edit the text in the main document.</p>
        </div>
        <div data-transform="accordion">
            <h3>Markup options</h3>
            <div id="${id}_attParent" class="attributes" data-type="attributes" data-mapping="attributes">
            </div>
        </div>
    `;

    const $el = $(html).appendTo(parentEl);

    const dialog = new DialogForm({
		writer,
        $el,
        type,
		title: 'Tag Note',
		width: 600,
		height: 500,
    });
    
    const optionsTypeElement = dialog.$el.find(`#${id}_type`);
    const noteOtherTypeElement = dialog.$el.find(`#${id}_noteOtherType`);
   
    dialog.$el.on('buildDynamicFields', (e, config, dialog) => {
        //TYPE
        const typeChoices = (typeAtt.choices) ? typeAtt.choices : defaultTypeOptions;
        const choiceOptions = generateTypeOptions(typeChoices);
        optionsTypeElement.html(choiceOptions)
	});

	dialog.$el.on('beforeShow', (e, config, dialog) => {
        const show = dialog.mode === DialogForm.EDIT;
		dialog.$el.find(`label[for=${id}_noteContent]`).toggle(!show);
        dialog.$el.find(`#${id}_noteContent`).toggle(!show);
        
        //other type
        const typeValue = optionsTypeElement.val();
        const showOtherTypeTextFiel = (!typeAtt.choices && typeValue === 'other') ? true : false
        toggleOtherTypeTextField(showOtherTypeTextFiel);
       
    });

    dialog.$el.on('beforeSave', (e, dialog) => {
        //replace other type option for custom defined value
        if (!typeAtt.choices && optionsTypeElement.val() === 'other') {
            const otherTypeFieldValue= dialog.$el.find(`#${id}_noteOtherType`).val();
            const typeCutstomOption = `<option value="${otherTypeFieldValue}" selected>${otherTypeFieldValue}</option>`;
            optionsTypeElement.html(typeCutstomOption);
        }
    });
    
     //show/hide other type textfield
	const toggleOtherTypeTextField = (show) => {
        dialog.$el.find(`#${id}_noteOtherTypeSlot`).toggle(show);
        if (!show) dialog.$el.find(`#${id}_noteOtherType`).val('');
    };

    //toggle other type text field
	optionsTypeElement.change((e) => {
        if (typeAtt.choices) return;
        const target = $(e.target);
		const otherTypeSelected = (target.val() === 'other') ? true : false;
		toggleOtherTypeTextField(otherTypeSelected);
    });
    
    //transfer value from 'other type 'textfied to 'other' option value on radiobox
    dialog.$el.find(`#${id}_noteOtherType`).change(() => {
        const val = dialog.$el.find(`#${id}_noteOtherType`).val();
        dialog.$el.find(`#${id}_other`).attr('value', val);
    });


    noteOtherTypeElement.keyup((e) => {
        if (e.code === 'Space') {
            writer.dialogManager.confirm({
                title: 'Warning',
                msg: `Are you trying to add multiple values for this attribute? If not, remove the "space" you've just added`,
                height: 200,
                type: 'info',
                showConfirmKey: 'confirm-space-in-xml-values',
            })
        }
    });

    const generateTypeOptions = (choices) => {

        let html = '<option value="" disabled selected hidden>Please Choose...</option>';
        html += '<option value=""></option>';
        
        choices.map((choice) => {
            const value = (typeof choice === 'string') ? choice : choice.value;
            const label = (typeof choice === 'string') ? choice : choice.label;

            const defaultChoice = (typeAtt.defaultValue === value) ? true : false;
            const selected = defaultChoice ? 'selected' : '';

            html += `<option value="${value}" data-default="${defaultChoice}" ${selected}>${label}</option>`;
        });

        return html;
    }

	return {
		show: (config) => dialog.show(config),
		destroy: () => dialog.destroy(),
	};
};