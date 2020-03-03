'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/dialog');
require('jquery-ui/ui/widgets/accordion');

var iso6392 = require('iso-639-2');
var AttributeWidget = require('./attributeWidget/attributeWidget.js');
    
function Translation(writer, parentEl) {
    var w = writer;
    
    var id = w.getUniqueId('translation_');

    // TODO hardcoded
    var tagName = 'div';
    var langAttribute = 'xml:lang';
    var respAttribute = 'resp';

    var $el = $(`
    <div class="annotationDialog">
        <div>
            <label for="${id}_lang">Language:</label>
            <select id="${id}_lang"></select>
        </div>
        <div>
            <label for="${id}_resp">Add Responsibility:</label>
            <input id="${id}_resp" type="checkbox" />
        </div>
        <div>
            <label for="${id}_trans">Translation text</label>
            <textarea id="${id}_trans" style="width: 98%; height: 100px;" spellcheck="false"></textarea>
            <p>You will be able to tag and edit the text in the main document.</p>
        </div>
        <div>
            <h3>Markup options</h3>
            <div id="${id}_atts" class="attributes" />
        </div>
    </div>`).appendTo(parentEl);
    
    $el.dialog({
        title: 'Tag Translation',
        modal: true,
        resizable: true,
        closeOnEscape: true,
        height: 500,
        width: 600,
        autoOpen: false,
        buttons: [{
            text: 'Ok',
            role: 'ok',
            click: function() {
                formResult();
                $el.dialog('close');
            },
        },{
            text: 'Cancel',
            role: 'cancel',
            click: function() {
                $el.dialog('close');
            }
        }],
        open: function(e) {
        },
        close: function(e) {
        }
    });

    var langOptions = iso6392.reduce((result, lang) => {
        var value = lang.iso6391;//lang.iso6392T === undefined ? lang.iso6392B : lang.iso6392T
        var name = lang.name;
        if (value !== undefined) {
            result.push({
                name, value
            })
        }
        return result;
    }, []);
    langOptions.sort((a, b) => {
        if (a.name > b.name) {
            return 1
        }
        if (a.name < b.name) {
            return -1
        }
        return 0
    })

    var options = '';
    langOptions.forEach(lang => {
        options += `<option value="${lang.value}">${lang.name}</option>`;
    })
    $('#'+id+'_lang').html(options);
    
    $('#'+id+'_atts').parent().accordion({
        heightStyle: 'content',
        animate: false,
        collapsible: true,
        active: false
    });

    var attributesWidget = new AttributeWidget({
        writer: w,
        $parent: $el,
        $el: $('#'+id+'_atts'),
        showSchemaHelp: true
    });

    $('#'+id+'_lang').on('change', event => {
        attributesWidget.setAttribute(langAttribute, event.target.value);
    });

    $('#'+id+'_resp').on('change', event => {
        if (event.target.checked) {
            attributesWidget.setAttribute(respAttribute, w.getUserInfo().nick);
        } else {
            attributesWidget.setAttribute(respAttribute, undefined);
        }
    });

    var formResult = function() {
        var lang = $('#'+id+'_lang').val();
        var translation = $('#'+id+'_trans').val();
        var addResp = $('#'+id+'_resp').prop('checked');
        var attributes = attributesWidget.getData();

        var newTag = w.tagger.addStructureTag(tagName, attributes, w.editor.currentBookmark, w.tagger.AFTER);
        $(newTag).html(translation);
    };

    return {
        show: function(config) {
            var firstLang = $('#'+id+'_lang > option:eq(0)').val();
            $('#'+id+'_lang').val(firstLang);
            $('#'+id+'_resp').prop('checked', false);
            $('#'+id+'_trans').val('');

            attributesWidget.mode = AttributeWidget.ADD;
            var atts = w.schemaManager.getAttributesForTag(tagName);
            attributesWidget.buildWidget(atts, {}, tagName);

            $('#'+id+'_atts').parent().accordion('option', 'active', false);

            $el.dialog('open');
        },
        destroy: function() {
            $('#'+id+'_atts').parent().accordion('destroy');
            $el.dialog('destroy');
        }
    };
}

module.exports = Translation;
