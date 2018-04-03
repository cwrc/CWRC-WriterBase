'use strict';

var $ = require('jquery');

    
function Header(writer, parentEl) {
    var w = writer;
    
    var $headerLink = $('<div class="editHeader">Edit Header</div>').appendTo(w.layoutManager.getHeaderButtonsParent());
    
    var $headerDialog = $(''+
    '<div class="headerDialog">'+
    '<div><textarea></textarea></div>'+
    '</div>').appendTo(parentEl)
    
    $headerDialog.dialog({
        title: 'Edit Header',
        modal: true,
        resizable: true,
        height: 380,
        width: 400,
        position: { my: "center", at: "center", of: w.layoutManager.getWrapper() },
        autoOpen: false,
        buttons: {
            'Ok': function() {
                var editorString = '<head>'+$headerDialog.find('textarea').val()+'</head>';
                var xml;
                try {
                    xml = $.parseXML(editorString);
                } catch(e) {
                    w.dialogManager.show('message', {
                        title: 'Invalid XML',
                        msg: 'There was an error parsing the XML.',
                        type: 'error'
                    });
                    return false;
                }
                
                var headerString = '';
                $(xml).find('head').children().each(function(index, el) {
                    headerString += w.converter.buildEditorString(el);
                });
                $('[_tag="'+w.header+'"]', w.editor.getBody()).html(headerString);
                
                $headerDialog.dialog('close');
            },
            'Cancel': function() {
                $headerDialog.dialog('close');
            }
        }
    });
    
    function doOpen() {
        var headerString = '';
        var headerEl = $('[_tag="'+w.header+'"]', w.editor.getBody());
        headerEl.children().each(function(index, el) {
            headerString += w.converter.buildXMLString($(el));
        });
        $headerDialog.find('textarea').val(headerString);
        $headerDialog.dialog('open');
    }
    
    $headerLink.click(function() {
        doOpen();
    });
    
    return {
        show: function(config) {
            doOpen();
        },
        destroy: function() {
            $headerDialog.dialog('destroy');
        }
    };
};

module.exports = Header;
