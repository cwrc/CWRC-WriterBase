var $ = require('jquery');
var Mapper = require('../mapper.js');
var AnnotationsManager = require('annotationsManager');

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

id: 'ID',
responsibility: 'RESP',
rdfParentSelector: '/*/ORLANDOHEADER/FILEDESC/following-sibling::XENODATA',
root: ['EVENT', 'BIOGRAPHY', 'WRITING'],
header: 'ORLANDOHEADER',
blockElements: ['DIV0', 'DIV1', 'EVENT', 'ORLANDOHEADER', 'DOCAUTHOR', 'DOCEDITOR', 'DOCEXTENT', 'PUBLICATIONSTMT', 'TITLESTMT', 'PUBPLACE', 'L', 'P', 'HEADING', 'CHRONEVENT', 'CHRONSTRUCT'],
urlAttributes: ['URL', 'REF'],
popupAttributes: ['PLACEHOLDER'],
popupElements: ['RESEARCHNOTE', 'SCHOLARNOTE'],

listeners: {
    tagAdded: function(tag) {
        var $tag = $(tag);
        if ($tag.attr('_tag') === 'GRAPHIC') {
            handleGraphics($tag);
        }
    },
    tagEdited: function(tag) {
        var $tag = $(tag);
        if ($tag.attr('_tag') === 'GRAPHIC') {
            handleGraphics($tag);
        }
    },
    documentLoaded: function(success, body) {
        $(body).find('*[_tag="GRAPHIC"]').each(function(index, el) {
            handleGraphics($(el));
        });
    }
},

entities: {
    
person: {
    parentTag: 'NAME',
    mapping: {
        uri: '@REF',
        lemma: '@STANDARD'
    },
    annotation: function(annotationsManager, entity, format) {
        return annotationsManager.commonAnnotation(entity, format, 'foaf:Person');
    }
},

org: {
    parentTag: 'ORGNAME',
    mapping: {
        uri: '@REF',
        lemma: '@STANDARD'
    },
    annotation: function(annotationsManager, entity, format) {
        return annotationsManager.commonAnnotation(entity, format, 'foaf:Organization');
    }
},

place: {
    parentTag: 'PLACE',
    textTag: ['ADDRESS', 'AREA', 'GEOG', 'PLACENAME', 'REGION', 'SETTLEMENT'],
    mappingFunction: function(entity) {
        var placeType = entity.getCustomValue('placeType') || 'ADDRESS';

        var startTag = Mapper.getTagAndDefaultAttributes(entity);
        startTag += '<'+placeType+'>';

        var endTag = '</'+placeType+'></'+entity.getTag()+'>';
        
        return [startTag, endTag];
    },
    mapping: {
        uri: '@REF',
        lemma: '@REG',
        customValues: {placeType: 'local-name(./*)'}
    },
    annotation: function(annotationsManager, entity, format) {
        return annotationsManager.commonAnnotation(entity, format, 'geo:SpatialThing');
    }
},

title: {
    parentTag: 'TITLE',
    mapping: {
        uri: '@REF',
        lemma: '@REG'
    },
    annotation: function(annotationsManager, entity, format) {
        var anno = annotationsManager.commonAnnotation(entity, format, ['dcterms:BibliographicResource', 'dcterms:title'], 'oa:identifying');
        
        if (format === 'xml') {
            var levelXml = $.parseXML('<cw:pubType xmlns:cw="http://cwrc.ca/ns/cw#">'+entity.getAttribute('TITLETYPE')+'</cw:pubType>');
            var body = $('[rdf\\:about="'+entity.getUris().entityId+'"]', anno);
            body.prepend(levelXml.firstChild);
        } else {
            anno['oa:hasBody']['pubType'] = entity.getAttribute('TITLETYPE');
        }
        
        return anno;
    }
},

date: {
    xpathSelector: 'self::orlando:DATE|self::orlando:DATERANGE|self::orlando:DATESTRUCT',
    parentTag: ['DATE', 'DATERANGE', 'DATESTRUCT'],
    mapping: {
        tag: 'local-name(.)'
    },
    annotation: function(annotationsManager, entity, format) {
        var types = [];
        if (entity.getAttribute('FROM') !== undefined) {
            types.push('time:Interval');
        } else {
            types.push('time:Instant');
        }
        types.push('time:TemporalEntity');
        
        var anno = annotationsManager.commonAnnotation(entity, format, types);
        
        if (format === 'xml') {
            var dateXml;
            if (entity.getAttribute('VALUE') !== undefined) {
                dateXml = $.parseXML('<xsd:date xmlns:xsd="http://www.w3.org/2001/XMLSchema#">'+entity.getAttribute('VALUE')+'</xsd:date>');
            } else {
                // TODO properly encode date range
                dateXml = $.parseXML('<xsd:date xmlns:xsd="http://www.w3.org/2001/XMLSchema#">'+entity.getAttribute('FROM')+'/'+entity.getAttribute('TO')+'</xsd:date>');
            }
            var body = $('[rdf\\:about="'+entity.getUris().entityId+'"]', anno);
            body.prepend(dateXml.firstChild);
        } else {
            if (entity.getAttribute('VALUE') !== undefined) {
                anno['oa:hasBody']['xsd:date'] = entity.getAttribute('VALUE');
            } else {
                anno['oa:hasBody']['xsd:date'] = entity.getAttribute('FROM')+'/'+entity.getAttribute('TO');
            }
        }
        
        return anno;
    }
},

note: {
    xpathSelector: 'self::orlando:RESEARCHNOTE|self::orlando:SCHOLARNOTE',
    parentTag: ['RESEARCHNOTE', 'SCHOLARNOTE'],
    isNote: true,
    mapping: {
        tag: 'local-name(.)',
        noteContent: '.'
    },
    annotation: function(annotationsManager, entity, format) {
        return annotationsManager.commonAnnotation(entity, format, 'bibo:Note', 'oa:commenting');
    }
},

citation: {
    parentTag: 'BIBCIT',
    isNote: true,
    mapping: {
        uri: '@REF',
        noteContent: '.'
    },
    annotation: function(annotationsManager, entity, format) {
        return annotationsManager.commonAnnotation(entity, format, 'dcterms:BibliographicResource', 'cw:citing');
    }
},

correction: {
    parentTag: 'SIC',
    annotation: function(annotationsManager, entity, format) {
        var anno = annotationsManager.commonAnnotation(entity, format, 'cnt:ContentAsText', 'oa:editing');
        
        if (format === 'xml') {
            var corrXml = $.parseXML('<cnt:chars xmlns:cnt="http://www.w3.org/2011/content#">'+entity.getAttribute('CORR')+'</cnt:chars>');
            var body = $('[rdf\\:about="'+entity.getUris().entityId+'"]', anno);
            body.prepend(corrXml.firstChild);
        } else {
            anno['oa:hasBody']['cnt:chars'] = entity.getAttribute('CORR');
        }

        return anno;
    }
},

keyword: {
    parentTag: 'KEYWORDCLASS',
    isNote: true,
    annotation: function(annotationsManager, entity, format) {
        var anno = annotationsManager.commonAnnotation(entity, format, ['oa:Tag', 'cnt:ContentAsText', 'skos:Concept'], 'oa:classifying');
        
        var keyword = entity.getAttribute('KEYWORDTYPE');
        if (format === 'xml') {
            var body = $('[rdf\\:about="'+entity.getUris().entityId+'"]', anno);
            var keywordXml = $.parseXML('<cnt:chars xmlns:cnt="http://www.w3.org/2011/content#">'+keyword+'</cnt:chars>');
            body.prepend(keywordXml.firstChild);
        } else {
            anno['oa:hasBody']['cnt:chars'] = keyword;
        }

        return anno;
    }
},

link: {
    parentTag: 'XREF',
    annotation: function(annotationsManager, entity, format) {
        return annotationsManager.commonAnnotation(entity, format, 'cnt:ContentAsText', 'oa:linking');
    }
}

}

};
