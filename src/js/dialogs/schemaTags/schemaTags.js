'use strict';

var $ = require('jquery');

var AttributeWidget = require('../attributeWidget/attributeWidget.js');
    
function SchemaTags(writer, parentEl) {
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
    
    var doShow = function(tagName, tagPath, tag) {
        w.editor.getBody().blur(); // lose keyboard focus in editor
        
        buildForm(tagName, tagPath, tag);
        
        $schemaDialog.dialog('option', 'title', tagName);
        $schemaDialog.dialog('open');
        
        // TODO contradicting focuses
        $('button[role=ok]', $schemaDialog.parent()).focus();
        //$('input, select', $schemaDialog).first().focus();
    };
    
    var buildForm = function(tagName, tagPath, tag) {
        var attributes = {};
        if (tag !== undefined) {
            attributes = w.tagger.getAttributesForTag(tag);
            attributesWidget.mode = AttributeWidget.EDIT;
        } else {
            attributesWidget.mode = AttributeWidget.ADD;
        }
        
        var atts = w.utilities.getChildrenForTag({tag: tagName, path: tagPath, type: 'attribute', returnType: 'array'});
        attributesWidget.buildWidget(atts, attributes, tagName);
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
        show: function() {
            // don't call this directly, use the add or edit methods below
        },
        destroy: function() {
            attributesWidget.destroy();
            $schemaDialog.dialog('destroy');
        },
        
        /**
         * Add a tag
         * @param {jQuery} parentTag
         * @param {String} tagName 
         * @param {Function} callback
         */
        addSchemaTag: function(parentTag, tagName, callback) {
            currentCallback = callback;

            var tagPath = w.editor.writer.utilities.getElementXPath(parentTag[0]);
            tagPath += '/'+tagName;
            
            doShow(tagName, tagPath);
        },
        
        /**
         * Edit a tag
         * @param {jQuery} $tag 
         * @param {String} tagName
         * @param {Function} callback
         */
        editSchemaTag: function($tag, tagName, callback) {
            currentCallback = callback;

            var tagPath = w.utilities.getElementXPath($tag.parent()[0]);
            tagPath += '/'+tagName;
            
            doShow(tagName, tagPath, $tag[0]);
        }
    };
};

module.exports = SchemaTags;
