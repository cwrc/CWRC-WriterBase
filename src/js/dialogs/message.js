'use strict';

var $ = require('jquery');
    
function Message(writer, parentEl) {
    var w = writer;
    
    var openDialogs = []; // track the open dialogs

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
                openDialogs.splice(openDialogs.indexOf($message), 1);

                $message.dialog('destroy');
                $message.remove();
                if (config.dialogType === 'message' && config.callback) {
                    setTimeout(config.callback, 0);
                }
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
        
        openDialogs.push($message);

        return $message;
    }
    
    
    return {
        show: function(config) {
            config.dialogType = 'message';
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
                    if (config.callback) config.callback(true);
                    return;
                }
            }

            config.dialogType = 'confirm';
            var $message = createMessageDialog(config);
            
            if (config.showConfirmKey) {
                $('#confirmCheckboxParent').show();
            }
            
            var callback = config.callback;
            var yesText = config.yesText || 'Yes';
            var noText = config.noText || 'No';
            $message.dialog('option', 'buttons', [
                {
                    text: yesText,
                    role: 'yes',
                    click: function() {
                        if (config.showConfirmKey) {
                            var value = $('#showConfirmCheckbox').prop('checked');
                            w.dialogManager.setDialogPref(config.showConfirmKey, value);
                        }
                        $message.dialog('close');
                        if (callback) setTimeout(() => callback(true), 0); // make sure dialog closes before callback
                    },
                },
                },{
                    text: noText,
                    role: 'no',
                    click: function() {
                        if (config.showConfirmKey) {
                            var value = $('#showConfirmCheckbox').prop('checked');
                            w.dialogManager.setDialogPref(config.showConfirmKey, value);
                        }
                        $message.dialog('close');
                        if (callback) setTimeout(() => callback(false), 0); // make sure dialog closes before callback
                    },
                },
            ]);
            $message.dialog('open');
        },
        destroy: function() {
            for (var d of openDialogs) {
                d.dialog('destroy');
                d.remove();
            }
            openDialogs = [];
        },
        getOpenDialogs: function() {
            return openDialogs;
        }
    };
};

module.exports = Message;
