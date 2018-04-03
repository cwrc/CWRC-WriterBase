var $ = require('jquery');
var DialogForm = require('dialogForm');
require('jquery-ui/ui/widgets/button');

module.exports = function(writer, parentEl) {
    var w = writer;
    
    var id = w.getUniqueId('linkForm_');
    var $el = $(''+
    '<div class="annotationDialog">'+
        '<div>'+
            '<label for="'+id+'_input">Hypertext link (URL or URI)</label>'+
            '<input type="text" id="'+id+'_input" data-type="textbox" data-mapping="URL" style="margin-right: 10px;"/>'+
            '<button type="button">Check Link</button>'+
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
        width: 350,
        height: 350,
        type: 'link',
        title: 'Tag Link'
    });
    
    $('button', $el).button().click(function() {
        var src = $('#'+id+'_input').val();
        if (src != '') {
            if (src.match(/^https?:\/\//) == null) {
                src = 'http://'+src;
            }
            try {
                window.open(src, 'linkTestWindow');
            } catch(e) {
                alert(e);
            }
        }
    });
    
    return {
        show: function(config) {
            dialog.show(config);
        },
        destroy: function() {
            $('button', $el).button('destroy');
            dialog.destroy();
        }
    };
};
