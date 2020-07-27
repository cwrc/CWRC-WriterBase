var $ = require('jquery');
var DialogForm = require('../../../dialogs/dialogForm/dialogForm'); 

module.exports = function(writer, parentEl) {
    var w = writer;
    
    var id = w.getUniqueId('placeForm_');
    var $el = $(''+
    '<div class="annotationDialog">'+
        '<div id="'+id+'_certainty" data-transform="buttonset" data-type="radio" data-mapping="custom.placeType">'+
            '<p>Type of place:</p>'+
            '<input type="radio" id="'+id+'_address" name="'+id+'_type_place" value="ADDRESS" data-default="true" /><label for="'+id+'_address">Address</label>'+
            '<input type="radio" id="'+id+'_area" name="'+id+'_type_place" value="AREA" /><label for="'+id+'_area">Area</label>'+
            '<input type="radio" id="'+id+'_geog" name="'+id+'_type_place" value="GEOG" /><label for="'+id+'_geog">Geog</label>'+
            '<input type="radio" id="'+id+'_placename" name="'+id+'_type_place" value="PLACENAME" /><label for="'+id+'_placename">Placename</label>'+
            '<input type="radio" id="'+id+'_region" name="'+id+'_type_place" value="REGION" /><label for="'+id+'_region">Region</label>'+
            '<input type="radio" id="'+id+'_settlement" name="'+id+'_type_place" value="SETTLEMENT" /><label for="'+id+'_settlement">Settlement</label>'+
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
        type: 'place',
        title: 'Tag Place',
        width: 650,
        height: 450
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
