var $ = require('jquery');
var DialogForm = require('dialogForm');

module.exports = function(writer, parentEl) {
    var w = writer;

    var id = w.getUniqueId('citationForm_');
    var $el = $(''+
    '<div class="annotationDialog">'+
        '<div>'+
            '<p>Selected source:</p>'+
            '<span class="tagAs" data-type="tagAs"></span>'+
        '</div>'+
        '<div class="writerParent">'+
            '<p>Text of citation:</p>'+
            '<div data-transform="writer" style="width: 100%; height: 100%; border: none;"/>'+
        '</div>'+
        '<input type="hidden" id="'+id+'_ref" data-type="hidden" data-mapping="ref"/>'+
        '<input type="hidden" id="'+id+'_type" data-type="hidden" data-mapping="type"/>'+
    '</div>').appendTo(parentEl);

    var dialog = new DialogForm({
        writer: w,
        $el: $el,
        width: 850,
        height: 650,
        type: 'citation',
        title: 'Tag Citation'
    });

    dialog.$el.on('dialogopen', function(e, ui) {
        $('#'+id+'_type').val('citation');
        var cwrcInfo = dialog.currentData.cwrcInfo;
        if (cwrcInfo !== undefined) {
            $('#'+id+'_ref').val(cwrcInfo.id);
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
