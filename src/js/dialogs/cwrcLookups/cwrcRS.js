'use strict';

var $ = require('jquery');
let cwrcDialogBridge = require('./cwrcDialogBridge.js');

function CwrcRS(writer) {
    
    var bridge = new cwrcDialogBridge(writer, {
        label: 'RS',
        localDialog: 'rs',
        cwrcType: 'rs'
    });
    
    return bridge;
};

module.exports = CwrcRS;
