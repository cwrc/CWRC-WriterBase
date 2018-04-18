'use strict';

var $ = require('jquery');

    
function CopyPaste(writer, parentEl) {
    var w = writer;
    
    var firstCopy = true;
    var firstPaste = true;
    
    var cwrcCopy = false;
    
    var copyMsg = 'It looks like you\'re trying to copy content.<br/>Consider having a look at the <a href="https://cwrc.ca/CWRC-Writer_Documentation/#CWRCWriter_Copy_Splash.html" target="_blank">Copy & Paste Documentation</a>';
    var pasteMsg = 'It looks like you\'re trying to paste from outside CWRC-Writer. Be aware that <b>all tags will be removed</b> and only plain text will remain.<br/>Consider having a look at the <a href="https://cwrc.ca/CWRC-Writer_Documentation/#CWRCWriter_Copy_Splash.html" target="_blank">Copy & Paste Documentation</a>';
    
    var $copyPasteDialog = $(''+
    '<div>'+
        '<div class="content"></div>'+
    '</div>').appendTo(parentEl)
    
    $copyPasteDialog.dialog({
        title: 'Copy & Paste Help',
        modal: true,
        resizable: true,
        closeOnEscape: true,
        height: 250,
        width: 350,
        position: { my: "center", at: "center", of: w.layoutManager.getContainer() },
        autoOpen: false,
        dialogClass: 'splitButtons',
        buttons: [{
            text: 'Ok',
            click: function() {
                $copyPasteDialog.dialog('close');
            }
        }]
    });
    
    w.event('contentCopied').subscribe(function() {
        cwrcCopy = true;
        if (firstCopy) {
            firstCopy = false;
            cp.show({
                type: 'copy'
            });
        }
    });
    
    w.event('contentPasted').subscribe(function() {
        if (firstPaste && !cwrcCopy) {
            firstPaste = false;
            cp.show({
                type: 'paste'
            });
        }
        cwrcCopy = false;
    });
    
    var cp = {
        show: function(config) {
            var type = config.type;
            var modal = config.modal === undefined ? false : config.modal;
            
            $copyPasteDialog.dialog('option', 'modal', modal);
            
            var msg;
            if (type == 'copy') {
                msg = copyMsg;
            } else if (type == 'paste') {
                msg = pasteMsg;
            }
            $copyPasteDialog.find('.content').html(msg);
            
            $copyPasteDialog.dialog('open');
        },
        destroy: function() {
            $copyPasteDialog.dialog('destroy');
        }
    };
    
    return cp;
};

module.exports = CopyPaste;
