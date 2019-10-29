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

function deleteConfirm(editor, range, direction) {
    var element;
    if (direction === 'back') {
        element = range.commonAncestorContainer.previousElementSibling || range.commonAncestorContainer.parentElement;
    } else {
        element = range.commonAncestorContainer.nextElementSibling || range.commonAncestorContainer.parentElement;
    }

    var invalidDelete = editor.writer.schemaManager.wouldDeleteInvalidate(element);

    var msg = `<p>Delete "${element.getAttribute('_tag')}" element?</p>`;
    var showConfirmKey = 'confirm-delete-tag';
    if (invalidDelete) {
        msg = `<p>Deleting the "${element.getAttribute('_tag')}" element will make the document invalid. Do you wish to continue?</p>`;
        showConfirmKey = 'confirm-delete-tag-invalidating';
    }

    editor.writer.dialogManager.confirm({
        title: 'Warning',
        msg: msg,
        showConfirmKey: showConfirmKey,
        type: 'info',
        callback: (doIt) => {
            var textNode;
            if (direction === 'back') {
                textNode = editor.writer.utilities.getPreviousTextNode(range.commonAncestorContainer, true);
            } else {
                textNode = editor.writer.utilities.getNextTextNode(range.commonAncestorContainer, true);
            }
            if (doIt) {
                var hasTextContent = element.textContent !== '\uFEFF';
                editor.writer.tagger.removeStructureTag(element.getAttribute('id'), !hasTextContent);
            }
            if (textNode !== null && textNode.parentNode !== null) { // if parentNode is null that means the text was normalized as part of removeStructureTag
                var rng = editor.selection.getRng();
                rng.selectNode(textNode);
                rng.collapse(direction !== 'back');
                editor.selection.setRng(rng);
            }
            editor.focus();
            // console.log(editor.selection.getRng().commonAncestorContainer.outerHTML);
        }
    })
}

function moveToTextNode(event, editor, range, direction) {
    var textNode;
    if (direction === 'back') {
        textNode = editor.writer.utilities.getPreviousTextNode(range.commonAncestorContainer, true);
    } else {
        textNode = editor.writer.utilities.getNextTextNode(range.commonAncestorContainer, true);
    }
    if (textNode !== null && textNode.parentNode !== null) { // if parentNode is null that means the text was normalized as part of removeStructureTag
        var nextParent = textNode.parentElement;
        if (nextParent.textContent.length === 0 || (nextParent.textContent.length === 1 && nextParent.textContent.charCodeAt(0) === 65279)) {
            var rng = editor.selection.getRng();
            if (direction === 'back') {
                rng.setStart(textNode, textNode.textContent.length);
                rng.setEnd(textNode, textNode.textContent.length);
            } else {
                rng.setStart(textNode, 0);
                rng.setEnd(textNode, 0);
            }
            deleteConfirm(editor, rng, direction);
            return cancelKey(event);
        } else {
            if (textNode.parentElement.nodeName === 'SPAN') {
                if (textNode.parentElement.textContent.length === 1) {
                    var nextParent = textNode.parentElement;
                    // this keydown will delete all text content, leaving an empty tag
                    // so insert zero-width non-breaking space (zwnb) to prevent tag deletion
                    nextParent.textContent = '\uFEFF';
                    // set range to after the zwnb character
                    var rng = editor.selection.getRng();
                    rng.setStart(nextParent.firstChild, 1);
                    rng.setEnd(nextParent.firstChild, 1);
                    editor.selection.setRng(rng);
                    return cancelKey(event);
                }
            } else {
                var rng = editor.selection.getRng();
                if (direction === 'back') {
                    rng.setStart(textNode, textNode.textContent.length);
                    rng.setEnd(textNode, textNode.textContent.length);
                } else {
                    rng.setStart(textNode, 0);
                    rng.setEnd(textNode, 0);
                }
                editor.selection.setRng(rng);
                // return cancelKey(event);
            }
        }
    }
}

tinymce.PluginManager.add('preventdelete', function(ed) {
    ed.on('keydown', function(evt) {
        if (keyWillDelete(evt)) {
            var range = ed.selection.getRng()

            // console.log(range.startOffset, range.commonAncestorContainer.textContent.length);

            // deleting individual characters
            if (range.collapsed && range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
                var textContainer = range.commonAncestorContainer;

                // backspace
                if (evt.keyCode === 8) {
                    // start of element
                    if (range.startOffset === 0) {
                        if (textContainer.textContent.length === 0) {
                            deleteConfirm(ed, range, 'back');
                            return cancelKey(evt)
                        } else {
                            return moveToTextNode(evt, ed, range, 'back');
                        }
                    } else if (range.startOffset === 1 && textContainer.textContent.length === 1) {
                        if (textContainer.textContent.charCodeAt(0) === 65279) {
                            if (textContainer.previousSibling === null) {
                                deleteConfirm(ed, range, 'back');
                                return cancelKey(evt);
                            } else {
                                return moveToTextNode(evt, ed, range, 'back');
                            }
                        } else {
                            // this keydown will delete all text content, leaving an empty tag
                            // so insert zero-width non-breaking space (zwnb) to prevent tag deletion
                            textContainer.textContent = '\uFEFF';
                            // set range to after the zwnb character
                            range.setStart(textContainer, 1);
                            ed.selection.setRng(range);
                            return cancelKey(evt);
                        }
                    } else if (range.startOffset === 2 && textContainer.textContent.length === 2) {
                        if (textContainer.textContent.charCodeAt(0) === 65279) {
                            // this case is when we've already inserted a zwnb character
                            // this keydown will delete the content, and will wrap the entire thing in a <span id="_mce_caret" data-mce-bogus="1"> tag, which will then get cleaned up by tinymce
                            textContainer.textContent = '\uFEFF';
                            range.setStart(textContainer, 1);
                            ed.selection.setRng(range);
                            return cancelKey(evt);
                        }
                    }

                }
                // delete
                if (evt.keyCode === 46) {
                    // end of element
                    if (range.startOffset === textContainer.length) {
                        if (textContainer.length === 0) {
                            deleteConfirm(ed, range, 'forward');
                            return cancelKey(evt)
                        } else {
                            return moveToTextNode(evt, ed, range, 'forward');
                        }
                        
                    } else if (range.startOffset === textContainer.length-1 && textContainer.length === 1) {
                        if (textContainer.textContent.charCodeAt(0) === 65279) {
                            if (textContainer.nextSibling === null) {
                                deleteConfirm(ed, range, 'forward');
                                return cancelKey(evt);
                            } else {
                                return moveToTextNode(evt, ed, range, 'forward');
                            }
                        } else {
                            // this keydown will delete all text content, leaving an empty tag
                            // so insert zero-width non-breaking space (zwnb) to prevent tag deletion
                            textContainer.textContent = '\uFEFF';
                            // set range to after the zwnb character
                            range.setStart(textContainer, 0);
                            ed.selection.setRng(range);
                            return cancelKey(evt);
                        }
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
