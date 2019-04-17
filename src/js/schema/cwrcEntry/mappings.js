var $ = require('jquery');
var Mapper = require('../mapper.js');
var AnnotationsManager = require('../../annotationsManager.js');

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
rdfParentSelector: '/CWRC/CWRCHEADER',
header: 'CWRCHEADER',
blockElements: [],
urlAttributes: ['URL', 'REF'],
popupAttributes: [],
popupElements: [],

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
    mapping: function(entity) {
        return Mapper.getDefaultMapping(entity);
    },
    reverseMapping: {},
    annotation: function(entity, format) {
        return AnnotationsManager.commonAnnotation(entity, 'foaf:Person', null, format);
    }
},

org: {
    parentTag: 'ORGNAME',
    mapping: function(entity) {
        return Mapper.getDefaultMapping(entity);
    },
    reverseMapping: {},
    annotation: function(entity, format) {
        return AnnotationsManager.commonAnnotation(entity, 'foaf:Organization', null, format);
    }
},

place: {
    parentTag: 'PLACE',
    mapping: function(entity) {
        return Mapper.getDefaultMapping(entity);
    },
    reverseMapping: {},
    annotation: function(entity, format) {
        return AnnotationsManager.commonAnnotation(entity, 'geo:SpatialThing', null, format);
    }
},

title: {
    parentTag: 'TITLE',
    mapping: function(entity) {
        return Mapper.getDefaultMapping(entity);
    },
    reverseMapping: {},
    annotation: function(entity, format) {
        var anno = AnnotationsManager.commonAnnotation(entity, ['dcterms:BibliographicResource', 'dcterms:title'], 'oa:identifying', format);
        
        if (format === 'xml') {
            var levelXml = $.parseXML('<cw:pubType xmlns:cw="http://cwrc.ca/ns/cw#">'+entity.getAttribute('TITLETYPE')+'</cw:pubType>');
            var body = $('[rdf\\:about="'+entity.getUris().entityId+'"]', anno);
            body.prepend(levelXml.firstChild);
        } else {
            anno.hasBody['pubType'] = entity.getAttribute('TITLETYPE');
        }
        
        return anno;
    }
},

date: {
    xpathSelector: 'self::cwrcEntry:DATE|self::cwrcEntry:DATERANGE',
    parentTag: ['DATE', 'DATERANGE'],
    mapping: function(entity) {
        return Mapper.getDefaultMapping(entity);
    },
    reverseMapping: {
        properties: {tag: 'fn:node-name(.)'}
    },
    annotation: function(entity, format) {
        var types = [];
        if (entity.getAttribute('FROM') !== undefined) {
            types.push('time:Interval');
        } else {
            types.push('time:Instant');
        }
        types.push('time:TemporalEntity');
        
        var anno = AnnotationsManager.commonAnnotation(entity, types, null, format);
        
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
                anno.hasBody['xsd:date'] = entity.getAttribute('VALUE');
            } else {
                anno.hasBody['xsd:date'] = entity.getAttribute('FROM')+'/'+entity.getAttribute('TO');
            }
        }
        
        return anno;
    }
},

note: {
    xpathSelector: 'self::cwrcEntry:RESEARCHNOTE|self::cwrcEntry:SCHOLARNOTE',
    parentTag: ['RESEARCHNOTE', 'SCHOLARNOTE'],
    isNote: true,
    mapping: function(entity) {
        return Mapper.getDefaultMapping(entity);
    },
    reverseMapping: {
        customValues: {parent: 'fn:node-name(.)'},
        noteContent: '.'
    },
    annotation: function(entity, format) {
        return AnnotationsManager.commonAnnotation(entity, 'bibo:Note', 'oa:commenting', format);
    }
},

citation: {
    parentTag: 'BIBCIT',
    isNote: true,
    mapping: function(entity) {
        return Mapper.getDefaultMapping(entity);
    },
    reverseMapping: {
        cwrcInfo: {id: 'cwrc:BIBCIT/@REF'},
        noteContent: '.'
    },
    annotation: function(entity, format) {
        return AnnotationsManager.commonAnnotation(entity, 'dcterms:BibliographicResource', 'cw:citing', format);
    }
},

correction: {
    parentTag: 'SIC',
    mapping: function(entity) {
        return Mapper.getDefaultMapping(entity);
    },
    reverseMapping: {},
    annotation: function(entity, format) {
        var anno = AnnotationsManager.commonAnnotation(entity, 'cnt:ContentAsText', 'oa:editing', format);
        
        if (format === 'xml') {
            var corrXml = $.parseXML('<cnt:chars xmlns:cnt="http://www.w3.org/2011/content#">'+entity.getAttribute('CORR')+'</cnt:chars>');
            var body = $('[rdf\\:about="'+entity.getUris().entityId+'"]', anno);
            body.prepend(corrXml.firstChild);
        } else {
            anno.hasBody['cnt:chars'] = entity.getAttribute('CORR');
        }

        return anno;
    }
},

keyword: {
    parentTag: 'KEYWORDCLASS',
    isNote: true,
    mapping: function(entity) {
        return Mapper.getDefaultMapping(entity);
    },
    reverseMapping: {},
    annotation: function(entity, format) {
        var anno = AnnotationsManager.commonAnnotation(entity, ['oa:Tag', 'cnt:ContentAsText', 'skos:Concept'], 'oa:classifying', format);
        
        var keyword = entity.getAttribute('KEYWORDTYPE');
        if (format === 'xml') {
            var body = $('[rdf\\:about="'+entity.getUris().entityId+'"]', anno);
            var keywordXml = $.parseXML('<cnt:chars xmlns:cnt="http://www.w3.org/2011/content#">'+keyword+'</cnt:chars>');
            body.prepend(keywordXml.firstChild);
        } else {
            anno.hasBody['cnt:chars'] = keyword;
        }

        return anno;
    }
},

link: {
    parentTag: 'XREF',
    mapping: function(entity) {
        return Mapper.getDefaultMapping(entity);
    },
    reverseMapping: {},
    annotation: function(entity, format) {
        return AnnotationsManager.commonAnnotation(entity, 'cnt:ContentAsText', 'oa:linking', format);
    }
}

}

};
