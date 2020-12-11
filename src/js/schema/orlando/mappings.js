const $ = require('jquery');
const Mapper = require('../mapper.js');


const handleGraphics = $tag => {
    const url = $tag.attr('url');
    if (url !== undefined) {
        $tag.css('backgroundImage', `url(${url})`);
        $tag.css('display', 'inline-block');
        const $img = $('<img />');
        $img.hide();
        $img.on('load', function () {
            const height = $(this).height();
            const width = $(this).width();
            $tag.width(width);
            $tag.height(height);
            $img.remove();
        });
        $('body').append($img);
        $img.attr('src', url);
    }
};

const mapping = {

    id: 'ID',
    responsibility: 'RESP',
    rdfParentSelector: '/*/ORLANDOHEADER/FILEDESC/following-sibling::XENODATA',
    root: ['ENTRY', 'EVENT', 'BIOGRAPHY', 'WRITING'],
    header: 'ORLANDOHEADER',
    blockElements: ['DIV0', 'DIV1', 'EVENT', 'ORLANDOHEADER', 'DOCAUTHOR', 'DOCEDITOR', 'DOCEXTENT', 'PUBLICATIONSTMT', 'TITLESTMT', 'PUBPLACE', 'L', 'P', 'HEADING', 'CHRONEVENT', 'CHRONSTRUCT'],
    urlAttributes: ['URL', 'REF'],
    popupAttributes: ['PLACEHOLDER'],
    popupElements: ['RESEARCHNOTE', 'SCHOLARNOTE'],

    listeners: {
        tagAdded: tag => {
            const $tag = $(tag);
            if ($tag.attr('_tag') === 'GRAPHIC') handleGraphics($tag);
        },
        tagEdited: tag => {
            const $tag = $(tag);
            if ($tag.attr('_tag') === 'GRAPHIC') handleGraphics($tag);
        },
        documentLoaded: (success, body) => {
            $(body).find('*[_tag="GRAPHIC"]').each((index, el) => {
                handleGraphics($(el));
            });
        }
    },

    entities: {

        person: {
            label: 'Person',
            parentTag: 'NAME',
            mapping: {
                uri: '@REF',
                lemma: '@STANDARD'
            },
            annotation: (annotationsManager, entity, format) => {
                return annotationsManager.commonAnnotation(entity, 'foaf:Person');
            }
        },

        place: {
            label: 'Place',
            parentTag: 'PLACE',
            textTag: ['ADDRESS', 'AREA', 'GEOG', 'PLACENAME', 'REGION', 'SETTLEMENT'],
            mappingFunction: (entity) => {
                const placeType = entity.getCustomValue('placeType') || 'ADDRESS';

                let startTag = Mapper.getTagAndDefaultAttributes(entity);
                startTag += `<${placeType}>`;

                const endTag = `</${placeType}></${entity.getTag()}>`;

                return [startTag, endTag];
            },
            mapping: {
                uri: '@REF',
                lemma: '@REG',
                customValues: {
                    placeType: 'local-name(./*)'
                }
            },
            annotation: (annotationsManager, entity, format) => {
                return annotationsManager.commonAnnotation(entity, 'geo:SpatialThing');
            }
        },

        org: {
            label: 'Organization',
            parentTag: 'ORGNAME',
            mapping: {
                uri: '@REF',
                lemma: '@STANDARD'
            },
            annotation: (annotationsManager, entity, format) => {
                return annotationsManager.commonAnnotation(entity, 'foaf:Organization');
            }
        },

        title: {
            label: 'Title',
            parentTag: 'TITLE',
            mapping: {
                uri: '@REF',
                lemma: '@REG'
            },
            annotation: (annotationsManager, entity, format) => {
                const anno = annotationsManager.commonAnnotation(entity, ['dcterms:BibliographicResource', 'dcterms:title'], 'oa:identifying');

                if (format === 'xml') {
                    const levelXml = $.parseXML(`<cw:pubType xmlns:cw="http://cwrc.ca/ns/cw#">${entity.getAttribute('TITLETYPE')}</cw:pubType>`);
                    const body = $(`[rdf\\:about="${entity.getUris().entityId}"]`, anno);
                    body.prepend(levelXml.firstChild);
                } else {
                    anno['oa:hasBody']['pubType'] = entity.getAttribute('TITLETYPE');
                }

                return anno;
            }
        },

        citation: {
            label: 'Citation',
            parentTag: 'BIBCIT',
            isNote: true,
            mapping: {
                uri: '@REF',
                noteContent: '.'
            },
            annotation: (annotationsManager, entity, format) => {
                return annotationsManager.commonAnnotation(entity, 'dcterms:BibliographicResource', 'cw:citing');
            }
        },

        note: {
            label: 'Note',
            parentTag: ['RESEARCHNOTE', 'SCHOLARNOTE'],
            xpathSelector: 'self::orlando:RESEARCHNOTE|self::orlando:SCHOLARNOTE',
            isNote: true,
            mapping: {
                tag: 'local-name(.)',
                noteContent: '.'
            },
            annotation: (annotationsManager, entity) => {
                return annotationsManager.commonAnnotation(entity, 'bibo:Note', 'oa:commenting');
            }
        },

        date: {
            label: 'Date',
            xpathSelector: 'self::orlando:DATE|self::orlando:DATERANGE|self::orlando:DATESTRUCT',
            parentTag: ['DATE', 'DATERANGE', 'DATESTRUCT'],
            mapping: {
                tag: 'local-name(.)'
            },
            annotation: (annotationsManager, entity, format) => {
                let types = [];
                if (entity.getAttribute('FROM') !== undefined) {
                    types.push('time:Interval');
                } else {
                    types.push('time:Instant');
                }
                types.push('time:TemporalEntity');

                const anno = annotationsManager.commonAnnotation(entity, types);

                if (format === 'xml') {
                    let dateXml;
                    if (entity.getAttribute('VALUE') !== undefined) {
                        dateXml = $.parseXML(`<xsd:date xmlns:xsd="http://www.w3.org/2001/XMLSchema#">${entity.getAttribute('VALUE')}</xsd:date>`);
                    } else {
                        // TODO properly encode date range
                        dateXml = $.parseXML(`<xsd:date xmlns:xsd="http://www.w3.org/2001/XMLSchema#">${entity.getAttribute('FROM')}/${entity.getAttribute('TO')}</xsd:date>`);
                    }
                    const body = $(`[rdf\\:about="${entity.getUris().entityId}"]`, anno);
                    body.prepend(dateXml.firstChild);
                } else {
                    if (entity.getAttribute('VALUE') !== undefined) {
                        anno['oa:hasBody']['xsd:date'] = entity.getAttribute('VALUE');
                    } else {
                        anno['oa:hasBody']['xsd:date'] = `${entity.getAttribute('FROM')}/${entity.getAttribute('TO')}`;
                    }
                }

                return anno;
            }
        },

        correction: {
            label: 'Correction',
            parentTag: 'SIC',
            annotation: (annotationsManager, entity, format) => {
                const anno = annotationsManager.commonAnnotation(entity, 'cnt:ContentAsText', 'oa:editing');

                if (format === 'xml') {
                    const corrXml = $.parseXML(`<cnt:chars xmlns:cnt="http://www.w3.org/2011/content#">${entity.getAttribute('CORR')}</cnt:chars>`);
                    const body = $(`[rdf\\:about="${entity.getUris().entityId}"]`, anno);
                    body.prepend(corrXml.firstChild);
                } else {
                    anno['oa:hasBody']['cnt:chars'] = entity.getAttribute('CORR');
                }

                return anno;
            }
        },

        keyword: {
            label: 'Keyword',
            parentTag: 'KEYWORDCLASS',
            isNote: true,
            annotation: (annotationsManager, entity, format) => {
                const anno = annotationsManager.commonAnnotation(entity, ['oa:Tag', 'cnt:ContentAsText', 'skos:Concept'], 'oa:classifying');

                const keyword = entity.getAttribute('KEYWORDTYPE');
                if (format === 'xml') {
                    const body = $(`[rdf\\:about="${entity.getUris().entityId}"]`, anno);
                    const keywordXml = $.parseXML(`<cnt:chars xmlns:cnt="http://www.w3.org/2011/content#">${keyword}</cnt:chars>`);
                    body.prepend(keywordXml.firstChild);
                } else {
                    anno['oa:hasBody']['cnt:chars'] = keyword;
                }

                return anno;
            }
        },

        link: {
            label: 'Link',
            parentTag: 'XREF',
            annotation: (annotationsManager, entity, format) => {
                return annotationsManager.commonAnnotation(entity, 'cnt:ContentAsText', 'oa:linking');
            }
        }

    }

};

module.exports = mapping;