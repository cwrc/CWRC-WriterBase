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

        doProcessing: xml2cwrc.doProcessing, // TODO is this still required?

        getDocumentContent: cwrc2xml.getDocumentContent,
        buildXMLString: cwrc2xml.buildXMLString
    };
    
    return converter;
};

module.exports = Converter;
