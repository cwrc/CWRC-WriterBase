'use strict';

var $ = require('jquery');
let cwrcDialogBridge = require('./cwrcDialogBridge.js');

function CwrcPlace(writer) {
    
    var bridge = new cwrcDialogBridge(writer, {
        label: 'Place',
        localDialog: 'place',
        cwrcType: 'place'
    });
    
    return bridge;
};

module.exports = CwrcPlace;
