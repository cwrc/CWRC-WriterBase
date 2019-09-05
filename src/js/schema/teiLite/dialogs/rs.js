var $ = require('jquery');
var DialogForm = require('dialogForm');

require('jquery-ui/ui/widgets/selectmenu');

module.exports = function(writer, parentEl) {
    var w = writer;

    var OTHER_OPTION = '$$$$OTHER$$$$';

    var id = w.getUniqueId('rsForm_');
    var $el = $(''+
    '<div class="annotationDialog">'+
        '<div id="'+id+'_tagAs">'+
            '<p>Tag as:</p>'+
            '<span class="tagAs" data-type="label" data-mapping="prop.lemma"></span>'+
        '</div>'+
        '<div id="'+id+'_certainty" data-transform="buttonset" data-type="radio" data-mapping="cert">'+
            '<p>This identification is:</p>'+
            '<input type="radio" id="'+id+'_high" name="'+id+'_id_certainty" value="high" data-default="true" /><label for="'+id+'_high">High</label>'+
            '<input type="radio" id="'+id+'_medium" name="'+id+'_id_certainty" value="medium" /><label for="'+id+'_medium">Medium</label>'+
            '<input type="radio" id="'+id+'_low" name="'+id+'_id_certainty" value="low" /><label for="'+id+'_low">Low</label>'+
            '<input type="radio" id="'+id+'_unknown" name="'+id+'_id_certainty" value="unknown" /><label for="'+id+'_unknown">Unknown</label>'+
        '</div>'+
        '<div>'+
            '<div class="type">'+
                '<label>Type (optional):</label>'+
                '<select name="type" data-mapping="type" data-type="select" data-transform="selectmenu"></select>'+
            '</div>'+
            '<div style="margin-top: 5px;">'+
                '<label>Other type:</label>'+
                '<input name="otherType" type="text" data-mapping="type" data-type="textbox" />'+
            '</div>'+
        '</div>'+
        '<div data-transform="accordion">'+
            '<h3>Markup options</h3>'+
            '<div id="'+id+'_attParent" class="attributes" data-type="attributes" data-mapping="attributes">'+
            '</div>'+
        '</div>'+
    '</div>').appendTo(parentEl);
    
    var dialog = new DialogForm({
        writer: w,
        $el: $el,
        type: 'rs',
        title: 'Tag Referencing String'
    });

    var typeRoot = 'http://sparql.cwrc.ca/ontology/cwrc#';
    var types = ["Award", "BirthPosition", "Certainty", "Credential", "EducationalAward", "Ethnicity", "Gender", "GeographicHeritage", "NationalHeritage", "NationalIdentity", "NaturalPerson", "Occupation", "PoliticalAffiliation", "Precision", "RaceColour", "Religion", "ReproductiveHistory", "Role", "Sexuality", "SocialClass", "TextLabels"];

    // add types to select menu and add event handler
    var typeString = '';
    typeString += '<option value="">(none)</option>';
    typeString += '<option value="'+OTHER_OPTION+'">Other (specify)</option>';
    types.forEach(function(type) {
        typeString += '<option value="'+typeRoot+type+'">'+type+'</option>';
    });

    $el.find('select[name=type]')
        .html(typeString)
        .selectmenu('refresh')
        .on('selectmenuselect', function(e, ui) {
            if (ui.item.value === OTHER_OPTION) {
                $el.find('input[name=otherType]').parent().show();
            } else {
                // set the other input value to that of the selection and then hide
                $el.find('input[name=otherType]').val(ui.item.value).parent().hide();
                // manually fire change event in order to update attribute widget
                $(this).trigger('change', {
                    target: this
                });
            }
        });
    $el.find('select[name=type]').selectmenu('menuWidget').addClass('overflow').height('300px');


    dialog.$el.on('beforeShow', function(e, config) {
        // handle type selection
        var entry = config.entry;

        var typeValue = '';
        var otherType = false;
        if (entry !== undefined && entry.getAttribute('type') !== undefined) {
            typeValue = entry.getAttribute('type');
            otherType = types.indexOf(typeValue) === -1;
        }
        if (otherType) {
            $el.find('select[name=type]').val(OTHER_OPTION).selectmenu('refresh');
            $el.find('input[name=otherType]').val(typeValue).parent().show();
        } else {
            $el.find('select[name=type]').val(typeValue);
            $el.find('input[name=otherType]').val(typeValue).parent().hide();
        }
    });

    dialog.$el.on('beforeSave', function(e, config) {
        if (dialog.currentData.attributes.type === '') {
            delete dialog.currentData.attributes.type;
        }
    });
    
    return {
        show: function(config) {
            dialog.show(config);
        },
        destroy: function() {
            $el.find('select[name=type]').selectmenu('destroy');
            dialog.destroy();
        }
    };
};
