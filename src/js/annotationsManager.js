'use strict';

var $ = require('jquery');
var Entity = require('./entity.js');
 
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

AnnotationsManager.types = {
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

/**
 * Creates a common annotation object.
 * @param {Entity} entity The entity.
 * @param {Array} types The annotation type(s).
 * @param {Array} [motivations] The annotation motivations(s).
 * @param {String} format The annotation format to return: 'json' or 'xml'.
 * @returns {JSON|XML} 
 */
AnnotationsManager.commonAnnotation = function(entity, types, motivations, format) {
    format = format || 'xml';
    
    var uris = entity.getUris();
    var certainty = entity.getAttribute('cert') || entity.getAttribute('certainty')|| entity.getAttribute('CERTAINTY');
    var range = entity.getRange();
    var cwrcInfo = entity.getLookupInfo();
    var attributes = entity.getAttributes();

    if (!$.isArray(types)) {
        types = [types];
    }
    
    if (motivations === null) {
        motivations = ['oa:tagging','oa:identifying'];
    }
    if (!$.isArray(motivations)) {
        motivations = [motivations];
    }
    
    var date = new Date().toISOString();
    var annotationId = uris.annotationId;
    var body = '';
    var annotatedById = uris.userId;
    var userName = '';
    var userMbox = '';
    var entityId = uris.entityId;
    var docId = uris.docId;
    var targetId = uris.targetId;
    var selectorId = uris.selectorId;
    
    var annotation;
    
    if (format === 'xml') {
        var namespaces = {
            'rdf': 'xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"',
            'oa': 'xmlns:oa="http://www.w3.org/ns/oa#"',
            'cw': 'xmlns:cw="http://cwrc.ca/ns/cw#"'
        };
        
        var typesString = '';
        for (var i = 0; i < types.length; i++) {
            var typeParts = types[i].split(':');
            var prefix = typeParts[0];
            var namespace = AnnotationsManager.prefixMap[prefix];
            namespaces[prefix] = 'xmlns:'+prefix+'="'+namespace+'"';
            typesString += '\n\t<rdf:type rdf:resource="'+namespace+typeParts[1]+'"/>';
        }
        
        var motivationsString = '';
        for (var i = 0; i < motivations.length; i++) {
            var motivationParts = motivations[i].split(':');
            var prefix = motivationParts[0];
            var namespace = AnnotationsManager.prefixMap[prefix];
            namespaces[prefix] = 'xmlns:'+prefix+'="'+namespace+'"';
            motivationsString += '\n\t<oa:motivatedBy rdf:resource="'+namespace+motivationParts[1]+'"/>';
        }
        
        var namespaceString = '';
        for (var prefix in namespaces) {
            namespaceString += ' '+namespaces[prefix];
        }
        
        var certaintyString = '';
        if (certainty != null) {
            // fix for discrepancy between schemas
            if (certainty === 'reasonably certain') {
                certainty = 'reasonable';
            }
            certaintyString = '\n\t<cw:hasCertainty rdf:resource="http://cwrc.ca/ns/cw#'+certainty+'"/>';
        }
        
        var selectorString = ''+
        '\n<rdf:Description rdf:about="'+targetId+'">'+
            '\n\t<oa:hasSource rdf:resource="'+docId+'"/>'+
            '\n\t<rdf:type rdf:resource="http://www.w3.org/ns/oa#SpecificResource"/>'+
            '\n\t<oa:hasSelector rdf:resource="'+selectorId+'"/>'+
        '\n</rdf:Description>';
        if (range.endXPath) {
            selectorString += ''+
            '\n<rdf:Description rdf:about="'+selectorId+'">'+
                '\n\t<oa:start>xpointer(string-range('+range.startXPath+',"",'+range.startOffset+'))</oa:start>'+
                '\n\t<oa:end>xpointer(string-range('+range.endXPath+',"",'+range.endOffset+'))</oa:end>'+
                '\n\t<rdf:type rdf:resource="http://www.w3.org/ns/oa#TextPositionSelector"/>'+
            '\n</rdf:Description>';
        } else {
            selectorString += ''+
            '\n<rdf:Description rdf:about="'+selectorId+'">'+
                '\n\t<rdf:value>xpointer('+range.startXPath+')</rdf:value>'+
                '\n\t<rdf:type rdf:resource="http://www.w3.org/ns/oa#FragmentSelector"/>'+
            '\n</rdf:Description>';
        }
        
        var cwrcInfoString = '';
        if (cwrcInfo !== undefined) {
            delete cwrcInfo.data; // remove extra XML data
            var cwrcInfo = JSON.stringify(cwrcInfo);
            cwrcInfoString = '\n\t<cw:cwrcInfo>'+cwrcInfo+'</cw:cwrcInfo>';
        }
        
        var cwrcAttributesString = '';
        if (attributes != null) {
            var cwrcAttributes = JSON.stringify(attributes);
            cwrcAttributesString = '\n\t<cw:cwrcAttributes>'+cwrcAttributes+'</cw:cwrcAttributes>';
        }
        
        var rdfString = ''+
        '\n<rdf:RDF'+namespaceString+'>'+
            '\n<rdf:Description rdf:about="'+annotationId+'">'+
                '\n\t<oa:hasTarget rdf:resource="'+targetId+'"/>'+
                '\n\t<oa:hasBody rdf:resource="'+entityId+'"/>'+
                '\n\t<oa:annotatedBy rdf:resource="'+annotatedById+'"/>'+
                '\n\t<oa:annotatedAt>'+date+'</oa:annotatedAt>'+
                '\n\t<oa:serializedBy rdf:resource=""/>'+
                '\n\t<oa:serializedAt>'+date+'</oa:serializedAt>'+
                '\n\t<rdf:type rdf:resource="http://www.w3.org/ns/oa#Annotation"/>'+
                motivationsString+
                certaintyString+
                cwrcInfoString+
                cwrcAttributesString+
            '\n</rdf:Description>'+
            '\n<rdf:Description rdf:about="'+entityId+'">'+
                '\n\t<rdf:type rdf:resource="http://www.w3.org/ns/oa#SemanticTag"/>'+
                typesString+
            '\n</rdf:Description>'+
            selectorString+
        '\n</rdf:RDF>';
        
        annotation = $($.parseXML(rdfString));
    } else if (format === 'json') {
        types.push('oa:SemanticTag');
        
        annotation = {
            '@context': 'http://www.w3.org/ns/oa/oa.ttl',
            '@id': annotationId,
            '@type': 'oa:Annotation',
            'motivatedBy': motivations,
            'annotatedAt': date,
            'annotatedBy': {
                '@id': annotatedById,
                '@type': 'foaf:Person',
                'mbox': {
                    '@id': userMbox
                },
                'name': userName
            },
            'serializedAt': date,
            'serializedBy': '',
            'hasBody': {
                '@id': entityId,
                '@type': types
            },
            'hasTarget': {
                '@id': docId,
                '@type': 'oa:SpecificResource',
                'hasSource': {
                    '@id': docId,
                    '@type': 'dctypes:Text',
                      'format': 'text/xml'
                }
            }
        };
        
        if (certainty !== undefined) {
            annotation.hasCertainty = 'cw:'+certainty;
        }
        
        if (cwrcInfo !== undefined) {
            annotation.cwrcInfo = cwrcInfo;
        }
        
        if (attributes !== undefined) {
            annotation.cwrcAttributes = attributes;
        }
        
        if (range.endXPath) {
            annotation.hasTarget.hasSelector = {
                '@id': selectorId,
                '@type': 'oa:TextPositionSelector',
                'dcterms:conformsTo': 'http://tools.ietf.org/rfc/rfc3023',
                'oa:start': 'xpointer(string-range('+range.startXPath+',"",'+range.startOffset+'))',
                'oa:end': 'xpointer(string-range('+range.endXPath+',"",'+range.endOffset+'))',
            };
        } else {
            annotation.hasTarget.hasSelector = {
                '@id': selectorId,
                '@type': 'oa:FragmentSelector',
                'dcterms:conformsTo': 'http://tools.ietf.org/rfc/rfc3023',
                'rdf:value': 'xpointer('+range.startXPath+')'
            };
        }
    }
    
    return annotation;
};

AnnotationsManager.prototype = {
    constructor: AnnotationsManager,

    getResp: function() {
        return 'PLACEHOLDER_USER';
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
            anno = e.annotation(entity, format);
            if (format === 'xml') {
                anno = anno[0].firstChild; // convert from jquery obj
            }
        }
        return anno;
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
            'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            'cw': 'http://cwrc.ca/ns/cw#'
        };

        var rdfString = '';

        // xml mode
        var uri = this.w.cwrcRootUrl+'editor/documents/'+this.w.currentDocId;
        rdfString += ''+
        '<rdf:Description rdf:about="'+uri+'">'+
            '\n\t<cw:mode>'+this.w.mode+'</cw:mode>'+
            '\n\t<cw:allowOverlap>'+this.w.allowOverlap+'</cw:allowOverlap>'+
        '\n</rdf:Description>';

        var me = this;
        entities.forEach(function(entity) {
            if (entity.getUris().annotationId == null) {
                console.warn('getAnnotations: no annotationId for', entity);
                return;
            }
            var annotation = me.getAnnotation(entity, format);

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
                    rdfString += me.w.utilities.xmlToString(el);
                });
            } else if (format === 'json') {
                rdfString += '\n<rdf:Description rdf:datatype="http://www.w3.org/TR/json-ld/"><![CDATA[\n';
                rdfString += JSON.stringify(annotation, null, '\t');
                rdfString += '\n]]></rdf:Description>';
            }
        });

        // triples
        for (var i = 0; i < me.w.triples.length; i++) {
            var t = me.w.triples[i];

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
        // json-ld
        if (rdfEl.getAttribute('rdf:datatype') === 'http://www.w3.org/TR/json-ld/') {
            entityConfig = this._getEntityConfigFromJsonAnnotation(rdfEl);
        // rdf/xml
        } else if (rdfEl.getAttribute('rdf:about') !== null) {
            entityConfig = this._getEntityConfigFromXmlAnnotation(rdfEl);
        }
        return entityConfig;
    },

    /**
     * Parse JSON and get an Entity config object
     * @param {Element} rdfEl An RDF element containing JSON text
     * @returns {Object|null} Entity config object
     */
    _getEntityConfigFromJsonAnnotation: function(rdfEl) {
        var entityConfig = null;
        
        var rdf = $(rdfEl);
        var json = JSON.parse(rdf.text());
        if (json != null) {
            entityConfig = {};
            
            var rdfs = rdf.parent('rdf\\:RDF, RDF');
            var doc = rdfs.parents().last()[0].parentNode;
            
            // determine entity type
            var entityType = null;
            
            var bodyTypes = json.hasBody['@type'];
            var needsMotivation = bodyTypes.indexOf('cnt:ContentAsText') !== -1;
            if (needsMotivation) {
                bodyTypes = bodyTypes.concat(json.motivatedBy);
            }
            for (var i = 0; i < bodyTypes.length; i++) {
                var typeUri = bodyTypes[i];
                entityType = this.w.annotationsManager._getEntityTypeForAnnotation(typeUri);
                if (entityType != null) {
                    break;
                }
            }
            
            // get type specific info
            var typeInfo = {};
            var propObj = {};
            
            switch (entityType) {
            case 'date':
                var dateString = json.hasBody['xsd:date'];
                var dateParts = dateString.split('/');
                if (dateParts.length === 1) {
                    typeInfo.date = dateParts[0];
                } else {
                    typeInfo.startDate = dateParts[0];
                    typeInfo.endDate = dateParts[1];
                }
                break;
            case 'place':
                var precisionString = json.hasPrecision;
                if (precisionString && precisionString != '') {
                    precisionString = precisionString.split('#')[1];
                }
                propObj.precision = precisionString;
                break;
            case 'title':
                var levelString = json.hasBody.pubType;
                typeInfo.level = levelString;
                break;
            case 'correction':
                var corrString = json.hasBody['cnt:chars'];
                typeInfo.corrText = corrString;
                break;
            case 'keyword':
                var keywordsArray = json.hasBody['cnt:chars'];
                typeInfo.keywords = keywordsArray;
                break;
            case 'link':
                typeInfo.url = ''; // FIXME never used
                break;
            }
            
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
            
            // FIXME cwrcAttributes
            $.extend(propObj, typeInfo);

            entityConfig.type = entityType;
            entityConfig.isNote = this.w.schemaManager.mapper.isEntityTypeNote(entityConfig.type);
            entityConfig.attributes = json.cwrcAttributes;
            entityConfig.customValues = propObj;
            entityConfig.cwrcLookupInfo = json.cwrcInfo;
            entityConfig.range = rangeObj;
            entityConfig.uris = {}; // TODO
        }
        
        return entityConfig;
    },
    
    /**
     * Parse XML and create a Entity config object
     * @param {Element} xml An RDF element containing XML elements
     * @returns {Object|null} Entity config object
     */
    _getEntityConfigFromXmlAnnotation: function(xml) {
        var entityConfig = null;
        
        var rdf = $(xml);
        var aboutUri = rdf.attr('rdf:about');
        if (aboutUri.indexOf('id.cwrc.ca/annotation') !== -1) {
            var rdfs = rdf.parent('rdf\\:RDF, RDF');            
            var doc = rdfs.parents().last()[0].parentNode;

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
                var entityType = this.w.annotationsManager._getEntityTypeForAnnotation(typeUri);
                entityConfig = {};
    
                // get type specific info
                var typeInfo = {};
                var propObj = {};
                
                switch (entityType) {
                    case 'date':
                        var dateString = body.find('xsd\\:date, date').text();
                        var dateParts = dateString.split('/');
                        if (dateParts.length === 1) {
                            typeInfo.date = dateParts[0];
                        } else {
                            typeInfo.startDate = dateParts[0];
                            typeInfo.endDate = dateParts[1];
                        }
                        break;
                    case 'place':
                        var precisionString = rdf.find('cw\\:hasPrecision, hasPrecision').attr('rdf:resource');
                        if (precisionString && precisionString != '') {
                            precisionString = precisionString.split('#')[1];
                        }
                        propObj.precision = precisionString;
                        break;
                    case 'title':
                        var levelString = body.find('cw\\:pubType, pubType').text();
                        typeInfo.level = levelString;
                        break;
                    case 'correction':
                        var corrString = body.find('cnt\\:chars, chars').text();
                        typeInfo.corrText = corrString;
                        break;
                    case 'keyword':
                        var keywordsArray = [];
                        body.find('cnt\\:chars, chars').each(function() {
                            keywordsArray.push($(this).text());
                        });
                        typeInfo.keywords = keywordsArray;
                        break;
                    case 'link':
                        typeInfo.url = hasBodyUri; // FIXME never used
                        break;
                }
    
                // certainty
                var certainty = rdf.find('cw\\:hasCertainty, hasCertainty').attr('rdf:resource');
                if (certainty && certainty != '') {
                    certainty = certainty.split('#')[1];
                    if (certainty === 'reasonable') {
                        // fix for discrepancy between schemas
                        certainty = 'reasonably certain';
                    }
                    propObj.certainty = certainty;
                }
    
                // cwrcInfo (from cwrcDialogs lookups)
                var cwrcLookupObj = rdf.find('cw\\:cwrcInfo, cwrcInfo').text();
                if (cwrcLookupObj != '') {
                    cwrcLookupObj = JSON.parse(cwrcLookupObj);
                } else {
                    cwrcLookupObj = {};
                }
    
                // cwrcAttributes (catch-all for properties not fully supported in rdf yet
                var cwrcAttributes = rdf.find('cw\\:cwrcAttributes, cwrcAttributes').text();
                if (cwrcAttributes != '') {
                    cwrcAttributes = JSON.parse(cwrcAttributes);
                } else {
                    cwrcAttributes = {};
                }
    
                // selector and annotation uris
                // TODO no json-ld equivalent yet
                var docUri = target.find('oa\\:hasSource, hasSource').attr('rdf:resource');
                var selectorUri = target.find('oa\\:hasSelector, hasSelector').attr('rdf:resource');
                var selector = rdfs.find('[rdf\\:about="'+selectorUri+'"]');
                var selectorType = selector.find('rdf\\:type, type').attr('rdf:resource');
                var annotationObj = {
                    entityId: hasBodyUri,
                    annotationId: aboutUri,
                    targetId: hasTargetUri,
                    docId: docUri,
                    selectorId: selectorUri,
                    userId: ''
                };
    
                // range
                var rangeObj = {};
                // matching element
                if (selectorType.indexOf('FragmentSelector') !== -1) {                    
                    var xpointer = selector.find('rdf\\:value, value').text();
                    rangeObj = this._getRangeObject(xpointer);
                // offset
                } else {
                    var xpointerStart = selector.find('oa\\:start, start').text();
                    var xpointerEnd = selector.find('oa\\:end, end').text();
                    rangeObj = this._getRangeObject(xpointerStart, xpointerEnd);
                }
    
                // FIXME cwrcAttributes
                $.extend(propObj, typeInfo);

                entityConfig.type = entityType;
                entityConfig.isNote = this.w.schemaManager.mapper.isEntityTypeNote(entityConfig.type);
                entityConfig.attributes = cwrcAttributes;
                entityConfig.customValues = propObj;
                entityConfig.cwrcLookupInfo = cwrcLookupObj;
                entityConfig.range = rangeObj;
                entityConfig.uris = annotationObj;
            }
        }
        
        return entityConfig;
    },

    /**
     * Returns the entity type, using a annotation string.
     * @param {String} annotation The annotation string, e.g. 'foaf:Person'
     * @returns {String}
     */
    _getEntityTypeForAnnotation: function(annotation) {
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
        for (var entityType in AnnotationsManager.types) {
            if (AnnotationsManager.types[entityType] === annotation) {
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
    },
    
    /**
     * TODO remove this
     * Parses the RDF and adds entities to the EntitiesManager.
     * Also processes any relations/triples.
     * @param {Element} rdfEl RDF parent element
     * @param {Boolean} [isLegacyDocument] True if this is a legacy document (i.e. it uses annotationId)
     */
    /*
    setAnnotations: function(rdfEl, isLegacyDocument) {
        isLegacyDocument = isLegacyDocument === undefined ? false : isLegacyDocument;

        this.w.entitiesManager.reset();
        
        var rdfs = $(rdfEl);
        
        var root = rdfs.parents().last()[0];
        var doc = root.parentNode;

        var triples = [];
        var noteChildEntities = [];

        rdfs.children().each(function(index, el) {
            var rdf = $(el);
            var entityConfig = this.getEntityConfigFromAnnotation(rdf);
            if (entityConfig != null) {
                if (isLegacyDocument) {
                    // replace annotationId with xpath
                    var entityEl = this.w.utilities.evaluateXPath(doc, entityConfig.range.startXPath);
                    entityConfig.range.startXPath = this.w.utilities.getElementXPath(entityEl);
                    if (entityConfig.range.endXPath !== undefined) {
                        var entityElEnd = this.w.utilities.evaluateXPath(doc, entityConfig.range.endXPath);
                        entityConfig.range.endXPath = this.w.utilities.getElementXPath(entityElEnd);
                    }
                }
                this.w.entitiesManager.addEntity(entityConfig);
            } else if (rdf.attr('cw:external')) {
                triples.push(rdf);
            }
        }.bind(this));

        // process triples

        this.w.triples = [];
        for (var i = 0; i < triples.length; i++) {
            var subject = triples[i];
            var subjectUri = subject.attr('rdf:about');
            var predicate = subject.children().first();
            var object = subject.find('rdf\\:Description, Description');
            var objectUri = object.attr('rdf:about');

            var subEnt = null;
            var objEnt = null;
            this.w.entitiesManager.eachEntity(function(id, ent) {
                if (ent.getUris().annotationId === subjectUri) {
                    subEnt = ent;
                }
                if (ent.getUris().annotationId === objectUri) {
                    objEnt = ent;
                }
                if (subEnt != null && objEnt != null) {
                    return false;
                }
            });

            if (subEnt != null && objEnt != null) {
                var subExt = subject.attr('cw:external') == 'true' ? true : false;
                var predExt = predicate.attr('cw:external') == 'true' ? true : false;
                var objExt = object.attr('cw:external') == 'true' ? true : false;
                var triple = {
                    subject: {
                        uri: subjectUri,
                        text: subExt ? subjectUri : subEnt.getTitle(),
                        external: subExt
                    },
                    predicate: {
                        text: predicate.attr('cw:text'),
                        name: predicate[0].nodeName.split(':')[1],
                        external: predExt
                    },
                    object: {
                        uri: objectUri,
                        text: objExt ? objectUri : objEnt.getTitle(),
                        external: objExt
                    }
                };
                this.w.triples.push(triple);
            }
        }
    }
    */
};

module.exports = AnnotationsManager;
