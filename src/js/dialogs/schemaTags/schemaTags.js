'use strict';

var $ = require('jquery');

var AttributeWidget = require('../attributeWidget/attributeWidget.js');
    
function SchemaTags(writer, parentEl) {
    var w = writer;
    
    var ADD = 0;
    var EDIT = 1;
    var mode = null;
    
    var tagId = null;
    var currentTag = null;
    var currentTagName = null;
    var currentAction = null;
    
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
    
    
    var buildForm = function(tagName, tagPath) {
        var attributes = {};
        if (mode === EDIT) {
            attributes = w.tagger.getAttributesForTag(currentTag[0]);
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
            
            switch (mode) {
                case ADD:
                    if (w.editor.currentBookmark.tagId == null) {
                        w.editor.currentBookmark.tagId = tagId;
                    }
                    w.tagger.addStructureTag(currentTagName, attributes, w.editor.currentBookmark, currentAction);
                    tagId = null;
                    break;
                case EDIT:
                    w.tagger.editStructureTag(currentTag, attributes, currentTagName);
                    currentTag = null;
            }
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
        }
    };
    
    return {
        show: function(config) {
            var tagName = config.tagName;
            var tagPath = config.tagPath;
            
            w.editor.getBody().blur(); // lose keyboard focus in editor
            
            currentTagName = tagName;
            
            buildForm(tagName, tagPath);
            
            $schemaDialog.dialog('option', 'title', tagName);
            $schemaDialog.dialog('open');
            
            // TODO contradicting focuses
            $('button[role=ok]', $schemaDialog.parent()).focus();
            //$('input, select', $schemaDialog).first().focus();
        },
        destroy: function() {
            attributesWidget.destroy();
            $schemaDialog.dialog('destroy');
        },
        
        /**
         * Add a tag
         * @param {String} tagName 
         * @param {jQuery} parentTag 
         * @param {String} action 
         */
        addSchemaTag: function(tagName, parentTag, action) {
            mode = ADD;
            currentAction = action;

            var path = w.editor.writer.utilities.getElementXPath(parentTag[0]);
            path += '/'+tagName;
            
            this.show({tagName: tagName, tagPath: path});
        },
        
        /**
         * Edit a tag
         * @param {jQuery} $tag 
         */
        editSchemaTag: function($tag) {
            var tagName = $tag.attr('_tag');
            if (tagName === undefined) {
                console.warn('schemaTags: no tag name for',$tag);
                return;
            }
            if (tagName == w.schemaManager.getHeader()) {
                w.dialogManager.show('header');
                return;
            }

            mode = EDIT;
            currentTagName = tagName;
            currentTag = $tag;
            
            var path = w.utilities.getElementXPath($tag[0]);
            
            this.show({tagName: tagName, tagPath: path});
        },
        
        /**
         * Change the tag name for a tag
         * @param {jQuery} $tag 
         * @param {String} tagName 
         */
        changeSchemaTag: function($tag, tagName) {
            mode = EDIT;
            currentTagName = tagName;
            currentTag = $tag;

            var path = w.utilities.getElementXPath($tag.parent()[0]);
            path += '/'+tagName;
            
            this.show({tagName: tagName, tagPath: path});
        }
    };
};

module.exports = SchemaTags;
