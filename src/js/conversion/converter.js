/**
 * Converts between CWRCWriter format and XML format.
 */
'use strict';

var $ = require('jquery');

var CWRC2XML = require('./cwrc2xml.js');
var XML2CWRC = require('./xml2cwrc.js');

/**
 * @class Converter
 * @param {Writer} writer
 */
function Converter(writer) {
    var w = writer;

    var xml2cwrc = new XML2CWRC(w);
    var cwrc2xml = new CWRC2XML(w);

    /**
     * @lends Converter.prototype
     */
    var converter = {
        processDocument: xml2cwrc.processDocument,
        buildEditorString: xml2cwrc.buildEditorString,

        getDocumentContent: cwrc2xml.getDocumentContent,
        buildXMLString: cwrc2xml.buildXMLString
    };

    // convenience methods
    
    converter.loadDocumentURL = function(docUrl) {
        w.currentDocId = docUrl;
        w.event('loadingDocument').publish();
        $.ajax({
            url: docUrl,
            type: 'GET',
            success: function(doc, status, xhr) {
                converter.processDocument(doc);
            },
            error: function(xhr, status, error) {
                w.currentDocId = null;
                w.dialogManager.show('message', {
                    title: 'Error',
                    msg: 'An error occurred and ' + docUrl + ' was not loaded.',
                    type: 'error'
                });
                w.event('documentLoaded').publish(false, null);
            },
            dataType: 'xml'
        });
    };

    converter.loadDocumentXML = function(docXml) {
        w.event('loadingDocument').publish();
        if (typeof docXml === 'string') {
            docXml = w.utilities.stringToXML(docXml);
            if (docXml === null) {
                w.event('documentLoaded').publish(false, null);
                w.dialogManager.show('message', {
                    title: 'Error',
                    msg: 'The document you are trying to upload is not well-formed. Check that it has the xml extension and that it follows <a href="https://www.w3resource.com/xml/well-formed.php" target="_blank" rel="noopener noreferrer">propper xml grammar</a>.',
                    type: 'error'
                });
                return false;
            }
        }
        converter.processDocument(docXml);
    };

    converter.getDocument = async function (asString, callback) {
        const docString = await converter.getDocumentContent(true);
        if (asString === true) return callback.call(this, docString);
            
        
        let doc = null;
        try {
            const parser = new DOMParser();
            doc = parser.parseFromString(docString, 'application/xml');
        } catch (e) {
            w.dialogManager.show('message', {
                title: 'Error',
                msg: `There was an error getting the document:${e}`,
                type: 'error'
            });
        }
        callback.call(this, doc);
        


        // converter.getDocumentContent(true, (docString) => {
        //     if (asString === true) {
        //         callback.call(this, docString);
        //     } else {
        //         var doc = null;
        //         try {
        //             var parser = new DOMParser();
        //             doc = parser.parseFromString(docString, 'application/xml');
        //         } catch (e) {
        //             w.dialogManager.show('message', {
        //                 title: 'Error',
        //                 msg: 'There was an error getting the document:' + e,
        //                 type: 'error'
        //             });
        //         }
        //         callback.call(this, doc);
        //     }
        // });
    };

    converter.setDocument = function(document) {
        if (typeof document === 'string' && document.indexOf('http') === 0) {
            converter.loadDocumentURL(document);
        } else {
            converter.loadDocumentXML(document);
        }
    };
    
    return converter;
};

module.exports = Converter;
