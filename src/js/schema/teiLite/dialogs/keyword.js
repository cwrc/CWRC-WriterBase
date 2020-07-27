var $ = require('jquery');
var DialogForm = require('../../../dialogs/dialogForm/dialogForm'); 

module.exports = function(writer, parentEl) {
    var w = writer;
    
    var forceSave = false; // needed for confirmation dialog in beforeSave

    var id = w.getUniqueId('keywordForm_');
    var $el = $(''+
    '<div class="annotationDialog">'+
        '<div>'+
            '<label for="'+id+'_noteContent">Keyword</label>'+
            '<input type="text" id="'+id+'_noteContent" data-type="textbox" data-mapping="prop.noteContent" style="margin-right: 10px;"/>'+
            '<p>You will be able to edit the keyword in the main document.</p>'+
        '</div>'+
        '<div data-transform="accordion">'+
            '<h3>Markup options</h3>'+
            '<div id="'+id+'_attParent" class="attributes" data-type="attributes" data-mapping="attributes">'+
            '</div>'+
        '</div>'+
        '<input type="hidden" data-type="hidden" data-mapping="type" value="keyword" />'+
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
                    msg: '<p>A human-readable keyword is preferably linked, using the "ana" attribute, to a controlled vocabulary.</p>'+
                    '<p>Click "Add Link" to add a URL for your term or "Skip Link" to save as is.</p>',
                    yesText: 'Skip Link',
                    noText: 'Add Link',
                    showConfirmKey: 'confirm-tei-keyword',
                    type: 'info',
                    callback: function(doIt) {
                        setTimeout(function() { // need setTimeout in case confirm dialog is skipped
                            if (doIt) {
                                forceSave = true;
                                dialog.save();
                            }
                        });
                    }
                });
            }
        }
    });

    dialog.$el.on('beforeShow', function(e, config) {
        dialog.isValid = true;
        forceSave = false;

        if (dialog.mode === DialogForm.ADD) {
            dialog.attributesWidget.setData({ana: ''});
            dialog.attributesWidget.expand();
            dialog.$el.find('label[for='+id+'_noteContent]').show();
            dialog.$el.find('#'+id+'_noteContent').show();
        } else {
            dialog.$el.find('label[for='+id+'_noteContent]').hide();
            dialog.$el.find('#'+id+'_noteContent').hide();
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
