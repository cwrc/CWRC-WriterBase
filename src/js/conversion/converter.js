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
        reservedAttributes: xml2cwrc.reservedAttributes,

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
                    msg: 'There was an error parsing the document.',
                    type: 'error'
                });
                return false;
            }
        }
        converter.processDocument(docXml);
    };

    converter.getDocument = function(asString) {
        var docString = converter.getDocumentContent(true);
        if (asString === true) {
            return docString;
        } else {
            var doc = null;
            try {
                var parser = new DOMParser();
                doc = parser.parseFromString(docString, 'application/xml');
            } catch (e) {
                w.dialogManager.show('message', {
                    title: 'Error',
                    msg: 'There was an error getting the document:' + e,
                    type: 'error'
                });
            }
            return doc;
        }
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
