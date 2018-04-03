var $ = require('jquery');
var DialogForm = require('dialogForm');

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
        '<div class="writerParent">'+
            '<div data-transform="writer" style="width: 100%; height: 100%; border: none;"/>'+
        '</div>'+
    '</div>').appendTo(parentEl);
    
    var dialog = new DialogForm({
        writer: w,
        $el: $el,
        width: 850,
        height: 650,
        type: 'note',
        title: 'Tag Note'
    });
    
    $('#'+id+'_type input').click(function() {
        var newTag = $(this).val();
        var allOtherTags = $(this).siblings('input').map(function(index, el) {
            return $(el).val();
        }).get();
        var tagsSelector = '';
        for (var i = 0, len = allOtherTags.length; i < len; i++) {
            tagsSelector += '*[_tag="'+allOtherTags[i]+'"]';
            if (len > 1 && i !== len-1) {
                tagsSelector += ',';
            }
        }
        var parentTag = $(tagsSelector, dialog.cwrcWriter.editor.getBody()).first();
        dialog.cwrcWriter.tagger.changeTagValue(parentTag, newTag);
    });
    
    dialog.$el.on('dialogopen', function(e, ui) {
        if (w.isReadOnly) {
            $('#'+id+'_type').buttonset('disable');
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
