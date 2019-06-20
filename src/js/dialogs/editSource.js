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
        buttons: [{
            text: 'Ok',
            role: 'ok',
            click: function() {
                var newDocString = $('textarea', $edit).val();
                $edit.dialog('close');
                setTimeout(function() {
                    w.loadDocumentXML(newDocString, false);
                }, 0);
            },
        },{
            text: 'Cancel',
            role: 'cancel',
            click: function() {
                $edit.dialog('close');
            }
        }],
        open: function(e) {
            console.time('set focus');
            var $text = $(this).find('textarea');
            $text.focus();
            $text[0].setSelectionRange(0, 0);
            $text.scrollTop(0);
            console.timeEnd('set focus');
        },
        close: function(e) {
            $('textarea', $edit).val('');
        }
    });
    
    var doOpen = function() {
        w.dialogManager.confirm({
            title: 'Edit Raw XML',
            msg: 'Editing the XML directly is only recommended for advanced users who know what they\'re doing.<br/><br/>Are you sure you wish to continue?',
            showConfirmKey: 'confirm-edit-source',
            type: 'info',
            callback: function(yes) {
                if (yes) {
                    var docText = w.converter.getDocumentContent(true);
                    console.time('dialog open');
                    $edit.dialog('open');
                    console.timeEnd('dialog open');
                    console.time('set doc text');
                    $('textarea', $edit).val(docText);
                    console.timeEnd('set doc text');
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