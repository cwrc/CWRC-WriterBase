'use strict';

var $ = require('jquery');

var AttributeWidget = require('./attributeWidget.js');
    
function SchemaTags(writer) {
    var w = writer;
    
    var ADD = 0;
    var EDIT = 1;
    var mode = null;
    
    var tagId = null;
    var tag = null;
    var currentTagName = null;
    var action = null;
    
    var $schemaDialog = $(''+
    '<div class="schemaDialog">'+
    '</div>').appendTo(document.body);
    
    var dialogOpenTimestamp = null;
    
    $schemaDialog.dialog({
        modal: true,
        resizable: true,
        dialogClass: 'splitButtons',
        closeOnEscape: false,
        height: 460,
        width: 550,
        position: { my: "center", at: "center", of: w.layoutManager.getWrapper() },
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
        $el: $schemaDialog,
        showSchemaHelp: true
    });
    
    
    var buildForm = function(tagName, tagPath) {
        var structsEntry = {};
        if (mode === EDIT) {
            structsEntry = w.structs[$(tag).attr('id')];
            attributesWidget.mode = AttributeWidget.EDIT;
        } else {
            attributesWidget.mode = AttributeWidget.ADD;
        }
        
        var atts = w.utilities.getChildrenForTag({tag: tagName, path: tagPath, type: 'attribute', returnType: 'array'});
        attributesWidget.buildWidget(atts, structsEntry, tagName);
    };
    
    var formResult = function() {
        // collect values then close dialog
        var attributes = attributesWidget.getData();
        if (attributes === undefined) {
            attributes = {}; // let form submit even if invalid (for now)
        }
        
        attributes._tag = currentTagName;
        
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
                    w.editor.execCommand('addStructureTag', {bookmark: w.editor.currentBookmark, attributes: attributes, action: action});
                    tagId = null;
                    break;
                case EDIT:
                    w.editor.execCommand('editStructureTag', tag, attributes);
                    tag = null;
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
        
        addSchemaTag: function(params) {
            var key = params.key;
            var parentTag = params.parentTag;
            action = params.action;
            
            if (key === w.header) {
                w.dialogManager.show('header');
                return;
            } else {
                var type = w.schemaManager.mapper.getEntityTypeForTag(key);
                if (type != null) {
                    w.tagger.addEntity(type, key);
                    return;
                }
            }
            tagId = w.editor.currentBookmark.tagId;
            if (tagId == null) {
                if (window.console) console.warn('No tagId found');
            }
            w.editor.selection.moveToBookmark(w.editor.currentBookmark);
            
            var valid = w.utilities.isSelectionValid(true, action);
            if (valid !== w.VALID) {
                w.dialogManager.show('message', {
                    title: 'Error',
                    msg: 'Please ensure that the beginning and end of your selection have a common parent.<br/>For example, your selection cannot begin in one paragraph and end in another, or begin in bolded text and end outside of that text.',
                    type: 'error'
                });
                return;
            }
            
            // reset bookmark after possible modification by isSelectionValid
            w.editor.currentBookmark = w.editor.selection.getBookmark(1);
            if (tagId != null) {
                w.editor.currentBookmark.tagId = tagId;
            }
            
            if (parentTag === undefined || parentTag.length === 0) {
                var selectionParent = w.editor.currentBookmark.rng.commonAncestorContainer;
                if (selectionParent.nodeType === Node.TEXT_NODE) {
                    parentTag = $(selectionParent).parent();
                } else {
                    parentTag = $(selectionParent);
                }
            }
            
            var path = w.editor.writer.utilities.getElementXPath(parentTag[0]);
            path += '/'+key;
            
            mode = ADD;
            this.show({tagName: key, tagPath: path});
        },
        
        editSchemaTag: function($tag) {
            var tagName = $tag.attr('_tag');
            if (tagName == w.header) {
                w.dialogManager.show('header');
                return;
            }
            
            var path = w.utilities.getElementXPath($tag[0]);
            
            currentTagName = tagName;
            tag = $tag;
            mode = EDIT;
            this.show({tagName: tagName, tagPath: path});
        },
        
        changeSchemaTag: function(params) {
            currentTagName = params.key;
            tag = params.tag;
            
            if (tag === undefined || tag.length === 0) {
                var selectionParent = w.editor.currentBookmark.rng.commonAncestorContainer;
                if (selectionParent.nodeType === Node.TEXT_NODE) {
                    tag = $(selectionParent).parent();
                } else {
                    tag = $(selectionParent);
                }
            }
            
            var path = w.utilities.getElementXPath(tag[0]);
            mode = EDIT;
            this.show({tagName: params.key, tagPath: path});
        }
    };
};

module.exports = SchemaTags;
