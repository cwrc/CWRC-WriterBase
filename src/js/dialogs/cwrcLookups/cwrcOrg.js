'use strict';

var $ = require('jquery');
var cwrcDialogBridge = require('./cwrcDialogBridge.js');

function CwrcOrg(writer) {
    
    var bridge = new cwrcDialogBridge(writer, {
        label: 'Organization',
        localDialog: 'org',
        cwrcType: 'organization'
    });
    
    return bridge;
};

module.exports = CwrcOrg;
