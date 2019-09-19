'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/dialog');
require('jquery-ui/ui/widgets/accordion');

var iso6392 = require('iso-639-2');
var AttributeWidget = require('./attributeWidget/attributeWidget.js');
    
function Translation(writer, parentEl) {
    var w = writer;
    
    var id = w.getUniqueId('translation_');

    var $el = $(`
    <div class="annotationDialog">
        <div>
            <label>Language:</label>
            <select></select>
        </div>
        <div>
            <textarea style="height: 98%; width: 98%;" spellcheck="false"></textarea>
        </div>
        <div>
            <h3>Markup options</h3>
            <div class="attributeWidget" />
        </div>
    </div>`).appendTo(parentEl);
    
    $el.dialog({
        title: 'Tag Translation',
        modal: true,
        resizable: true,
        closeOnEscape: true,
        height: 480,
        width: 640,
        autoOpen: false,
        buttons: [{
            text: 'Ok',
            role: 'ok',
            click: function() {
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
            $('textarea', $el).val('');
        }
    });

    var langOptions = iso6392.map(lang => {
        var value = lang.iso6391;//lang.iso6392T === null ? lang.iso6392B : lang.iso6392T
        var name = lang.name;
        return {
            name, value
        }
    });
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
    $el.find('select').html(options);
    
    $el.find('.attributeWidget').parent().accordion({
        heightStyle: 'content',
        animate: false,
        collapsible: true,
        active: false
    });

    var attributesWidget = new AttributeWidget({
        writer: w,
        $parent: $el,
        $el: $el.find('.attributeWidget'),
        showSchemaHelp: true
    });


    return {
        show: function(config) {
            attributesWidget.mode = AttributeWidget.ADD;
            var tagName = 'div';
            var atts = w.schemaManager.getAttributesForTag(tagName);
            attributesWidget.buildWidget(atts, {}, tagName);

            $el.dialog('open');
        },
        destroy: function() {
            $el.find('.attributeWidget').parent().accordion('destroy');
            $el.dialog('destroy');
        }
    };
}

module.exports = Translation;
