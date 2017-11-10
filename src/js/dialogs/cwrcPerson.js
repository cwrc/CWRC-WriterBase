'use strict';

var $ = require('jquery');
var cwrcDialogBridge = require('./cwrcDialogBridge.js');

function CwrcPerson(writer) {

    var bridge = new cwrcDialogBridge(writer, {
        label: 'Person',
        localDialog: 'person',
        cwrcType: 'person'
    });

    return bridge;
};

module.exports = CwrcPerson;
