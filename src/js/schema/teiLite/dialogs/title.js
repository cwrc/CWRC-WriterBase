var $ = require('jquery');
var DialogForm = require('dialogForm');

module.exports = function(writer, parentEl) {
    var w = writer;
    
    var id = w.getUniqueId('titleForm_');
    var $el = $(''+
    '<div id="'+id+'Dialog" class="annotationDialog">'+
        '<div id="'+id+'_tagAs">'+
            '<p>Tag as:</p>'+
            '<span class="tagAs" data-type="label" data-mapping="prop.lemma"></span>'+
        '</div>'+
        '<div id="'+id+'_level" data-type="radio" data-mapping="level">'+
            '<p>This title is:</p>'+
            '<input type="radio" value="a" name="level" id="'+id+'_level_a"/>'+
            '<label for="'+id+'_level_a">Analytic <span>article, poem, or other item published as part of a larger item</span></label><br/>'+
            '<input type="radio" value="m" name="level" id="'+id+'_level_m" data-default="true" />'+
            '<label for="'+id+'_level_m">Monographic <span>book, collection, single volume, or other item published as a distinct item</span></label><br/>'+
            '<input type="radio" value="j" name="level" id="'+id+'_level_j"/>'+
            '<label for="'+id+'_level_j">Journal <span>magazine, newspaper or other periodical publication</span></label><br/>'+
            '<input type="radio" value="s" name="level" id="'+id+'_level_s"/>'+
            '<label for="'+id+'_level_s">Series <span>book, radio, or other series</span></label><br/>'+
            '<input type="radio" value="u" name="level" id="'+id+'_level_u"/>'+
            '<label for="'+id+'_level_u">Unpublished <span>thesis, manuscript, letters or other unpublished material</span></label><br/>'+
        '</div>'+
        '<div id="'+id+'_certainty" data-transform="buttonset" data-type="radio" data-mapping="cert">'+
            '<p>This identification is:</p>'+
            '<input type="radio" id="'+id+'_high" name="'+id+'_id_certainty" value="high" data-default="true" /><label for="'+id+'_high">High</label>'+
            '<input type="radio" id="'+id+'_medium" name="'+id+'_id_certainty" value="medium" /><label for="'+id+'_medium">Medium</label>'+
            '<input type="radio" id="'+id+'_low" name="'+id+'_id_certainty" value="low" /><label for="'+id+'_low">Low</label>'+
            '<input type="radio" id="'+id+'_unknown" name="'+id+'_id_certainty" value="unknown" /><label for="'+id+'_unknown">Unknown</label>'+
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
        width: 630,
        height: 660,
        type: 'title',
        title: 'Tag Title'
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
