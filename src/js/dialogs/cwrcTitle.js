'use strict';

var $ = require('jquery');

//var cD = require('cwrc-dialogs');
var cwrcDialogBridge = require('./cwrcDialogBridge.js');
    
function CwrcTitle(writer) {
    var w = writer;
    
    var bridge = new cwrcDialogBridge(w, {
        label: 'Title',
        localDialog: 'title',
        cwrcType: 'title'
    });
    
    return bridge;
};

module.exports = CwrcTitle;
