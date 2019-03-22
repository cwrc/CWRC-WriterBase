'use strict';

var $ = require('jquery');

    
function Message(writer, parentEl) {
    var w = writer;
    
    function createMessageDialog(config) {
        
        var $message = $(''+
        '<div>'+
            '<p>'+
            '<span class="ui-state-highlight" style="border: none;"><span style="float: left; margin-right: 4px;" class="ui-icon ui-icon-info"></span></span>'+
            '<span class="ui-state-error" style="border: none;"><span style="float: left; margin-right: 4px;" class="ui-icon ui-icon-alert"></span></span>'+
            '<span class="message"></span>'+
            '</p>'+
        '</div>').appendTo(parentEl)
        
        var title = config.title;
        var modal = config.modal == null ? true : config.modal;
        $message.dialog({
            title: title,
            modal: modal,
            resizable: true,
            closeOnEscape: true,
            height: 300,
            width: 300,
            position: { my: "center", at: "center", of: w.layoutManager.getContainer() },
            autoOpen: false,
            close: function(ev) {
                $message.dialog('destroy');
                $message.remove();
            }
        });
        
        var msg = config.msg;
        $message.find('p > span[class=message]').html(msg);
        
        var type = config.type;
        $message.find('p > span[class^=ui-state]').hide();
        if (type == 'info') {
            $message.find('p > span[class=ui-state-highlight]').show();
        } else if (type == 'error') {
            $message.find('p > span[class=ui-state-error]').show();
        }
        
        return $message;
    }
    
    
    return {
        show: function(config) {
            var $message = createMessageDialog(config);
            $message.dialog('option', 'buttons', {
                'Ok': function() {
                    $message.dialog('close');
                }
            });
            $message.dialog('open');
        },
        confirm: function(config) {
            var $message = createMessageDialog(config);
            var callback = config.callback;
            $message.dialog('option', 'buttons', {
                'Yes': function() {
                    $message.dialog('close');
                    // make sure dialog closes before callback
                    setTimeout(function() {
                        callback(true);
                    }, 0);
                },
                'No': function() {
                    $message.dialog('close');
                    // make sure dialog closes before callback
                    setTimeout(function() {
                        callback(false);
                    }, 0);
                }
            });
            $message.dialog('open');
        },
        destroy: function() {
            // TODO
            //$message.dialog('destroy');
        }
    };
};

module.exports = Message;
