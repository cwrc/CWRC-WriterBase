/**
 * Contains the load and save dialogs, as well as file related functions.
 */
'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/dialog');

//cross browser xml node finder
//http://www.steveworkman.com/html5-2/javascript/2011/improving-javascript-xml-node-finding-performance-by-2000/
$.fn.filterNode = function(name) {
    return this.find('*').filter(function() {
        return this.nodeName === name;
    });
};

/**
 * @class FileManager
 * @param {Writer} writer
 */
function FileManager(writer) {
    
    var w = writer;
    
    $(document.body).append(''+
        '<div id="editSourceDialog">'+
            '<textarea spellcheck="false"></textarea>'+
        '</div>'
        //'<iframe id="editDocLoader" style="display: none;"></iframe>'
    );
    
    var edit = $('#editSourceDialog');
    edit.dialog({
        title: 'Edit Source',
        modal: true,
        resizable: true,
        closeOnEscape: true,
        height: 480,
        width: 640,
        autoOpen: false,
        buttons: {
            'Ok': function() {
                var newDocString = $('textarea', edit).val();
                var xmlDoc = w.utilities.stringToXML(newDocString);
                edit.dialog('close');
                fm.loadDocumentFromXml(xmlDoc);
            },
            'Cancel': function() {
                edit.dialog('close');
            }
        },
        open: function(e) {
            var $text = $(this).find('textarea');
            $text.focus();
            $text[0].setSelectionRange(0, 0);
            $text.scrollTop(0);
        }
    });
    
    /**
     * @lends FileManager.prototype
     */
    var fm = {};
    
    fm.newDocument = function() {
        if (w.editor.isDirty()) {
            w.dialogManager.show('filemanager', {type: 'unsaved'});
        } else {
            window.location = 'index.htm';
        }
    };
    
    fm.saveDocument = function() {
        if (w.currentDocId == null) {
            w.dialogManager.show('filemanager', {type: 'saver'});
        } else {
            w.validate(function (valid) {
                if (valid) {
                    w.event('documentSaveRequested').publish(w.currentDocId);
                } else {
                    var doc = w.currentDocId;
                    if (doc == null) doc = 'The current document';
                    w.dialogManager.confirm({
                        title: 'Document Invalid',
                        msg: doc+' is not valid. <b>Save anyways?</b>',
                        callback: function(yes) {
                            if (yes) {
                                w.event('documentSaveRequested').publish(w.currentDocId);
                            }
                        }
                    });
                }
            });
        }
    };

    
    /**
     * Loads a document into the editor
     * @fires Writer#loadingDocument
     * @param {String} docUrl An URL pointing to an XML document
     */
    fm.loadDocumentFromUrl = function(docUrl) {
        w.currentDocId = docUrl;
        w.event('loadingDocument').publish();
        $.ajax({
            url: docUrl,
            type: 'GET',
            success: function(doc, status, xhr) {
                window.location.hash = '';
                w.converter.processDocument(doc);
            },
            error: function(xhr, status, error) {
                w.currentDocId = null;
                w.dialogManager.show('message', {
                    title: 'Error',
                    msg: 'An error ('+status+') occurred and '+docUrl+' was not loaded.',
                    type: 'error'
                });
                w.event('documentLoaded').publish(false, null);
            },
            dataType: 'xml'
        });
    };
    
    /**
     * Loads a document into the editor.
     * @fires Writer#loadingDocument
     * @param docXml An XML DOM
     */
    fm.loadDocumentFromXml = function(docXml) {
        w.event('loadingDocument').publish();
        //window.location.hash = '';
        w.converter.processDocument(docXml);
    };
    
    fm.editSource = function() {
        w.dialogManager.confirm({
            title: 'Edit Source',
            msg: 'Editing the source directly is only recommended for advanced users who know what they\'re doing.<br/><br/>Are you sure you wish to continue?',
            callback: function(yes) {
                if (yes) {
                    var docText = w.converter.getDocumentContent(true);
                    $('textarea', edit).val(docText);
                    edit.dialog('open');
                }
            }
        });
    };
    
    return fm;
};

module.exports = FileManager;