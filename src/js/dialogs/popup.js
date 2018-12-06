'use strict';

var $ = require('jquery');
require('jquery-popup');
    
function Popup(writer, parentEl) {
    var w = writer;
    
    var attributeSelector = '';
    var elementSelector = '';
    var linkSelector = '';
    
    var popupId = w.getUniqueId('popupDialog');
    var $popupEl = $('<div id="'+popupId+'"></div>').appendTo(parentEl)
    $popupEl.popup({
        autoOpen: false,
        resizable: false,
        draggable: false,
        minHeight: 30,
        minWidth: 40,
        open: function(event, ui) {
            $popupEl.parent().find('.ui-dialog-titlebar-close').hide();
        }
    });
    var popupCloseId;
    
    var $currentTag;
    var setCurrentTag = function(id) {
        $currentTag = $('#'+id, w.editor.getBody());
        if ($currentTag.length == 0) {
            $currentTag = $('[name="'+id+'"]', w.editor.getBody()).first();    
        }
    }
    
    var doPosition = function() {
        $popupEl.popup('option', 'position', {
            my: 'center', at: 'center', of: $currentTag,
            using: function(topLeft, posObj) {
                var $popupEl = posObj.element.element;
                var $editorBody = $(w.editor.getDoc().documentElement);
                var $docBody = $(document.documentElement);
                
                var tagOffset = $currentTag.offset();
                var frameOffset = $(w.editor.iframeElement).offset();
                var editorScrollTop = $editorBody.scrollTop();
                var editorScrollLeft = $editorBody.scrollLeft();
                var docScrollTop = $docBody.scrollTop();
                var docScrollLeft = $docBody.scrollLeft();
                
                topLeft.top = frameOffset.top + tagOffset.top + $currentTag.height() - editorScrollTop - docScrollTop;
                topLeft.left = frameOffset.left + tagOffset.left - editorScrollLeft - docScrollLeft;
                
                $popupEl.css({
                   top: topLeft.top+'px',
                   left: topLeft.left+'px'
                });
            }
        });
    }
    
    var doMouseOver = function() {
        clearTimeout(popupCloseId);
    }
    
    var doMouseOut = function() {
        popupCloseId = setTimeout(function() {
            $popupEl.popup('close');
        }, 500);
    }
    
    var doClick = function() {
        var url = $popupEl.popup('option', 'title');
        window.open(url);
    }
    
    var doPopup = function(text, type) {
        $popupEl.parent().off('mouseover', doMouseOver);
        $popupEl.parent().off('mouseout', doMouseOut);
        $popupEl.parent().find('.ui-dialog-title').off('click', doClick);
        
        $popupEl.popup('option', 'dialogClass', 'popup '+type);
        
        if (typeof text === 'string') {
            $popupEl.popup('option', 'title', text);
            $popupEl.html('');
        } else {
            // note
            $popupEl.parent().find('.ui-dialog-title').html('');
            $popupEl.html(text);
        }
        
        $popupEl.popup('open');
        
        var width;
        if (type === 'note') {
            width = 350;
        } else {
            var $titleEl = $popupEl.parent().find('.ui-dialog-title');
            $titleEl.css('white-space', 'nowrap') // change whitespace handling to accurately get width
            
            var textWidth = $popupEl.parent().find('.ui-dialog-title').width();
            if (type === 'link') {
                width = textWidth+30;
            } else {
                width = Math.min(200, textWidth)+30;
            }
            
            $titleEl.css('white-space', 'normal');
        }
        $popupEl.popup('option', 'width', width);
        
        doPosition();
        
        clearTimeout(popupCloseId);
        $currentTag.one('mouseout', function() {
            popupCloseId = setTimeout(function() {
                $popupEl.popup('close');
            }, 1000);
        });
        
        $popupEl.parent().on('mouseover', doMouseOver);
        $popupEl.parent().on('mouseout', doMouseOut);
    }
    
    var attributePopup = function(popupId) {
        setCurrentTag(popupId);
        
        var popText = null;
        var popKeys = w.schemaManager.mapper.getPopupAttributes();
        for (var i = 0; i < popKeys.length; i++) {
            var popAtt = $currentTag.attr(popKeys[i]);
            if (popAtt !== undefined) {
                popText = popAtt;
                break;
            }
        }
        
        if (popText != null) {
            doPopup(popText, 'tag');
        }
    };
    
    var elementPopup = function(popupId) {
        setCurrentTag(popupId);
        
        var popKeys = w.schemaManager.mapper.getPopupElements();
        var tag = $currentTag.attr('_tag');
        if (popKeys.indexOf(tag) !== -1) {
            var entType = w.schemaManager.mapper.getEntityTypeForTag(tag);
            if (entType !== null && w.schemaManager.mapper.isEntityTypeNote(entType)) {
                // note popup
                var entity = w.entitiesManager.getEntity(popupId);
                if (entity !== undefined) {
                    var node = w.utilities.stringToXML(entity.getNoteContent());
                    var popText = w.converter.buildEditorString(node.firstElementChild);
                    doPopup(w.utilities.stringToXML(popText).firstElementChild, 'note');
                }
            } else {
                var popText = $currentTag[0].textContent;
                if (popText != '') {
                    doPopup(popText, 'tag');
                }
            }
        }
    };
    
    var linkPopup = function(entityId) {
        setCurrentTag(entityId);
        
        var url = null;
        var urlKeys = w.schemaManager.mapper.getUrlAttributes();
        for (var i = 0; i < urlKeys.length; i++) {
            var urlAtt = $currentTag.attr(urlKeys[i]);
            if (urlAtt !== undefined) {
                url = urlAtt;
                break;
            }
        }
        
        if (url !== null && url.indexOf('http') === 0) {
            doPopup(url, 'link');
            $popupEl.parent().find('.ui-dialog-title').on('click', doClick);
        }
    };
    
    var attributeMouseover = function(e) {
        var id = this.getAttribute('id') || this.getAttribute('name');
        attributePopup(id);
    }
    
    var elementMouseover = function(e) {
        var id = this.getAttribute('id') || this.getAttribute('name');
        elementPopup(id);
    }
    
    var linkMouseover = function(e) {
        var id = this.getAttribute('id') || this.getAttribute('name');
        linkPopup(id);
    }
    
    var setupListeners = function() {
        var body = $(w.editor.getBody());
        body.off('mouseover', attributeSelector, attributeMouseover);
        body.off('mouseover', elementSelector, elementMouseover);
        body.off('mouseover', linkSelector, linkMouseover);
        
        var attKeys = w.schemaManager.mapper.getPopupAttributes();
        attributeSelector = '';
        $.map(attKeys, function(val, i) {
            attributeSelector += '['+val+']';
            if (i < attKeys.length-1) attributeSelector += ',';
        });
        if (attributeSelector != '') {
            body.on('mouseover', attributeSelector, attributeMouseover);
        }
        
        var urlKeys = w.schemaManager.mapper.getUrlAttributes();
        linkSelector = '';
        $.map(urlKeys, function(val, i) {
            linkSelector += '['+val+']';
            if (i < urlKeys.length-1) linkSelector += ',';
        });
        if (linkSelector != '') {
            body.on('mouseover', linkSelector, linkMouseover);
        }

        var elKeys = w.schemaManager.mapper.getPopupElements();
        elementSelector = '';
        $.map(elKeys, function(val, i) {
            elementSelector += '[_tag="'+val+'"]';
            if (i < elKeys.length-1) elementSelector += ',';
        });
        if (elementSelector != '') {
            body.on('mouseover', elementSelector, elementMouseover);
        }
    }
    
    w.event('schemaLoaded').subscribe(setupListeners);
    
    return {
        show: function(config) {
            var type = config.type;
            if (type === 'link') {
                linkPopup(config.id);
            } else {
                attributePopup(config.id);
            }
        },
        destroy: function() {
            // TODO
        }
    }
}

module.exports = Popup;
