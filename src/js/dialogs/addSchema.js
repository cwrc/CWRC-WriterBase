'use strict';

var $ = require('jquery');

    
function AddSchema(writer, parentEl) {
    var w = writer;
    
    // TODO add validation
    var $d = $(''+
    '<div>'+
        '<div>'+
            '<label>Schema Name</label>'+
            '<input type="text" name="name" value=""/>'+
        '</div>'+
        '<div style="margin-top: 10px;">'+
            '<label>Schema URL</label>'+
            '<input type="text" name="url" value=""/>'+
        '</div>'+
        '<div style="margin-top: 10px;">'+
            '<label>Schema CSS URL</label>'+
            '<input type="text" name="cssUrl" value=""/>'+
        '</div>'+
    '</div>').appendTo(parentEl)
    
    $d.dialog({
        modal: true,
        resizable: false,
        closeOnEscape: false,
        open: function(event, ui) {
            $d.parent().find('.ui-dialog-titlebar-close').hide();
        },
        title: 'Add Schema',
        height: 300,
        width: 250,
        position: { my: "center", at: "center", of: w.layoutManager.getContainer()},
        autoOpen: false,
        buttons: {
            'Add': function() {
                var info = {};
                $('input', $d).each(function(index, el) {
                    info[el.getAttribute('name')] = $(el).val();
                });
                var id = w.schemaManager.addSchema(info);
                $d.dialog('close');
            },
            'Cancel': function() {
                $d.dialog('close');
            }
        }
    });
    
    return {
        show: function(config) {
            $('input', $d).val('');
            $d.dialog('open');
        },
        destroy: function() {
            $d.dialog('destroy');
        }
    };
};

module.exports = AddSchema;
