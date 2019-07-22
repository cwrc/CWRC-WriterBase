'use strict';

var $ = require('jquery');

// a bridge between the CWRC-Writer and the cwrcDialogs
function CwrcDialogBridge(writer, config) {
    var w = writer;
    var cD = writer.initialConfig.entityLookupDialogs;
    
    // w.utilities.addCSS('css/bootstrap/bootstrap-scoped.css');
    
    var cwrcType = config.cwrcType;
    var localDialog = config.localDialog;
    
    return {
        show: function(config) {
            if (config.entry) {
                // EDIT
                var query = config.entry.getContent().trim();
                var uri = config.entry.getURI();
                var name = config.entry.getLemma();
                cD.popSearch[cwrcType]({
                    query: query,
                    uri: uri,
                    name: name,
                    parentEl: w.dialogManager.getDialogWrapper(),
                    success: function(result) {
                        if ($.isArray(result.name)) {
                            result.name = result.name[0];
                        }
                        w.entitiesManager.setURIForEntity(config.entry.getId(), result.uri);
                        w.entitiesManager.setLemmaForEntity(config.entry.getId(), result.name);
                        
                        w.dialogManager.show('schema/'+localDialog, {
                            entry: config.entry
                        });
                    },
                    cancelled: function() {
                    },
                    error: function(errorThrown) {
                    }
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
                    }
                });
            }
        },
        destroy: function() {
            // TODO
        }
    };
};

module.exports = CwrcDialogBridge;
