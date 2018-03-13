var $ = require('jquery');
var DialogForm = require('dialogForm');

module.exports = function(writer, parentEl) {
    var w = writer;
    
    var id = w.getUniqueId('corrForm_');
    var $el = $(''+
    '<div class="annotationDialog">'+
        '<div>'+
            '<p>Correction</p><textarea data-type="textbox" data-mapping="CORR"></textarea>'+
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
    
    return {
        show: function(config) {
            dialog.show(config);
        },
        destroy: function() {
            dialog.destroy();
        }
    };
};
