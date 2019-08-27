module.exports = `<?xml version="1.0" encoding="UTF-8"?><?xml-model href="https://cwrc.ca/schemas/cwrc_tei_lite.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?><?xml-stylesheet type="text/css" href="https://cwrc.ca/templates/css/tei.css"?><TEI xmlns="http://www.tei-c.org/ns/1.0" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<teiHeader>
    <fileDesc>
        <titleStmt>
            <title>Sample Document Title</title>
        </titleStmt>
        <publicationStmt>
            <p></p>
        </publicationStmt>
        <sourceDesc>
            <p></p>
        </sourceDesc>
    </fileDesc>
<xenoData>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:cw="http://cwrc.ca/ns/cw#">
<rdf:Description rdf:datatype="http://www.w3.org/TR/json-ld/"><![CDATA[
{
"@context": "http://www.w3.org/ns/oa/oa.ttl",
"@id": "http://id.cwrc.ca/annotation/6cae06d6-5c6c-4def-b902-c556a7050761",
"@type": "oa:Annotation",
"motivatedBy": [
    "oa:linking"
],
"annotatedAt": "2019-04-16T21:43:15.680Z",
"annotatedBy": {
    "@id": "http://id.cwrc.ca/user/8497d2ed-fe1a-48ca-8901-ff9cbdd34488",
    "@type": "foaf:Person",
    "mbox": {
        "@id": ""
    },
    "name": ""
},
"serializedAt": "2019-04-16T21:43:15.680Z",
"serializedBy": "",
"hasBody": {
    "@id": "http://id.cwrc.ca/link/f18a4646-7a88-47d0-b0e4-4118f16ac4d8",
    "@type": [
        "cnt:ContentAsText",
        "oa:SemanticTag"
    ]
},
"hasTarget": {
    "@id": "http://id.cwrc.ca/doc/18cdc1bd-45d3-4c92-89d5-670a9f865f1c",
    "@type": "oa:SpecificResource",
    "hasSource": {
        "@id": "http://id.cwrc.ca/doc/18cdc1bd-45d3-4c92-89d5-670a9f865f1c",
        "@type": "dctypes:Text",
        "format": "text/xml"
    },
    "hasSelector": {
        "@id": "http://id.cwrc.ca/selector/b815ec89-cd08-4a90-83fc-0d7839f5b79d",
        "@type": "oa:FragmentSelector",
        "dcterms:conformsTo": "http://tools.ietf.org/rfc/rfc3023",
        "rdf:value": "xpointer(TEI/text/body/div/p/ref)"
    }
},
"cwrcAttributes": {
    "target": "#"
}
}
]]></rdf:Description></rdf:RDF></xenoData></teiHeader>
<text>
    <body>
        <div type="letter">
            <head>
                <title>Sample Letter Title</title>
            </head>
            <opener>
                <note type="setting">
                    <p>Some opening note describing the writing setting</p>
                </note>
                <dateline>
                    <date>Some date (set date value in attribute).</date>
                </dateline>
                <salute>Some salutation, e.g. "Dearest <persName cert="definite" type="real" ref="http://viaf.org/viaf/39569752">Miquel</persName>"</salute>
            </opener>
            <p>Sample letter content, including a <ref target="#">link</ref>.</p>
            <closer>
                <salute>Some closing salutation, e.g. "With love..."</salute>
                <signed>Ian Levine</signed>
            </closer>
        </div>
    </body>
</text>
</TEI>`
