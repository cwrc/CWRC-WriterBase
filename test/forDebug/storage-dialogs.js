'use strict';

var $ = require('jquery');

var blankTEIDoc = '<?xml version="1.0" encoding="UTF-8"?> <?xml-model href="http://cwrc.ca/schemas/cwrc_tei_lite.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?> <?xml-stylesheet type="text/css" href="http://cwrc.ca/templates/css/tei.css"?> <TEI xmlns="http://www.tei-c.org/ns/1.0" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:cw="http://cwrc.ca/ns/cw#" xmlns:w="http://cwrctc.artsrn.ualberta.ca/#"> <teiHeader> <fileDesc> <titleStmt> <title>Sample Document Title</title> </titleStmt> <publicationStmt> <p></p> </publicationStmt> <sourceDesc sameAs="http://www.cwrc.ca"> <p>Created from original research by members of CWRC/CSÉC unless otherwise noted.</p> </sourceDesc> </fileDesc> </teiHeader> <text> <body> <div> Replace with your text. </div> </body> </text> </TEI>';

function setBlankDocumentInEditor(writer) {
    var defaultxmlDoc = $.parseXML(blankTEIDoc);
    // writer.fileManager.loadDocumentFromXml(defaultxmlDoc);
    writer.loadDocument(defaultxmlDoc);
}

module.exports = {
    save: function(writer) {
        
    },
    load: function(writer) {
        setBlankDocumentInEditor(writer);
    }
}