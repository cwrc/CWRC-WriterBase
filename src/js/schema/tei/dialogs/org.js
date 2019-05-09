var $ = require('jquery');
var DialogForm = require('dialogForm');

module.exports = function(writer, parentEl) {
    var w = writer;
    
    var id = w.getUniqueId('orgForm_');
    var $el = $(''+
    '<div class="annotationDialog">'+
        '<div id="'+id+'_tagAs">'+
            '<p>Tag as:</p>'+
            '<span class="tagAs" data-type="tagAs"></span>'+
        '</div>'+
        '<div id="'+id+'_certainty" data-transform="buttonset" data-type="radio" data-mapping="cert">'+
            '<p>This identification is:</p>'+
            '<input type="radio" id="'+id+'_definite" name="'+id+'_id_certainty" value="definite" data-default="true" /><label for="'+id+'_definite">Definite</label>'+
            '<input type="radio" id="'+id+'_reasonable" name="'+id+'_id_certainty" value="reasonably certain" /><label for="'+id+'_reasonable">Reasonably Certain</label>'+
            '<input type="radio" id="'+id+'_probable" name="'+id+'_id_certainty" value="probable" /><label for="'+id+'_probable">Probable</label>'+
            '<input type="radio" id="'+id+'_speculative" name="'+id+'_id_certainty" value="speculative" /><label for="'+id+'_speculative">Speculative</label>'+
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
        height: 550,
        type: 'org',
        title: 'Tag Organization'
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
