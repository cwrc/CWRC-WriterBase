'use strict';

var $ = require('jquery');

    
function Message(writer, parentEl) {
    var w = writer;
    
    function createMessageDialog(config) {
        
        var $message = $(`
        <div>
            <p>
            <span class="ui-state-highlight" style="border: none;"><span style="float: left; margin-right: 4px;" class="ui-icon ui-icon-info"></span></span>
            <span class="ui-state-error" style="border: none;"><span style="float: left; margin-right: 4px;" class="ui-icon ui-icon-alert"></span></span>
            <span class="message"></span>
            </p>
            <span id="confirmCheckboxParent" style="display: none;">
                <input type="checkbox" id="showConfirmCheckbox" checked/>
                <label for="showConfirmCheckbox">Show this warning next time</label>
            </span>
        </div>
        `).appendTo(parentEl)
        
        var title = config.title;
        var modal = config.modal == null ? true : config.modal;
        var height = config.height ? config.height : 300;
        var width = config.width ? config.width : 300;
        $message.dialog({
            title: title,
            modal: modal,
            resizable: true,
            closeOnEscape: true,
            height: height,
            width: width,
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
            $message.dialog('option', 'buttons', [{
                text: 'Ok',
                role: 'ok',
                click: function() {
                    $message.dialog('close');
                }
            }]);
            $message.dialog('open');
        },
        confirm: function(config) {
            if (config.showConfirmKey) {
                var value = w.dialogManager.getDialogPref(config.showConfirmKey);
                if (value === false) {
                    // user has disabled this confirm so just do the callback
                    config.callback(true);
                    return;
                }
            }

            var $message = createMessageDialog(config);
            
            if (config.showConfirmKey) {
                $('#confirmCheckboxParent').show();
            }
            
            var callback = config.callback;
            $message.dialog('option', 'buttons', [
                {
                    text: 'Yes',
                    role: 'yes',
                    click: function() {
                        if (config.showConfirmKey) {
                            var value = $('#showConfirmCheckbox').prop('checked');
                            w.dialogManager.setDialogPref(config.showConfirmKey, value);
                        }
                        $message.dialog('close');
                        // make sure dialog closes before callback
                        setTimeout(function() {
                            callback(true);
                        }, 0);
                    },
                },{
                    text: 'No',
                    role: 'no',
                    click: function() {
                        if (config.showConfirmKey) {
                            var value = $('#showConfirmCheckbox').prop('checked');
                            w.dialogManager.setDialogPref(config.showConfirmKey, value);
                        }
                        $message.dialog('close');
                        // make sure dialog closes before callback
                        setTimeout(function() {
                            callback(false);
                        }, 0);
                    }
                }
            ]);
            $message.dialog('open');
        },
        destroy: function() {
            // TODO
            //$message.dialog('destroy');
        }
    };
};

module.exports = Message;
