'use strict'

// https://stackoverflow.com/questions/9856269/protect-div-element-from-being-deleted-within-tinymce

var tinymce = require('tinymce')

function contains(array, item) {
    return array.indexOf(item) > -1
}

//Returns whether val is within the range specified by min/max
function r(val, min, max) {
    return val >= min && val <= max
}

function keyWillDelete(evt) {
    var c = evt.keyCode

    //ctrl+x or ctrl+back/del will all delete, but otherwise it probably won't
    if (evt.ctrlKey) return evt.key == 'x' || contains([8, 46], c)

    return contains([8, 9, 13, 46], c) || r(c, 48, 57) || r(c, 65, 90) || r(c, 96, 111) || r(c, 186, 192) || r(c, 219, 222)
}

function cancelKey(evt) {
    evt.preventDefault()
    evt.stopPropagation()
    return false
}

function isElementInline(el) {
    if (el.nodeType === Node.TEXT_NODE) {
        return true;
    } else {
        return el.nodeName.toLowerCase() === 'span';
    }
}

function deleteConfirm(editor, element) {
    editor.writer.dialogManager.confirm({
        title: 'Warning',
        msg: `<p>Delete "${element.getAttribute('_tag')}" element?</p>`,
        showConfirmKey: 'confirm-delete-tag',
        type: 'info',
        callback: function(doIt) {
            if (doIt) {
                editor.writer.tagger.removeStructureTag(element.getAttribute('id'), false);
            }
        }
    })
}

tinymce.PluginManager.add('preventdelete', function(ed) {
    ed.on('keydown', function(evt) {
        if (keyWillDelete(evt)) {
            var range = ed.selection.getRng()

            // deleting individual characters
            if (range.collapsed && range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
                // backspace
                if (evt.keyCode === 8) {
                    // start of element
                    if (range.startOffset === 0) {
                        deleteConfirm(ed, range.commonAncestorContainer.parentElement);
                        return cancelKey(evt)
                    }
                    
                    if (range.startOffset === 1 && range.commonAncestorContainer.textContent.length === 1) {
                        if (range.commonAncestorContainer.textContent.charCodeAt(0) === 65279) {
                            deleteConfirm(ed, range.commonAncestorContainer.parentElement);
                        } else {
                            // this keydown will delete all text content, leaving an empty tag
                            // so insert zero-width non-breaking space (zwnb) to prevent tag deletion
                            range.commonAncestorContainer.textContent = '\uFEFF';
                            // set range to after the zwnb character
                            range.setStart(range.commonAncestorContainer, 1);
                            ed.selection.setRng(range);
                        }
                        return cancelKey(evt);
                    } else if (range.startOffset === 2 && range.commonAncestorContainer.textContent.length === 2) {
                        if (range.commonAncestorContainer.textContent.charCodeAt(0) === 65279) {
                            // this case is when we've already inserted a zwnb character
                            // this keydown will delete the content, and will wrap the entire thing in a <span id="_mce_caret" data-mce-bogus="1"> tag, which will then get cleaned up by tinymce
                            range.commonAncestorContainer.textContent = '\uFEFF';
                            range.setStart(range.commonAncestorContainer, 1);
                            ed.selection.setRng(range);
                            return cancelKey(evt);
                        }
                    }

                }
                // delete
                if (evt.keyCode === 46) {
                    // end of element
                    if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE && range.endOffset === range.commonAncestorContainer.length) {
                        deleteConfirm(ed, range.commonAncestorContainer.nextElementSibling || range.commonAncestorContainer.parentElement);
                        return cancelKey(evt)
                    }
                }

            // deleting selection
            } else {
                if (range.startContainer !== range.endContainer) {
                    var start = range.startContainer;
                    var end = range.endContainer;
                    // get the non-inline ancestors
                    while(start.nodeType !== Node.ELEMENT_NODE || isElementInline(start)) {
                        start = start.parentElement;
                    }
                    while(end.nodeType !== Node.ELEMENT_NODE || isElementInline(end)) {
                        end = end.parentElement;
                    }
                    // if they're the same ancestor then no tags will get deleted
                    if (start === end) {
                        return true;
                    }

                    ed.writer.dialogManager.confirm({
                        title: 'Warning',
                        msg: '<p>The text you are trying to delete contains XML elements, do you want to proceed?</p>',
                        showConfirmKey: 'confirm-delete-tags-selection',
                        type: 'info',
                        callback: function(doIt) {
                            if (doIt) {
                                ed.writer.tagger.processRemovedContent(range);
                                
                                ed.focus()
                                if (evt.keyCode === 8 || evt.keyCode === 46) {
                                    ed.getDoc().execCommand('insertText', false, '')
                                } else {
                                    ed.getDoc().execCommand('insertText', false, evt.key)
                                }

                                ed.writer.event('contentChanged').publish();

                                ed.undoManager.add();
                            }
                        }
                    })
                    return cancelKey(evt)
                }
            }
        }
    })
})
