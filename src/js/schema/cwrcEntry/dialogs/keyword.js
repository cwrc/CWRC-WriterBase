var $ = require('jquery');
var DialogForm = require('dialogForm');

module.exports = function(writer) {
    var w = writer;
    
    var id = w.getUniqueId('citationForm_');
    var $el = $(''+
    '<div class="annotationDialog">'+
        '<div>'+
            '<input type="text" data-type="textbox" data-mapping="KEYWORDTYPE" />'+
        '</div>'+
        '<div data-transform="accordion">'+
            '<h3>Markup options</h3>'+
            '<div id="'+id+'_attParent" class="attributes" data-type="attributes" data-mapping="attributes">'+
            '</div>'+
        '</div>'+
    '</div>').appendTo(document.body);
    
    var dialog = new DialogForm({
        writer: w,
        $el: $el,
        type: 'keyword',
        title: 'Tag Keyword',
        height: 350,
        width: 350
    });
    
    return {
        show: function(config) {
            dialog.show(config);
        }
    };
};
