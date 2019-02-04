'use strict'

// https://stackoverflow.com/questions/9856269/protect-div-element-from-being-deleted-within-tinymce

var $ = require('jquery')
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

tinymce.PluginManager.add('preventdelete', function(ed) {
    ed.on('keydown', function(evt) {
        if (keyWillDelete(evt)) {
            var range = ed.selection.getRng()
            if (range.collapsed) {
                // start of element and backspace
                if (range.startOffset === 0 && evt.keyCode === 8) {
                    return cancelKey(evt)
                }
                // end of element and delete
                if (evt.keyCode === 46 && range.commonAncestorContainer.nodeType === Node.TEXT_NODE && range.endOffset === range.commonAncestorContainer.length) {
                    return cancelKey(evt)
                }
            } else {
                if (range.startContainer !== range.endContainer) {
                    ed.writer.dialogManager.confirm({
                        title: 'Warning',
                        msg: '<p>The text you are trying to delete contains XML tags, do you want to proceed?</p>',
                        type: 'info',
                        callback: function(doIt) {
                            if (doIt) {
                                ed.focus()
                                if (evt.keyCode === 8 || evt.keyCode === 46) {
                                    ed.getDoc().execCommand('insertText', false, '')
                                } else {
                                    ed.getDoc().execCommand('insertText', false, evt.key)
                                }
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
