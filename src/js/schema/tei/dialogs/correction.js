var $ = require('jquery');
var DialogForm = require('dialogForm');

module.exports = function(writer, parentEl) {
    var w = writer;
    
    var id = w.getUniqueId('corrForm_');
    var $el = $(''+
    '<div class="annotationDialog">'+
        '<div>'+
            '<p>Correction</p><textarea data-type="textbox" data-mapping="custom.corrText"></textarea>'+
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
        width: 385,
        height: 400,
        type: 'correction',
        title: 'Tag Correction'
    });
    
    dialog.$el.on('beforeShow', function(e, config, dialog) {
        var sicText;
        if (dialog.mode === DialogForm.ADD) {
            sicText = w.editor.currentBookmark.rng.toString();
        } else {
            sicText = config.entry.getCustomValue('sicText');
        }
        if (sicText !== undefined && sicText !== '') {
            dialog.currentData.customValues.sicText = sicText;
        }
    });
    
    dialog.$el.on('beforeSave', function(e, dialog) {
        var sicText = dialog.currentData.customValues.sicText;
        var corrText = dialog.currentData.customValues.corrText;
        
        if (dialog.mode === DialogForm.EDIT) {
            // TODO
//            if (sicText == undefined) {
//                // edit the correction text
//                var entityStart = $('[name="'+w.entitiesManager.getCurrentEntity()+'"]', writer.editor.getBody())[0];
//                var textNode = w.utilities.getNextTextNode(entityStart);
//                textNode.textContent = data.corrText;
//            }
        } else {
            if (sicText === undefined) {
                // insert the correction text so we can make an entity out of that
                w.editor.execCommand('mceInsertContent', false, corrText);
            }
        }
    });
    
    return {
        show: function(config) {
            dialog.show(config);
        },
        destroy: function() {
            dialog.destroy();
        }
    };
};
