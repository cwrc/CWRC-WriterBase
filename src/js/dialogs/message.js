import $ from 'jquery';
    
const Message = (writer, parentEl) => {
    
    let openDialogs = []; // track the open dialogs

    const createMessageDialog = (config) => {
        const $message = $(`
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
        
        const title = config.title;
        const modal = config.modal == null ? true : config.modal;
        const height = config.height || 300;
        const width = config.width || 300;
        $message.dialog({
            title,
            modal,
            height,
            width,
            resizable: true,
            closeOnEscape: true,
            position: { my: "center", at: "center", of: writer.layoutManager.getContainer() },
            autoOpen: false,
            close: (ev) => {
                openDialogs.splice(openDialogs.indexOf($message), 1);

                $message.dialog('destroy');
                $message.remove();
                if (config.dialogType === 'message' && config.callback) {
                    setTimeout(config.callback, 0);
                }
            }
        });
        
        const msg = config.msg;
        $message.find('p > span[class=message]').html(msg);
        
        const type = config.type;
        $message.find('p > span[class^=ui-state]').hide();
        if (type === 'info') $message.find('p > span[class=ui-state-highlight]').show();
        if (type === 'error') $message.find('p > span[class=ui-state-error]').show();
        
        openDialogs.push($message);

        return $message;
    }
    
    
    return {
        show: (config) => {
            config.dialogType = 'message';
            const $message = createMessageDialog(config);
            $message.dialog('option', 'buttons', [{
                text: 'Ok',
                role: 'ok',
                click: () => $message.dialog('close'),
            }]);
            $message.dialog('open');
        },
        confirm: (config) => {
            if (config.showConfirmKey) {
                const value = writer.dialogManager.getDialogPref(config.showConfirmKey);
                if (value === false) {
                    // user has disabled this confirm so just do the callback
                    if (config.callback) config.callback(true);
                    return;
                }
            }

            config.dialogType = 'confirm';
            const $message = createMessageDialog(config);
            
            if (config.showConfirmKey) $('#confirmCheckboxParent').show();
            
            const callback = config.callback;
            const yesText = config.yesText || 'Yes';
            const noText = config.noText || 'No';

            $message.dialog('option', 'buttons', [
                {
                    text: yesText,
                    role: 'yes',
                    click: () => {
                        if (config.showConfirmKey) {
                            const value = $('#showConfirmCheckbox').prop('checked');
                            writer.dialogManager.setDialogPref(config.showConfirmKey, value);
                        }
                        $message.dialog('close');
                        if (callback) setTimeout(() => callback(true), 0); // make sure dialog closes before callback
                    },
                },
                {
                    text: noText,
                    role: 'no',
                    click: () => {
                        if (config.showConfirmKey) {
                            const value = $('#showConfirmCheckbox').prop('checked');
                            writer.dialogManager.setDialogPref(config.showConfirmKey, value);
                        }
                        $message.dialog('close');
                        if (callback) setTimeout(() => callback(false), 0); // make sure dialog closes before callback
                    },
                },
            ]);
            $message.dialog('open');
        },
        destroy: () => {
            for (const d of openDialogs) {
                d.dialog('destroy');
                d.remove();
            }
            openDialogs = [];
        },
        getOpenDialogs: () => openDialogs,
    };
};

export default Message;
