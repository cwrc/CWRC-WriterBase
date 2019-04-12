'use strict';

var $ = require('jquery');

var AttributeWidget = require('../attributeWidget/attributeWidget.js');
    
function AttributesEditor(writer, parentEl) {
    var w = writer;
    
    var currentCallback = null;
    
    var $schemaDialog = $(''+
    '<div class="annotationDialog">'+
        '<div />'+
    '</div>').appendTo(parentEl)
    
    var dialogOpenTimestamp = null;
    
    $schemaDialog.dialog({
        modal: true,
        resizable: true,
        dialogClass: 'splitButtons',
        closeOnEscape: false,
        height: 460,
        width: 550,
        position: { my: "center", at: "center", of: w.layoutManager.getContainer() },
        minHeight: 400,
        minWidth: 510,
        autoOpen: false,
        open: function(event, ui) {
            dialogOpenTimestamp = event.timeStamp;
            $schemaDialog.parent().find('.ui-dialog-titlebar-close').hide();
        },
        beforeClose: function(event, ui) {
            if (event.timeStamp - dialogOpenTimestamp < 150) {
                // if the dialog was opened then closed immediately it was unintentional
                return false;
            }
        },
        buttons: [{
            text: 'Cancel',
            role: 'cancel',
            click: function() {
                cancel();
            }
        },{
            text: 'Ok',
            role: 'ok',
            click: function() {
                formResult();
            }
        }]
    });
    
    var attributesWidget = new AttributeWidget({
        writer: w,
        $parent: $schemaDialog,
        $el: $schemaDialog.children('div'),
        showSchemaHelp: true
    });
    
    var doShow = function(tagName, tagPath, attributes) {
        w.editor.getBody().blur(); // lose keyboard focus in editor
        
        if ($.isEmptyObject(attributes)) {
            attributesWidget.mode = AttributeWidget.ADD;
        } else {
            attributesWidget.mode = AttributeWidget.EDIT;
        }
        
        var atts = w.schemaManager.getAttributesForPath(tagPath);
        attributesWidget.buildWidget(atts, attributes, tagName);
        
        $schemaDialog.dialog('option', 'title', tagName);
        $schemaDialog.dialog('open');
        
        // TODO contradicting focuses
        $('button[role=ok]', $schemaDialog.parent()).focus();
        //$('input, select', $schemaDialog).first().focus();
    };
    
    var formResult = function() {
        // collect values then close dialog
        var attributes = attributesWidget.getData();
        if (attributes === undefined) {
            attributes = {}; // let form submit even if invalid (for now)
        }
        
        $schemaDialog.dialog('close');
        // check if beforeClose cancelled or not
        if ($schemaDialog.is(':hidden')) {
            try {
                $('ins', $schemaDialog).tooltip('destroy');
            } catch (e) {
                if (console) console.log('error destroying tooltip');
            }

            currentCallback.call(w, attributes);
            currentCallback = null;
        }
    };
    
    var cancel = function() {
        $schemaDialog.dialog('close');
        // check if beforeClose cancelled or not
        if ($schemaDialog.is(':hidden')) {
            w.editor.selection.moveToBookmark(w.editor.currentBookmark);
            //w.editor.currentBookmark = null;
            try {
                $('ins', $schemaDialog).tooltip('destroy');
            } catch (e) {
                if (console) console.log('error destroying tooltip');
            }

            currentCallback.call(w, null);
            currentCallback = null;
        }
    };
    
    return {
        /**
         * Show the attributes editor
         * @param {String} tagName The tag name
         * @param {String} tagPath The xpath for the tag
         * @param {Object} attributes Attributes previously added to tag (for use when editing)
         * @param {Function} callback Callback function. Called with attributes object, or null if cancelled.
         */
        show: function(tagName, tagPath, attributes, callback) {
            currentCallback = callback;
            doShow(tagName, tagPath, attributes);
        },
        destroy: function() {
            attributesWidget.destroy();
            $schemaDialog.dialog('destroy');
        }
    };
};

module.exports = AttributesEditor;
