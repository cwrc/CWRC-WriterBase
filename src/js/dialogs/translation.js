'use strict';

import { iso6392 } from 'iso-639-2';
import $ from 'jquery';
import 'jquery-ui/ui/widgets/accordion';
import 'jquery-ui/ui/widgets/dialog';
import AttributeWidget from './attributeWidget/attributeWidget.js';

    
function Translation(writer, parentEl) {
    var w = writer;
    
    var id = w.getUniqueId('translation_');

    // TODO hardcoded
    var tagName = 'div';
    var textParentTagName = 'p';
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
        var translation = $('#'+id+'_trans').val();
        var attributes = attributesWidget.getData();

        var currTagId = w.tagger.getCurrentTag().attr('id')
        var newTag = w.tagger.addStructureTag(tagName, attributes, {tagId: currTagId}, w.tagger.AFTER);
        var textTag = w.tagger.addStructureTag(textParentTagName, {}, {tagId: newTag.id}, w.tagger.INSIDE);
        $(textTag).html(translation);
    };

    return {
        show: function(config) {
            var currTag = w.tagger.getCurrentTag().attr('_tag');
            if (currTag !== tagName) {
                w.dialogManager.show('message', {
                    title: 'Translation',
                    msg: `Please select a ${tagName} tag to translate.`,
                    type: 'info'
                });
                return;
            }

            var $resp = $('#'+id+'_resp');
            var hasResp = w.schemaManager.isAttributeValidForTag(respAttribute, tagName)
            if (!hasResp) {
                $resp.parent().hide()
            } else {
                $resp.parent().show()
            }
            $resp.prop('checked', false);

            var firstLang = $('#'+id+'_lang > option:eq(0)').val();
            $('#'+id+'_lang').val(firstLang);
            $('#'+id+'_trans').val('');

            attributesWidget.mode = AttributeWidget.ADD;
            var atts = w.schemaManager.getAttributesForTag(tagName);
            var initVals = {
                type: 'translation' // TODO hardcoded
            };
            initVals[langAttribute] = firstLang;
            attributesWidget.buildWidget(atts, initVals, tagName);

            $('#'+id+'_atts').parent().accordion('option', 'active', false);

            $el.dialog('open');
        },
        destroy: function() {
            $('#'+id+'_atts').parent().accordion('destroy');
            $el.dialog('destroy');
        }
    };
}

export default Translation;
