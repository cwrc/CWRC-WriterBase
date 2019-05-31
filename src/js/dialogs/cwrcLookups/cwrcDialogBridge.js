'use strict';

var $ = require('jquery');

// a bridge between the CWRC-Writer and the cwrcDialogs
function CwrcDialogBridge(writer, config) {
    var w = writer;
    var cD = writer.initialConfig.entityLookupDialogs;
    
    // w.utilities.addCSS('css/bootstrap/bootstrap-scoped.css');
    
    var label = config.label;
    var cwrcType = config.cwrcType;
    var localDialog = config.localDialog;
    
    var createEditOpts = {
        success: function(result) {
            if (result.data == null) {
                var error = result.error || 'There was an error creating the entry.';
                w.dialogManager.show('message', {
                    title: 'Error',
                    msg: error,
                    type: 'error'
                });
            } else {
                if (result.response !== undefined && result.response.pid !== undefined) {
                    w.dialogManager.show('schema/'+localDialog, {
                        properties: {
                            uri: result.response.uri
                        }
                    });
                } else {
                    var error = 'Error creating entity';
                    if (result.response.message  !== undefined) {
                        error += ': '+result.response.message ;
                    }
                    w.dialogManager.show('message', {
                        title: 'Error ', msg: error, modal: true, type: 'error'
                    });
                }
            }
        },
        error: function(errorThrown) {
        }
    };
    
    function doEdit(data) {
        cD.popEdit[cwrcType]($.extend({}, createEditOpts, data));
    }
    
    function doCreate() {
        cD.popCreate[cwrcType](createEditOpts);
    }
    
    return {
        show: function(config) {
            if (config.entry) {
                // EDIT
                var query = config.entry.getContent().trim();
                cD.popSearch[cwrcType]({
                    query: query,
                    parentEl: w.dialogManager.getDialogWrapper(),
                    success: function(result) {
                        if ($.isArray(result.name)) {
                            result.name = result.name[0];
                        }
                        
                        config.entry.setURI(result.uri);
                        config.entry.setLemma(result.name);
                        
                        w.dialogManager.show('schema/'+localDialog, {
                            entry: config.entry
                        });
                    },
                    cancelled: function() {
                    },
                    error: function(errorThrown) {
                    },
                    buttons: [{
                        label : 'Edit '+label,
                        isEdit : true,
                        action : doEdit
                    },{
                        label : 'Skip '+label+' Lookup',
                        isEdit : false,
                        action : function() {
                            w.dialogManager.show('schema/'+localDialog, {
                                entry: config.entry
                            });
                        }
                    }]
                });
            } else {
                // ADD
                var query = w.editor.currentBookmark.rng.toString();
                query = query.trim().replace(/\s+/g, ' '); // remove excess whitespace
                
                cD.popSearch[cwrcType]({
                    query: query,
                    parentEl: w.dialogManager.getDialogWrapper(),
                    success: function(result) {
                        if ($.isArray(result.name)) {
                            result.name = result.name[0];
                        }
                        
                        w.dialogManager.show('schema/'+localDialog, {
                            query: query,
                            properties: {
                                uri: result.uri,
                                lemma: result.name
                            }
                        });
                    },
                    error: function(errorThrown) {
                    },
                    buttons: [{
                        label : 'Create New '+label,
                        isEdit : false,
                        action : doCreate
                    },{
                        label : 'Edit '+label,
                        isEdit : true,
                        action : doEdit
                    }]
                });
            }
        },
        destroy: function() {
            // TODO
        }
    };
};

module.exports = CwrcDialogBridge;
