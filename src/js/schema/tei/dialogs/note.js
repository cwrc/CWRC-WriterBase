var $ = require('jquery');
var DialogForm = require('dialogForm');

module.exports = function(writer, parentEl) {
    var w = writer;
    
    var id = w.getUniqueId('noteForm_');
    var $el = $(''+
    '<div class="annotationDialog">'+
        '<div>'+
            '<div id="'+id+'_type" data-transform="buttonset" data-type="radio" data-mapping="type">'+
                '<input type="radio" id="'+id+'_re" name="'+id+'_type" value="researchNote" data-default="true" /><label for="'+id+'_re" title="Internal to projects">Research Note</label>'+
                '<input type="radio" id="'+id+'_scho" name="'+id+'_type" value="scholarNote" /><label for="'+id+'_scho" title="Footnotes/endnotes">Scholarly Note</label>'+
                '<input type="radio" id="'+id+'_ann" name="'+id+'_type" value="typeAnnotation" /><label for="'+id+'_ann" title="Informal notes">Annotation</label>'+
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
