'use strict';

var $ = require('jquery');
var Entity = require('entity');

var moment = require('moment/moment');
moment.suppressDeprecationWarnings = true;
 
/**
 * @class AnnotationsManager
 * @param {Writer} writer
 */
function AnnotationsManager(writer) {
    this.w = writer;
}

AnnotationsManager.prefixMap = {
    'bibo': 'http://purl.org/ontology/bibo/',
    'cnt': 'http://www.w3.org/2011/content#',
    'cw': 'http://cwrc.ca/ns/cw#',
    'dc': 'http://purl.org/dc/elements/1.1/',
    'dcterms': 'http://purl.org/dc/terms/',
    'foaf': 'http://xmlns.com/foaf/0.1/',
    'geo': 'http://www.w3.org/2003/01/geo/wgs84_pos#',
    'oa': 'http://www.w3.org/ns/oa#',
    'owl': 'http://www.w3.org/2002/07/owl#',
    'prov': 'http://www.w3.org/ns/prov#',
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
    'skos': 'http://www.w3.org/2004/02/skos/core#',
    'time': 'http://www.w3.org/2006/time#',
    'xsd': 'http://www.w3.org/2001/XMLSchema#'
};

AnnotationsManager.legacyTypes = {
    person: 'foaf:Person',
    org: 'foaf:Organization',
    place: 'geo:SpatialThing',
    title: 'dcterms:title',
    date: 'time:TemporalEntity',
    note: 'bibo:Note',
    citation: 'dcterms:BibliographicResource',
    correction: 'oa:editing',
    keyword: 'skos:Concept',
    link: 'oa:linking'
};

AnnotationsManager.prototype = {
    constructor: AnnotationsManager,

    getAnnotationURIForEntity: function(entity) {
        var range = entity.getRange();
        var annoIdDateString = moment(entity.getDateCreated()).format('YYYYMMDDHHmmss');
        var annotationId = range.startXPath+'_'+annoIdDateString; // github doc + xpath + datestring
        return encodeURI(annotationId);
    },
    
    /**
     * Get the annotation object for the entity.
     * @param {Entity} entity The Entity instance.
     * @param {String} format The annotation format ('xml' or 'json').
     * @returns {Object} The annotation object. 
     */
    getAnnotation: function(entity, format) {
        format = format || 'xml';
        var type = entity.getType();
        var annoMappings = this.w.schemaManager.mapper.getMappings().entities;
        var e = annoMappings[type];
        var anno;
        if (e && e.annotation !== undefined) {
            anno = e.annotation(this, entity, format);
            if (format === 'xml') {
                anno = anno[0].firstChild; // convert from jquery obj
            }
        }
        return anno;
    },

    /**
     * Creates a common annotation object.
     * @param {Entity} entity The entity.
     * @param {String} format The annotation format to return: 'json' or 'xml'.
     * @param {String|Array} types The annotation body type(s)
     * @param {String|Array} [motivations] The annotation motivation(s). Default is 'oa:identifying'.
     * @returns {JSON|XML} 
     */
    commonAnnotation: function(entity, format, types, motivations) {
        if (motivations === undefined) {
            motivations = 'oa:identifying';
        }

        // USER
        var userInfo = this.w.getUserInfo();
        
        // APP
        var appUri = 'https://cwrc-writer.cwrc.ca/'; // if nerve it should be https://nerve.cwrc.ca/
        var appVersion = '1.0';

        // TIME
        var now = new Date();
        var createdDate = entity.getDateCreated();
        var issuedDate = now.toISOString();
        
        // ENTITY
        var entityType = entity.getType();
        var certainty = entity.getCertainty();
        var range = entity.getRange();

        var entityId = entity.getURI();
        var docId = this.w.getDocumentURI();
        var annotationId = docId + '?' + this.getAnnotationURIForEntity(entity);
        
        var annotation;
        
        if (format === 'xml') {
            annotation = $($.parseXML('<rdf:RDF></rdf:RDF>'));
        } else if (format === 'json') {
            annotation = {
                "@context": {
                    "as": "http://www.w3.org/ns/activitystreams#",
                    "cwrc": "http://sparql.cwrc.ca/ontologies/cwrc#",
                    "dc": "http://purl.org/dc/elements/1.1/",
                    "dcterms": "http://purl.org/dc/terms/",
                    "foaf": "http://xmlns.com/foaf/0.1/",
                    "geo": "http://www.geonames.org/ontology#",
                    "oa": "http://www.w3.org/ns/oa#",
                    "schema": "http://schema.org/",
                    "xsd": "http://www.w3.org/2001/XMLSchema#",
                    "dcterms:created": {
                        "@type": "xsd:dateTime",
                        "@id": "dcterms:created"
                    },
                    "dcterms:issued": {
                        "@type": "xsd:dateTime",
                        "@id": "dcterms:issued"
                    },
                    "oa:motivatedBy": {
                        "@type": "oa:Motivation"
                    },
                    "@language": "en"
                },
                "@id": annotationId,
                "@type": "oa:Annotation",
                "dcterms:created": createdDate,
                "dcterms:issued": issuedDate,
                "dcterms:creator": {
                    "@id": userInfo.id,
                    "@type": [
                        "cwrc:NaturalPerson",
                        "schema:Person"
                    ],
                    "cwrc:hasName": userInfo.name,
                    "foaf:nick": userInfo.nick
                },
                "oa:motivatedBy": motivations,
                "oa:hasTarget": {
                    "@id": annotationId+'#Target',
                    "@type": "oa:SpecificResource",
                    "oa:hasSource": {
                        "@id": docId,
                        "@type": "dctypes:Text",
                        "dc:format": "text/xml"
                    },
                    "oa:renderedVia": {
                        "@id": appUri,
                        "@type": "as:Application",
                        "rdfs:label": "CWRC Writer",
                        "schema:softwareVersion": appVersion
                    }
                },
                "oa:hasBody":{
                    "@type": types
                },
                "as:generator": {
                    "@id": appUri,
                    "@type": "as:Application",
                    "rdfs:label": "CWRC Writer",
                    "schema:url": "https://cwrc-writer.cwrc.ca",
                    "schema:softwareVersion": appVersion
                }
            };

            if (entityId && entityType !== 'citation') {
                annotation["oa:hasBody"]["@id"] = entityId;
                annotation["oa:hasBody"]["dc:format"] = "text/html";
            } else if (entity.isNote()) {
                var noteEl = $('#'+entity.getId(), this.w.editor.getBody());
                var noteContent = noteEl[0].textContent;
                annotation["oa:hasBody"]["dc:format"] = "text/html";
                annotation["oa:hasBody"]["rdf:value"] = noteContent;
            }

            if (range.endXPath) {
                annotation["oa:hasTarget"]["oa:hasSelector"] = {
                    "@id": annotationId+'#Selector',
                    "@type": "oa:RangeSelector",
                    "oa:hasStartSelector": {
                        "@type": "oa:XPathSelector",
                        "rdf:value": range.startXPath
                    },
                    "oa:hasEndSelector": {
                        "@type": "oa:XPathSelector",
                        "rdf:value": range.endXPath
                    },
                    "oa:refinedBy": {
                        "@type": "oa:TextPositionSelector",
                        "oa:start": range.startOffset,
                        "oa:end": range.endOffset
                    }
                };
            } else {
                annotation["oa:hasTarget"]["oa:hasSelector"] = {
                    "@id": annotationId+'#Selector',
                    "@type": "oa:XPathSelector",
                    "rdf:value": range.startXPath
                };
            }
            
            if (certainty !== undefined) {
                annotation["oa:hasCertainty"] = 'cwrc:'+certainty;
            }
        } else {
            console.warn('annotationsManager.commonAnnotation: unrecognized format specified',format);
        }
        
        return annotation;
    },
    
    /**
     * Get the RDF string that represents the specified annotations.
     * @param {Array} entities An array of Entity instances
     * @param {String} format The annotation format ('xml' or 'json).
     * @returns {String} The RDF string.
     */
    getAnnotations: function(entities, format) {
        format = format || 'xml';

        var namespaces = {
            'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
        };

        var rdfString = '';

        entities.forEach(function(entity) {
            var annotation = this.getAnnotation(entity, format);

            if (format === 'xml') {
                // process namespaces
                $(annotation.attributes).each(function(index, el) {
                    if (el.prefix === 'xmlns') {
                        namespaces[el.localName] = el.value;
                    }
                });

                // get the child descriptions
                $('rdf\\:Description, Description', annotation).each(function(index, el) {
                    rdfString += '\n';
                    rdfString += this.w.utilities.xmlToString(el);
                });
            } else if (format === 'json') {
                rdfString += '\n<rdf:Description rdf:datatype="http://www.w3.org/TR/json-ld/"><![CDATA[\n';
                rdfString += JSON.stringify(annotation, null, '\t');
                rdfString += '\n]]></rdf:Description>';
            }
        }.bind(this));

        // triples
        for (var i = 0; i < this.w.triples.length; i++) {
            var t = this.w.triples[i];

            rdfString += '\n<rdf:Description rdf:about="'+t.subject.uri+'" cw:external="'+t.subject.external+'">'+
            '\n\t<cw:'+t.predicate.name+' cw:text="'+t.predicate.text+'" cw:external="'+t.predicate.external+'">'+
            '\n\t\t<rdf:Description rdf:about="'+t.object.uri+'" cw:external="'+t.object.external+'" />'+
            '\n\t</cw:'+t.predicate.name+'>'+
            '\n</rdf:Description>';
        }

        var rdfHead = '<rdf:RDF';
        var rdfTail = '</rdf:RDF>';
        for (var name in namespaces) {
            rdfHead += ' xmlns:'+name+'="'+namespaces[name]+'"';
        }
        rdfHead += '>\n';

        rdfString = rdfHead + rdfString + rdfTail;

        return rdfString;
    },
    
    /**
     * Gets an entity config for the specified RDF element.
     * @param {Element} rdfEl An RDF element containing annotation info
     * @returns {Object|null} Entity config object
     */
    getEntityConfigFromAnnotation: function(rdfEl) {
        var entityConfig = null;

        var isLegacy = rdfEl.parentElement.hasAttribute('xmlns:cw');
        if (isLegacy) {
            // json-ld
            if (rdfEl.getAttribute('rdf:datatype') === 'http://www.w3.org/TR/json-ld/') {
                entityConfig = this._getEntityConfigFromJsonAnnotationLegacy(rdfEl);
            // rdf/xml
            } else if (rdfEl.getAttribute('rdf:about') !== null) {
                entityConfig = this._getEntityConfigFromXmlAnnotationLegacy(rdfEl);
            }
        } else {
            return this.getEntityConfigFromJsonAnnotation(rdfEl);
        }

        return entityConfig;
    },

    // TODO
    getEntityConfigFromJsonAnnotation: function(rdfEl) {
        var entityConfig = null;
        
        var rdf = $(rdfEl);
        var annotation = JSON.parse(rdf.text());
        if (annotation != null) {
            entityConfig = {};

            // type
            entityConfig.type = '';
            // TODO
            // var types = annotation["oa:hasBody"]["@type"];
            // if (Array.isArray(types) === false) {
            //     types = [types];
            // }
            // for (var i = 0; i < types.length; i++) {
            //     var type = this._getEntityTypeForAnnotation(types[i]);
            //     if (type !== null) {
            //         entityConfig.type = this._getEntityTypeForAnnotation(types);
            //         break;
            //     }
            // }
            
            // range
            entityConfig.range = {};
            var selector = annotation["oa:hasTarget"]["oa:hasSelector"];
            if (selector["oa:refinedBy"]) {
                entityConfig.range.startXPath = selector["oa:hasStartSelector"]["rdf:value"];
                entityConfig.range.startOffset = selector["oa:refinedBy"]["oa:start"];
                entityConfig.range.endXPath = selector["oa:hasEndSelector"]["rdf:value"];
                entityConfig.range.endOffset = selector["oa:refinedBy"]["oa:end"];
            } else {
                entityConfig.range.startXPath = selector["rdf:value"];
            }
        }

        return entityConfig;
    },

    /**
     * Parse JSON and get an Entity config object
     * @param {Element} rdfEl An RDF element containing JSON text
     * @returns {Object|null} Entity config object
     */
    _getEntityConfigFromJsonAnnotationLegacy: function(rdfEl) {
        var entityConfig = null;
        
        var rdf = $(rdfEl);
        var json = JSON.parse(rdf.text());
        if (json != null) {
            entityConfig = {};
            
            // entity type
            var entityType = null;
            var bodyTypes = json.hasBody['@type'];
            var needsMotivation = bodyTypes.indexOf('cnt:ContentAsText') !== -1;
            if (needsMotivation) {
                bodyTypes = bodyTypes.concat(json.motivatedBy);
            }
            for (var i = 0; i < bodyTypes.length; i++) {
                var typeUri = bodyTypes[i];
                entityType = this._getEntityTypeForAnnotationLegacy(typeUri);
                if (entityType != null) {
                    break;
                }
            }
            entityConfig.type = entityType;

            // range
            var rangeObj;
            var selector = json.hasTarget.hasSelector;
            if (selector['@type'] == 'oa:TextPositionSelector') {
                var xpointerStart = selector['oa:start'];
                var xpointerEnd = selector['oa:end'];
                rangeObj = this._getRangeObject(xpointerStart, xpointerEnd);
            } else if (selector['@type'] == 'oa:FragmentSelector') {
                var xpointer = selector['rdf:value'];
                rangeObj = this._getRangeObject(xpointer);
            }
            entityConfig.range = rangeObj;

            // lookup info
            if (json.cwrcInfo) {
                entityConfig.uri = json.cwrcInfo.uri;
                entityConfig.lemma = json.cwrcInfo.name;
            }

            // certainty
            var certainty = json.hasCertainty;
            if (certainty !== undefined) {
                certainty = certainty.split(':')[1];
                if (certainty === 'reasonable') {
                    // fix for discrepancy between schemas
                    certainty = 'reasonably certain';
                }
                entityConfig.certainty = certainty;
            }

            // date
            entityConfig.dateCreated = json.annotatedAt;
        }
        
        return entityConfig;
    },
    
    /**
     * Parse XML and create a Entity config object
     * @param {Element} xml An RDF element containing XML elements
     * @returns {Object|null} Entity config object
     */
    _getEntityConfigFromXmlAnnotationLegacy: function(xml) {
        var entityConfig = null;
        
        var rdf = $(xml);
        var aboutUri = rdf.attr('rdf:about');
        if (aboutUri.indexOf('id.cwrc.ca/annotation') !== -1) {
            var rdfs = rdf.parent('rdf\\:RDF, RDF');      

            var hasBodyUri = rdf.find('oa\\:hasBody, hasBody').attr('rdf:resource');
            var body = rdfs.find('[rdf\\:about="'+hasBodyUri+'"]');
            var hasTargetUri = rdf.find('oa\\:hasTarget, hasTarget').attr('rdf:resource');
            var target = rdfs.find('[rdf\\:about="'+hasTargetUri+'"]');

            // determine type
            var typeUri = body.children().last().attr('rdf:resource'); // FIXME relies on consistent order of rdf:type elements
            if (typeUri == null || typeUri.indexOf('ContentAsText') !== -1) {
                // body is external resource (e.g. link), or it's a generic type so must use motivation instead
                typeUri = rdf.find('oa\\:motivatedBy, motivatedBy').last().attr('rdf:resource');
            }
            
            if (typeUri == null) {
                console.warn('can\'t determine type for', xml);
            } else {
                var entityType = this._getEntityTypeForAnnotationLegacy(typeUri);
                entityConfig = {
                    type: entityType
                };

                // range
                var rangeObj = {};
                // matching element
                var selectorUri = target.find('oa\\:hasSelector, hasSelector').attr('rdf:resource');
                var selector = rdfs.find('[rdf\\:about="'+selectorUri+'"]');
                var selectorType = selector.find('rdf\\:type, type').attr('rdf:resource');
                if (selectorType.indexOf('FragmentSelector') !== -1) {                    
                    var xpointer = selector.find('rdf\\:value, value').text();
                    rangeObj = this._getRangeObject(xpointer);
                // offset
                } else {
                    var xpointerStart = selector.find('oa\\:start, start').text();
                    var xpointerEnd = selector.find('oa\\:end, end').text();
                    rangeObj = this._getRangeObject(xpointerStart, xpointerEnd);
                }
                entityConfig.range = rangeObj;
    
                // certainty
                var certainty = rdf.find('cw\\:hasCertainty, hasCertainty').attr('rdf:resource');
                if (certainty && certainty != '') {
                    certainty = certainty.split('#')[1];
                    if (certainty === 'reasonable') {
                        // fix for discrepancy between schemas
                        certainty = 'reasonably certain';
                    }
                    entityConfig.certainty = certainty;
                }
    
                // lookup info
                var cwrcLookupObj = rdf.find('cw\\:cwrcInfo, cwrcInfo').text();
                if (cwrcLookupObj != '') {
                    cwrcLookupObj = JSON.parse(cwrcLookupObj);
                    entityConfig.uri = cwrcLookupObj.uri;
                    entityConfig.lemma = cwrcLookupObj.name;
                }

                // date created
                entityConfig.dateCreated = rdf.find('cw\\:annotatedAt, annotatedAt').text();
            }
        }
        
        return entityConfig;
    },

    /**
     * Returns the entity type, using a annotation string.
     * @param {String} annotation The annotation string, e.g. 'foaf:Person'
     * @returns {String}
     */
    _getEntityTypeForAnnotationLegacy: function(annotation) {
        if (annotation.indexOf('http://') !== -1) {
            // convert uri to prefixed form
            for (var prefix in AnnotationsManager.prefixMap) {
                var uri = AnnotationsManager.prefixMap[prefix];
                if (annotation.indexOf(uri) === 0) {
                    annotation = annotation.replace(uri, prefix+':');
                    break;
                }
            }
        }
        for (var entityType in AnnotationsManager.legacyTypes) {
            if (AnnotationsManager.legacyTypes[entityType] === annotation) {
                return entityType;
            }
        }
        
        return null;
    },

    /**
     * Gets the range object for xpointer(s).
     * @param {String} xpointerStart 
     * @param {String} [xpointerEnd]
     * @return {Object}
     */
    _getRangeObject: function(xpointerStart, xpointerEnd) {

        function parseXPointer(xpointer) {
            var xpath;
            var offset = null;
            if (xpointer.indexOf('string-range') === -1) {
                var regex = new RegExp(/xpointer\((.*)?\)$/); // regex for isolating xpath
                var content = regex.exec(xpointer)[1];
                xpath = content;
            } else {
                var regex = new RegExp(/xpointer\((?:string-range\()?([^\)]*)\)+/); // regex for isolating xpath and offset
                var content = regex.exec(xpointer)[1];
                var parts = content.split(',');
                xpath = parts[0];
                if (parts[2]) {
                    offset = parseInt(parts[2]);
                }
            }            
    
            return {
                xpath: xpath,
                offset: offset
            };
        }

        var rangeObj = {};
        
        var xpathStart = parseXPointer(xpointerStart);
        if (xpointerEnd !== undefined) {
            var xpathEnd = parseXPointer(xpointerEnd);
            rangeObj = {
                startXPath: xpathStart.xpath,
                startOffset: xpathStart.offset,
                endXPath: xpathEnd.xpath,
                endOffset: xpathEnd.offset
            };
        } else {
            rangeObj = {
                startXPath: xpathStart.xpath
            };
        }

        return rangeObj;
    }
};

module.exports = AnnotationsManager;
