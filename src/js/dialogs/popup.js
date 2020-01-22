'use strict';

var $ = require('jquery');
require('jquery-popup');
    
function Popup(writer, parentEl) {
    var w = writer;
    
    var attributeSelector = '';
    var linkSelector = '';
    var noteMouseoverSelector = '.noteWrapper.hide';
    var noteClickSelector = '.noteWrapper'; // need a different selector because tagger.addNoteWrapper click event fires before this one (and removes hide class)
    
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
        },
        position: {
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
                
                var x = w.utilities.constrain(topLeft.left, $docBody.width(), $popupEl.outerWidth());
                var y = w.utilities.constrain(topLeft.top, $docBody.height(), $popupEl.outerHeight());

                $popupEl.css({
                    left: x+'px',
                    top: y+'px'
                });
            }
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
    
    var doMouseOver = function() {
        clearTimeout(popupCloseId);
    }
    
    var doMouseOut = function() {
        popupCloseId = setTimeout(hidePopup, 500);
    }
    
    var doClick = function() {
        var url = $popupEl.text();
        window.open(url);
    }
    
    /**
     * Show the content in the popup element
     * @param {String|Element} content The content to show
     * @param {String} type The entity type
     */
    var doPopup = function(content, type) {
        $popupEl.parent().off('mouseover', doMouseOver);
        $popupEl.parent().off('mouseout', doMouseOut);
        $popupEl.off('click', doClick);
        
        $popupEl.popup('option', 'dialogClass', 'popup '+type);
        
        $popupEl.html(content);
        
        $popupEl.popup('open');
        
        var width;
        if (type === 'note') {
            width = 350;
        } else {
            $popupEl.popup('option', 'width', 'auto');
            var textWidth = $popupEl.width();
            if (type === 'link') {
                width = textWidth+30;
            } else {
                width = Math.min(200, textWidth)+30;
            }
        }
        $popupEl.popup('option', 'width', width);
        
        clearTimeout(popupCloseId);
        $currentTag.one('mouseout', function() {
            popupCloseId = setTimeout(hidePopup, 1000);
        });
        
        $popupEl.parent().on('mouseover', doMouseOver);
        $popupEl.parent().on('mouseout', doMouseOut);
    }

    var attributeMouseover = function(e) {
        var popupId = this.getAttribute('id') || this.getAttribute('name');
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
    }
    
    var linkMouseover = function(e) {
        var entityId = this.getAttribute('id') || this.getAttribute('name');
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

        showLink(url);
    }

    var showLink = function(url) {
        if (url) {
            if (url.indexOf('http') === 0) {
                doPopup(url, 'link');
                $popupEl.on('click', doClick);
            } else {
                doPopup(url, 'tag');
            }
        }
    }

    var noteMouseover = function(e) {
        $currentTag = $(this);
        var entity = $(this).children('[_entity]');
        var entityId = entity.attr('id');
        
        var entry = w.entitiesManager.getEntity(entityId);
        var content = entry.getNoteContent();
        if (content === undefined) {
            content = entry.getContent();
        }
        if (content === undefined || content.match(/^\s*$/) !== null) {
            if (entry.getType() === 'citation') {
                showLink(entry.getURI());
            }
            return;
        }
        doPopup(content, 'note');
    }

    var noteClick = function(e) {
        // we're showing the note contents so hide the popup
        hidePopup();
    }

    var hidePopup = function() {
        $popupEl.popup('close');
    }
    
    var removeListeners = function() {
        var body = $(w.editor.getBody());
        body.off('mouseover', attributeSelector, attributeMouseover);
        body.off('mouseover', linkSelector, linkMouseover);
        body.off('mouseover', noteMouseoverSelector, noteMouseover);
        body.off('click', noteClickSelector, noteClick);
        body.off('contextmenu', hidePopup);
    }

    var setupListeners = function() {
        removeListeners();

        var body = $(w.editor.getBody());

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

        body.on('mouseover', noteMouseoverSelector, noteMouseover);
        body.on('click', noteClickSelector, noteClick);

        body.on('contextmenu', hidePopup);
    }
    
    w.event('schemaLoaded').subscribe(setupListeners);
    
    return {
        show: function(config) {
            console.warn('dialogManager.popup: shouldn\'t call show directly');
        },
        destroy: function() {
            removeListeners();
        }
    }
}

module.exports = Popup;
