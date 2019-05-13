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
            if (sicText === undefined) {
                // update corrText from entity content
                $el.find('textarea').val(config.entry.getContent());
            }
        }
        if (sicText !== undefined && sicText !== '') {
            dialog.currentData.customValues.sicText = sicText;
        }
    });
    
    dialog.$el.on('beforeSave', function(e, dialog) {
        var sicText = dialog.currentData.customValues.sicText;
        var corrText = dialog.currentData.customValues.corrText;
        // TODO need to handle conversion back and forth
        dialog.currentData.customValues.corrText = w.utilities.convertTextForExport(corrText);
        
        if (dialog.mode === DialogForm.EDIT) {
            if (sicText == undefined) {
                // set editor and entity content from corrText
                var entityId = w.entitiesManager.getCurrentEntity();
                $('#'+entityId, w.editor.getBody()).text(corrText);
                w.entitiesManager.getEntity(entityId).setContent(corrText);
            }
        } else {
            // insert the correction text
            if (sicText === undefined) {
                var tempId = w.getUniqueId('temp');
                var $temp = $('<span id="'+tempId+'"/>', w.editor.getDoc());
                var range = w.editor.selection.getRng(true);
                // insert temp span at the current range
                range.surroundContents($temp[0]);
                // add the text content
                $temp.html(corrText);
                var textNode = $temp[0].firstChild;
                // remove the temp span
                $(textNode).unwrap();
                // select the text content as the new range and save as bookmark
                range.selectNodeContents(textNode);
                w.editor.currentBookmark = w.editor.selection.getBookmark(1);
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
