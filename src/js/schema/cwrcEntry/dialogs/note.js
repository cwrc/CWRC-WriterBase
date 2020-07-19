var $ = require('jquery');
var DialogForm = require('../../../dialogs/dialogForm/dialogForm'); 

module.exports = function(writer, parentEl) {
    var w = writer;
    
    var id = w.getUniqueId('noteForm_');
    var $el = $(''+
    '<div class="annotationDialog">'+
        '<div>'+
            '<div id="'+id+'_type" data-transform="buttonset" data-type="radio" data-mapping="prop.tag">'+
                '<input type="radio" id="'+id+'_re" name="'+id+'_type" value="RESEARCHNOTE" data-default="true" /><label for="'+id+'_re">Research Note</label>'+
                '<input type="radio" id="'+id+'_scho" name="'+id+'_type" value="SCHOLARNOTE" /><label for="'+id+'_scho">Scholarly Note</label>'+
            '</div>'+
        '</div>'+
        '<div>'+
            '<label for="'+id+'_noteContent">Note text</label>'+
            '<textarea id="'+id+'_noteContent" data-type="textbox" data-mapping="prop.noteContent" style="width: 98%; height: 100px;"></textarea>'+
            '<p>You will be able to tag and edit the text in the main document.</p>'+
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
        width: 600,
        height: 500,
        type: 'note',
        title: 'Tag Note'
    });
    
    dialog.$el.on('beforeShow', function(e, config, dialog) {
        if (dialog.mode === DialogForm.EDIT) {
            dialog.$el.find('label[for='+id+'_noteContent]').hide();
            dialog.$el.find('#'+id+'_noteContent').hide();
        } else {
            dialog.$el.find('label[for='+id+'_noteContent]').show();
            dialog.$el.find('#'+id+'_noteContent').show();
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
