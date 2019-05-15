var $ = require('jquery');
var Mapper = require('../mapper.js');

// TODO add resp for note type entities
    
function handleGraphics($tag) {
    var url = $tag.attr('url');
    if (url !== undefined) {
        $tag.css('backgroundImage','url('+url+')');
        $tag.css('display','inline-block');
        var $img = $('<img />');
        $img.hide();
        $img.on('load', function() {
            var height = $(this).height();
            var width = $(this).width();
            $tag.width(width);
            $tag.height(height);
            $img.remove();
        });
        $('body').append($img);
        $img.attr('src', url);
    }
}

module.exports = {

id: 'xml:id',
rdfParentSelector: '/TEI/teiHeader/fileDesc/following-sibling::xenoData',
header: 'teiHeader',
blockElements: ['argument', 'back', 'bibl', 'biblFull', 'biblScope', 'body', 'byline', 'category', 'change', 'cit', 'classCode', 'elementSpec', 'macroSpec', 'classSpec', 'closer', 'creation', 'date', 'distributor', 'div', 'div1', 'div2', 'div3', 'div4', 'div5', 'div6', 'div7', 'docAuthor', 'edition', 'editionStmt', 'editor', 'eg', 'epigraph', 'extent', 'figure', 'front', 'funder', 'group', 'head', 'dateline', 'idno', 'item', 'keywords', 'l', 'label', 'langUsage', 'lb', 'lg', 'list', 'listBibl', 'note', 'noteStmt', 'opener', 'p', 'principal', 'publicationStmt', 'publisher', 'pubPlace', 'q', 'rendition', 'resp', 'respStmt', 'salute', 'samplingDecl', 'seriesStmt', 'signed', 'sp', 'sponsor', 'tagUsage', 'taxonomy', 'textClass', 'titlePage', 'titlePart', 'trailer', 'TEI', 'teiHeader', 'text', 'authority', 'availability', 'fileDesc', 'sourceDesc', 'revisionDesc', 'catDesc', 'encodingDesc', 'profileDesc', 'projectDesc', 'docDate', 'docEdition', 'docImprint', 'docTitle'],
urlAttributes: ['ref', 'target'],
popupAttributes: [],

listeners: {
    tagAdded: function(tag) {
        var $tag = $(tag);
        if ($tag.attr('_tag') === 'graphic') {
            handleGraphics($tag);
        }
    },
    tagEdited: function(tag) {
        var $tag = $(tag);
        if ($tag.attr('_tag') === 'graphic') {
            handleGraphics($tag);
        }
    },
    documentLoaded: function(success, body) {
        $(body).find('*[_tag="graphic"]').each(function(index, el) {
            handleGraphics($(el));
        });
    }
},

entities: {
    
person: {
    parentTag: 'persName',
    mapping: {
        uri: '@ref',
        lemma: '@key',
        certainty: '@cert'
    },
    annotation: function(annotationsManager, entity, format) {
        return annotationsManager.commonAnnotation(entity, format, 'foaf:Person');
    }
},

org: {
    parentTag: 'orgName',
    mapping: {
        uri: '@ref',
        lemma: '@key',
        certainty: '@cert'
    },
    annotation: function(annotationsManager, entity, format) {
        return annotationsManager.commonAnnotation(entity, format, 'foaf:Organization');
    }
},

place: {
    parentTag: 'placeName',
    mappingFunction: function(entity) {
        var startTag = Mapper.getTagAndDefaultAttributes(entity);
        
        var endTag = '';
        var precision = entity.getCustomValue('precision');
        if (precision !== undefined) {
            endTag += '<precision precision="'+precision+'" />';
        }
        var tag = entity.getTag();
        endTag += '</'+tag+'>';
        
        return [startTag, endTag];
    },
    mapping: {
        uri: '@ref',
        lemma: '@key',
        certainty: '@cert',
        customValues: {precision: 'precision/@precision'}
    },
    annotation: function(annotationsManager, entity, format) {
        var anno = annotationsManager.commonAnnotation(entity, format, 'geo:SpatialThing');
        
        var precision = entity.getCustomValue('precision');
        if (precision !== undefined) {
            if (format === 'xml') {
                var precisionXml = $.parseXML('<cw:hasPrecision xmlns:cw="http://cwrc.ca/ns/cw#" rdf:resource="http://cwrc.ca/ns/cw#'+precision+'" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/>');
                // remove rdf namespace as it's included in parent and only needed to parse this XML
                precisionXml.firstChild.attributes.removeNamedItem('xmlns:rdf');
                var body = $('[rdf\\:about="'+entity.getUris().annotationId+'"]', anno);
                body.append(precisionXml.firstChild);
            } else {
                anno.hasPrecision = 'cw:'+precision;
            }
        }
        
        return anno;
    }
},

title: {
    parentTag: 'title',
    mapping: {
        uri: '@ref',
        lemma: '@key',
        certainty: '@cert'
    },
    annotation: function(annotationsManager, entity, format) {
        var anno = annotationsManager.commonAnnotation(entity, format, 'dcterms:title');
        
        if (format === 'xml') {
            var levelXml = $.parseXML('<cw:pubType xmlns:cw="http://cwrc.ca/ns/cw#">'+entity.getAttribute('level')+'</cw:pubType>');
            var body = $('[rdf\\:about="'+entity.getUris().entityId+'"]', anno);
            body.prepend(levelXml.firstChild);
        } else {
            anno.hasBody['pubType'] = entity.getAttribute('level');
        }
        
        return anno;
    }
},

correction: {
    xpathSelector: 'self::tei:choice|self::tei:corr',
    parentTag: ['choice', 'corr'],
    textTag: 'sic',
    requiresSelection: false,
    mappingFunction: function(entity) {
        var corrText = entity.getCustomValue('corrText');
        var sicText = entity.getCustomValue('sicText');
        
        var tag;
        if (sicText) {
            tag = 'choice';
        } else {
            tag = 'corr';
        }
        
        var startTag = '<'+tag+Mapper.getAttributeString(entity.getAttributes())+'>';
        var endTag = '';
        
        if (sicText) {
            startTag += '<sic>';
            endTag = '</sic><corr>'+corrText+'</corr></choice>';
        } else {
            endTag = '</'+tag+'>';
        }
        
        return [startTag, endTag];
    },
    mapping: {
        customValues: {
            sicText: 'sic/text()',
            corrText: 'corr/text()'
        }
    },
    annotation: function(annotationsManager, entity, format) {
        var anno = annotationsManager.commonAnnotation(entity, format, 'cnt:ContentAsText', 'oa:editing');
        
        if (format === 'xml') {
            var corrXml = $.parseXML('<cnt:chars xmlns:cnt="http://www.w3.org/2011/content#">'+entity.getCustomValue('corrText')+'</cnt:chars>');
            var body = $('[rdf\\:about="'+entity.getUris().entityId+'"]', anno);
            body.prepend(corrXml.firstChild);
        } else {
            anno.hasBody['cnt:chars'] = entity.getCustomValue('corrText');
        }

        return anno;
    }
},

link: {
    parentTag: 'ref',
    annotation: function(annotationsManager, entity, format) {
        return annotationsManager.commonAnnotation(entity, format, 'cnt:ContentAsText', 'oa:linking');
    }
},

date: {
    parentTag: 'date',
    annotation: function(annotationsManager, entity, format) {
        var types = [];
        if (entity.getAttribute('when') !== undefined) {
            types.push('time:Instant');
        } else {
            types.push('time:Interval');
        }
        types.push('time:TemporalEntity');
        
        var anno = annotationsManager.commonAnnotation(entity, format, types);
        
        if (format === 'xml') {
            var dateXml;
            if (entity.getAttribute('when') !== undefined) {
                dateXml = $.parseXML('<xsd:date xmlns:xsd="http://www.w3.org/2001/XMLSchema#">'+entity.getAttribute('when')+'</xsd:date>');
            } else {
                // TODO properly encode date range
                dateXml = $.parseXML('<xsd:date xmlns:xsd="http://www.w3.org/2001/XMLSchema#">'+entity.getAttribute('from')+'/'+entity.getAttribute('to')+'</xsd:date>');
            }
            var body = $('[rdf\\:about="'+entity.getUris().entityId+'"]', anno);
            body.prepend(dateXml.firstChild);
        } else {
            if (entity.getAttribute('when') !== undefined) {
                anno.hasBody['xsd:date'] = entity.getAttribute('when');
            } else {
                anno.hasBody['xsd:date'] = entity.getAttribute('from')+'/'+entity.getAttribute('to');
            }
        }
        
        return anno;
    }
},

note: {
    parentTag: 'note',
    xpathSelector: 'self::tei:note[not(@type="citation")]',
    isNote: true,
    requiresSelection: false,
    annotation: function(annotationsManager, entity, format) {
        return annotationsManager.commonAnnotation(entity, format, 'bibo:Note');
    }
},

citation: {
    parentTag: 'note',
    xpathSelector: 'self::tei:note[@type="citation"]/tei:bibl',
    textTag: 'bibl',
    isNote: true,
    requiresSelection: false,
    mappingFunction: function(entity) {
        var startTag = Mapper.getTagAndDefaultAttributes(entity)+'<bibl>';
        var lookupId = entity.getURI();
        if (lookupId) {
            startTag += '<ref target="'+lookupId+'"/>';
        }
        var endTag = '</bibl></note>';
        return [startTag, endTag];
    },
    mapping: {
        uri: 'bibl/ref/@target',
        certainty: '@cert',
        noteContent: '.'
    },
    annotation: function(annotationsManager, entity, format) {
        return annotationsManager.commonAnnotation(entity, format, 'dcterms:BibliographicResource');
    }
},

keyword: {
    parentTag: 'seg',
    xpathSelector: 'self::tei:seg/tei:term',
    textTag: 'term',
    isNote: true,
    requiresSelection: false,
    mappingFunction: function(entity) {
        var startTag = Mapper.getTagAndDefaultAttributes(entity)+'<term>';
        var endTag = '</term></seg>';
        return [startTag, endTag];
    },
    mapping: {
        noteContent: 'term/text()'
    },
    annotation: function(annotationsManager, entity, format) {
        var anno = annotationsManager.commonAnnotation(entity, format, ['oa:Tag', 'cnt:ContentAsText', 'skos:Concept']);
        
        var term = entity.getContent();
        if (format === 'xml') {
            var body = $('[rdf\\:about="'+entity.getUris().entityId+'"]', anno);
            var termXML = $.parseXML('<cnt:chars xmlns:cnt="http://www.w3.org/2011/content#">'+term+'</cnt:chars>');
            body.prepend(termXML.firstChild);
        } else {
            anno.hasBody['cnt:chars'] = term;
        }

        return anno;
    }
}

}

};
