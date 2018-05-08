'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/dialog');
    
function EditSource(writer, parentEl) {
    var w = writer;
    
    var $edit = $(''+
    '<div>'+
        '<textarea style="height: 98%; width: 98%; font-family: monospace;" spellcheck="false"></textarea>'+
    '</div>').appendTo(parentEl);
    
    $edit.dialog({
        title: 'Edit Source',
        modal: true,
        resizable: true,
        closeOnEscape: true,
        height: 480,
        width: 640,
        autoOpen: false,
        buttons: {
            'Ok': function() {
                var newDocString = $('textarea', $edit).val();
                $edit.dialog('close');
                w.loadDocumentXML(newDocString);
            },
            'Cancel': function() {
                $edit.dialog('close');
            }
        },
        open: function(e) {
            var $text = $(this).find('textarea');
            $text.focus();
            $text[0].setSelectionRange(0, 0);
            $text.scrollTop(0);
        }
    });
    
    var doOpen = function() {
        w.dialogManager.confirm({
            title: 'Edit Source',
            msg: 'Editing the source directly is only recommended for advanced users who know what they\'re doing.<br/><br/>Are you sure you wish to continue?',
            callback: function(yes) {
                if (yes) {
                    var docText = w.converter.getDocumentContent(true);
                    $('textarea', $edit).val(docText);
                    $edit.dialog('open');
                }
            }
        });
    };
    
    return {
        show: function(config) {
            doOpen();
        },
        destroy: function() {
            $edit.dialog('destroy');
        }
    };
}

module.exports = EditSource;