var $ = require('jquery');
var DialogForm = require('dialogForm');

module.exports = function(writer, parentEl) {
    var w = writer;
    
    var forceSave = false; // needed for confirmation dialog in beforeSave

    var id = w.getUniqueId('keywordForm_');
    var $el = $(''+
    '<div class="annotationDialog">'+
        '<div>'+
            '<label for="'+id+'_input">Keyword</label>'+
            '<input type="text" id="'+id+'_input" data-type="textbox" data-mapping="prop.content" style="margin-right: 10px;"/>'+
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
        type: 'keyword',
        title: 'Tag Keyword',
        height: 420,
        width: 420
    });
    
    dialog.$el.on('beforeSave', function(e, dialog) {
        if (forceSave) {
            dialog.isValid = true;
        } else {
            if (dialog.currentData.attributes.ana !== undefined) {
                dialog.isValid = true;
            } else {
                dialog.isValid = false;
                w.dialogManager.confirm({
                    title: 'Warning',
                    msg: '<p>It is recommended to reference a taxonomy (using the ana attribute) when creating keywords.</p>'+
                    '<p>Are you sure you want to save your keyword without linking it to a taxonomy term?</p>',
                    type: 'info',
                    callback: function(doIt) {
                        if (doIt) {
                            forceSave = true;
                            dialog.save();
                        }
                    }
                });
            }
        }
        if (dialog.isValid) {
            var content = w.utilities.convertTextForExport(dialog.currentData.properties.content);
            dialog.currentData.properties.content = content;
            dialog.currentData.properties.noteContent = '<span _tag="term">'+content+'</span>';
        }
    });

    dialog.$el.on('beforeShow', function(e, config) {
        dialog.isValid = true;
        forceSave = false;

        if (dialog.mode === DialogForm.ADD) {
            dialog.attributesWidget.setData({type: 'keyword'});
            dialog.attributesWidget.setData({ana: ''});
            dialog.attributesWidget.expand();
        } else {
            var noteContent = config.entry.getNoteContent();
            var noteContentEl = w.utilities.stringToXML(noteContent);
            var content = noteContentEl.documentElement.textContent;
            $(this).find('#'+id+'_input').val(content);
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
