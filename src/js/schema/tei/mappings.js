const $ = require('jquery');
const Mapper = require('../mapper.js');

// TODO add resp for note type entities

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
}

const mapping = {

    namespace: 'http://www.tei-c.org/ns/1.0',
    id: 'xml:id',
    responsibility: 'resp',
    rdfParentSelector: '/TEI/teiHeader/fileDesc/following-sibling::xenoData',
    root: ['TEI', 'teiCorpus'],
    header: 'teiHeader',
    blockElements: ['argument', 'back', 'bibl', 'biblFull', 'biblScope', 'body', 'byline', 'category', 'change', 'cit', 'classCode', 'elementSpec', 'macroSpec', 'classSpec', 'closer', 'creation', 'date', 'distributor', 'div', 'div1', 'div2', 'div3', 'div4', 'div5', 'div6', 'div7', 'docAuthor', 'edition', 'editionStmt', 'editor', 'eg', 'epigraph', 'extent', 'figure', 'front', 'funder', 'group', 'head', 'dateline', 'idno', 'item', 'keywords', 'l', 'label', 'langUsage', 'lb', 'lg', 'list', 'listBibl', 'note', 'noteStmt', 'opener', 'p', 'principal', 'publicationStmt', 'publisher', 'pubPlace', 'q', 'rendition', 'resp', 'respStmt', 'salute', 'samplingDecl', 'seriesStmt', 'signed', 'sp', 'sponsor', 'tagUsage', 'taxonomy', 'textClass', 'titlePage', 'titlePart', 'trailer', 'TEI', 'teiHeader', 'text', 'authority', 'availability', 'fileDesc', 'sourceDesc', 'revisionDesc', 'catDesc', 'encodingDesc', 'profileDesc', 'projectDesc', 'docDate', 'docEdition', 'docImprint', 'docTitle'],
    urlAttributes: ['ref', 'target'],
    popupAttributes: [],

    listeners: {
        tagAdded: tag => {
            const $tag = $(tag);
            if ($tag.attr('_tag') === 'graphic') handleGraphics($tag);
        },
        tagEdited: tag => {
            const $tag = $(tag);
            if ($tag.attr('_tag') === 'graphic') handleGraphics($tag);
        },
        documentLoaded: (success, body) => {
            $(body).find('*[_tag="graphic"]').each((index, el) => {
                handleGraphics($(el));
            });
        }
    },

    entities: {

        rs: {
            parentTag: 'rs',
            mapping: {
                uri: '@ref',
                lemma: '@key',
                certainty: '@cert'
            },
            annotation: (annotationsManager, entity) => {
                let type = entity.getAttribute('type');
                if (type === undefined || type === '') {
                    type = 'owl:Thing';
                }
                type = type.replace('http://sparql.cwrc.ca/ontology/cwrc#', 'cwrc:');
                return annotationsManager.commonAnnotation(entity, type);
            }
        },

        person: {
            parentTag: 'persName',
            mapping: {
                uri: '@ref',
                lemma: '@key',
                certainty: '@cert'
            },
            annotation: (annotationsManager, entity) => {
                let types = '';
                const type = entity.getAttribute('type');
                switch (type) {
                    case 'real':
                        types = 'cwrc:NaturalPerson';
                        break;
                    case 'fictional':
                        types = ['schema:Person', 'cwrc:FictionalPerson'];
                        break;
                    case 'both':
                        types = ['cwrc:NaturalPerson', 'schema:Person', 'cwrc:FictionalPerson'];
                        break;
                    default:
                        types = 'cwrc:NaturalPerson';
                        break;
                }
                return annotationsManager.commonAnnotation(entity, types);
            }
        },

        org: {
            parentTag: 'orgName',
            mapping: {
                uri: '@ref',
                lemma: '@key',
                certainty: '@cert'
            },
            annotation: (annotationsManager, entity) => {
                return annotationsManager.commonAnnotation(entity, 'org:Organization');
            }
        },

        place: {
            parentTag: 'placeName',
            mappingFunction: entity => {
                const startTag = Mapper.getTagAndDefaultAttributes(entity);

                let endTag = '';
                const precision = entity.getCustomValue('precision');
                if (precision !== undefined) {
                    endTag += `<precision match="@ref" precision="${precision}" />`;
                }
                const tag = entity.getTag();
                endTag += `</${tag}>`;

                return [startTag, endTag];
            },
            mapping: {
                uri: '@ref',
                lemma: '@key',
                certainty: '@cert',
                customValues: {
                    precision: 'precision/@precision'
                }
            },
            annotation: (annotationsManager, entity) => {
                const anno = annotationsManager.commonAnnotation(entity, 'cwrc:RealPlace');
                const precision = entity.getCustomValue('precision');
                if (precision) {
                    anno['cwrc:hasPrecision'] = `cwrc:${precision}Certainty`;
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
            annotation: (annotationsManager, entity) => {
                return annotationsManager.commonAnnotation(entity, 'bf:Title');
            }
        },

        correction: {
            xpathSelector: 'self::choice|self::corr',
            parentTag: ['choice', 'corr'],
            textTag: 'sic',
            requiresSelection: false,
            mappingFunction: entity => {
                const corrText = entity.getCustomValue('corrText');
                const sicText = entity.getCustomValue('sicText');

                let tag;
                if (sicText) {
                    tag = 'choice';
                } else {
                    tag = 'corr';
                }

                let startTag = `<${tag}${Mapper.getAttributeString(entity.getAttributes())}>`;
                let endTag;

                if (sicText) {
                    startTag += '<sic>';
                    endTag = `</sic><corr>${corrText}</corr></choice>`;
                } else {
                    endTag = `</${tag}>`;
                }

                return [startTag, endTag];
            },
            mapping: {
                customValues: {
                    sicText: 'sic/text()',
                    corrText: 'corr/text()'
                }
            },
            annotation: (annotationsManager, entity) => {
                const anno = annotationsManager.commonAnnotation(entity, 'fabio:Correction', 'oa:editing');
                anno['oa:hasBody'] = {
                    '@type': 'fabio:Correction',
                    'dc:format': 'text/xml',
                    'rdf:value': entity.getCustomValue('corrText')
                }
                return anno;
            }
        },

        link: {
            parentTag: 'ref',
            annotation: (annotationsManager, entity) => {
                const anno = annotationsManager.commonAnnotation(entity, 'cnt:ContentAsText', 'oa:linking');
                anno['oa:hasBody'] = {
                    '@id': entity.getAttribute('target'),
                    '@type': 'cnt:ContentAsText'
                };
                return anno;
            }
        },

        date: {
            parentTag: 'date',
            annotation: (annotationsManager, entity) => {
                const anno = annotationsManager.commonAnnotation(entity, 'xsd:date');
                let date;
                if (entity.getAttribute('when') !== undefined) {
                    date = entity.getAttribute('when');
                } else {
                    date = `${entity.getAttribute('from')}/${entity.getAttribute('to')}`;
                }
                anno['oa:hasBody']['rdf:value'] = date;
                return anno;
            }
        },

        note: {
            parentTag: 'note',
            xpathSelector: 'self::note[not(@type="citation")]',
            isNote: true,
            requiresSelection: false,
            mapping: {
                noteContent: '.'
            },
            annotation: (annotationsManager, entity) => {
                let types = '';
                const type = entity.getAttribute('type');
                switch (type) {
                    case 'researchNote':
                        types = 'cwrc:NoteInternal';
                        break;
                    case 'scholarNote':
                        types = 'cwrc:NoteScholarly';
                        break;
                    case 'annotation':
                        types = 'oa:TextualBody'
                        break;
                }
                return annotationsManager.commonAnnotation(entity, types, 'oa:describing');
            }
        },

        citation: {
            parentTag: 'note',
            xpathSelector: 'self::note[@type="citation"]/bibl',
            textTag: 'bibl',
            isNote: true,
            requiresSelection: false,
            mappingFunction: (entity) => {
                let startTag = `${Mapper.getTagAndDefaultAttributes(entity)}<bibl>`;
                const lookupId = entity.getURI();
                if (lookupId) startTag += `<ref target="${lookupId}"/>`;
                const endTag = '</bibl></note>';
                return [startTag, endTag];
            },
            mapping: {
                uri: 'bibl/ref/@target',
                certainty: '@cert',
                noteContent: 'bibl/text()'
            },
            annotation: (annotationsManager, entity) => {
                const anno = annotationsManager.commonAnnotation(entity, 'cito:Citation', 'cwrc:citing');
                if (entity.getURI()) {
                    anno['oa:hasBody'] = [
                        anno['oa:hasBody'],
                        {
                            '@id': `${anno['@id']}#Cites`,
                            '@type': 'cito:Citation',
                            'cito:hasCitingEntity': anno['@id'],
                            'cito:hasCitedEntity': entity.getURI(),
                            'cito:hasCitationEvent': 'cito:cites'
                        }
                    ]
                    anno['@context']['cito'] = 'http://purl.org/spar/cito/';
                }
                return anno;
            }
        },

        keyword: {
            parentTag: 'seg',
            xpathSelector: 'self::seg/term',
            textTag: 'term',
            isNote: true,
            requiresSelection: false,
            mappingFunction: entity => {
                const startTag = `${Mapper.getTagAndDefaultAttributes(entity)}<term>`;
                const endTag = '</term></seg>';
                return [startTag, endTag];
            },
            mapping: {
                noteContent: 'term/text()'
            },
            annotation: (annotationsManager, entity) => {
                let types = '';
                let motivations = '';
                const ana = entity.getAttribute('ana');
                const hasAna = ana !== undefined;
                const hasRef = hasAna && ana.indexOf('http') === 0;

                if (hasRef) {
                    types = 'fabio:ControlledVocabulary';
                    motivations = 'oa:classifying';
                } else {
                    types = 'fabio:UncontrolledVocabulary';
                    motivations = 'oa:tagging';
                }

                const anno = annotationsManager.commonAnnotation(entity, types, motivations);

                if (hasRef) {
                    anno['oa:hasBody'] = [{
                        '@type': 'fabio:ControlledVocabulary',
                        'rdf:value': ana
                    }, {
                        'dc:format': 'text/xml',
                        'skos:altLabel': entity.getContent()
                    }]
                    anno['@context']['skos'] = 'http://www.w3.org/2004/02/skos/';
                } else if (hasAna) {
                    anno['oa:hasBody'] = [{
                        '@type': 'fabio:UncontrolledVocabulary',
                        'rdf:value': ana
                    }, {
                        'dc:format': 'text/xml',
                        'skos:altLabel': entity.getContent()
                    }]
                    anno['@context']['skos'] = 'http://www.w3.org/2004/02/skos/';
                } else {
                    anno['oa:hasBody'] = {
                        '@type': 'fabio:UncontrolledVocabulary',
                        'dc:format': 'text/xml',
                        'rdf:value': entity.getContent()
                    }
                }

                return anno;
            }
        }

    }

};

module.exports = mapping;