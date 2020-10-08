'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/button');
require('jquery-ui/ui/widgets/selectmenu');
require('jquery-ui/ui/widgets/tooltip');

var DialogForm = require('../../../dialogs/dialogForm/dialogForm');

const NerveToCWRCMappings = {
    'PERSON': 'person',
    'LOCATION': 'place',
    'ORGANIZATION': 'org',
    'TITLE': 'title'
};

/**
 * @class Nerve
 * @param {Object} config
 * @param {Writer} config.writer
 * @param {String} config.parentId
 * @param {String} config.nerveUrl
 */
function Nerve(config) {
    var w = config.writer;

    var id = config.parentId;

    var nerveUrl = config.nerveUrl;
    if (nerveUrl === undefined) {
        console.error('Nerve: no nerveUrl specified!');
    }

    /**
     * Tracks the merged entities.
     * @type {Object}
     * @property {Array} entityIds
     * @property {String} type
     * @property {String} lemma
     * @property {String} uri
     */
    var mergedEntities = {};

    var editDialog = null; // holder for initialized edit dialog

    var mergeDialog = null; // holder for initialized merge dialog

    var isMerge = false; // are we in merge mode

    let runOptions = []; // what options did the user select when running nerve

    var $parent = $('#' + id);
    $parent.append(`
        <div class="moduleParent nervePanel">
            <div class="moduleHeader">
                <div>
                    <select name="processOptions">
                        <option value="tag">Entity Recognition</option>
                        <!--<option value="both">Recognition & Linking</option>
                        <option value="link">Linking Only</option>-->
                    </select>
                    <button type="button" class="run">Run</button>
                    <button type="button" class="done" style="display: none;">Done</button>
                </div>
                <div class="filters" style="display: none; margin: 0px;">
                    <div style="display: inline-block; margin: 5px;">
                        <label for="filter" title="Filter" class="fas fa-filter"></label>
                        <select name="filter">
                            <option value="all" selected="selected">All</option>
                            <optgroup label="Type">
                                <option value="type_person">Person</option>
                                <option value="type_place">Place</option>
                                <option value="type_org">Organization</option>
                                <option value="type_title">Title</option>
                            </optgroup>
                            <optgroup label="Status">
                                <option value="status_edited">Edited</option>
                                <option value="status_notedited">Not Edited</option>
                            </optgroup>
                        </select>
                    </div>
                    <div style="display: inline-block; margin: 5px;">
                        <label for="sorting" title="Sorting" class="fas fa-sort"></label>
                        <select name="sorting">
                            <option value="seq" selected="selected">Sequential</option>
                            <option value="alpha">Alphabetical</option>
                            <option value="cat">Categorical</option>
                        </select>
                    </div>
                </div>
                <div class="listActions" style="display: none;">
                    <button type="button" class="expand">Expand All</button>
                    <button type="button" class="accept">Accept All</button>
                    <button type="button" class="reject">Reject All</button>
                </div>
            </div>
            <div class="moduleContent">
                <ul class="entitiesList"></ul>
            </div>
            <div class="moduleFooter">
                <button type="button" class="mergeEntities">Merge Entities</button>
                <div class="mergeActions" style="display: none;">
                    <button type="button" class="merge">Merge</button>
                    <button type="button" class="cancelMerge">Cancel</button>
                </div>
            </div>
        </div>`);

    $parent.find('select[name=processOptions]').selectmenu({
        appendTo: w.layoutManager.getContainer()
    });
    $parent.find('.filters select').selectmenu({
        appendTo: w.layoutManager.getContainer(),
        width: 90
    });
    // RUN
    $parent.find('button.run').button().on('click', function() {
        run();
    });
    // DONE
    $parent.find('button.done').button().on('click', function() {
        const countEditedEntities = getNerveEntities(true).length;
        const countMergedEntities = Object.keys(mergedEntities).length;
        const totalModified = countEditedEntities + countMergedEntities;
        if (totalModified > 0) {
            w.dialogManager.confirm({
                title: 'Warning',
                msg: `<p>You are about to lose edits you've made to ${totalModified} Nerve-identified entit${totalModified > 1 ? 'ies' : 'y'}.</p>
                <p>Do you wish to proceed?</p>`,
                // showConfirmKey: 'confirm-reject-nerve-entities',
                noText: 'No, review edited entities',
                type: 'info',
                callback: function(doIt) {
                    if (doIt) {
                        rejectAll(true);
                        handleDone();
                    } else {
                        setFilterValue('status_edited');
                        filterEntityView('status_edited');
                    }
                }
            });
        } else {
            rejectAll(true);
            handleDone();
        }
    });
    // FILTER
    $parent.find('select[name="filter"]').on('selectmenuchange', function() {
        filterEntityView(getFilterValue());
    });
    // SORTING
    $parent.find('select[name="sorting"]').on('selectmenuchange', function() {
        renderEntitiesList();
    });
    // EXPAND / COLLAPSE
    $parent.find('button.expand').button().on('click', function() {
        if ($(this).text() === 'Expand All') {
            $(this).text('Collapse All');
            $parent.find('.entitiesList > li').each(function(index, el) {
                $(el).addClass('expanded');
            });
        } else {
            $(this).text('Expand All');
            $parent.find('.entitiesList > li').each(function(index, el) {
                $(el).removeClass('expanded');
            });
        }
    });
    // ACCEPT ALL
    $parent.find('button.accept').button().on('click', function() {
        acceptAll();
    });
    // REJECT ALL
    $parent.find('button.reject').button().on('click', function() {
        rejectAll();
    });
    // ENTER MERGE MODE
    $parent.find('button.mergeEntities').button({
        disabled: true
    }).on('click', function() {
        setMergeMode(true);
    });
    // MERGE DIALOG
    $parent.find('.moduleFooter button.merge').button().on('click', function() {
        mergeEntities();
    });
    // CANCEL MERGE
    $parent.find('.moduleFooter button.cancelMerge').button().on('click', function() {
        setMergeMode(false);
    });

    const run = async () => {
        nrv.reset();
        
        const document = getBasicXmlDocument();
        const nerveContext = buildContext();

        const options = $parent.find('select[name="processOptions"]').val();
        runOptions = ['tag', 'link'];
        if (options === 'tag') {
            runOptions = ['tag'];
        } else if (options === 'link') {
            runOptions = ['link'];
        }

        const li = w.dialogManager.getDialog('loadingindicator');
        li.setText('Contacting NERVE');
        li.setValue(false);
        li.show();

        const response = await fetch(`${nerveUrl}/ner`, {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                document,
                context: nerveContext
            })
        }).catch( (msg) => {
            console.warn('encoding failed', msg);
            li.hide();
            w.dialogManager.show('message', {
                title: 'Error',
                msg: `The NERVE server returned an error: ${msg.exception}`,
                type: 'error'
            });
        });

        const results = await response.json();
        
        // Handling bad request (possibly encode error):
        if (results['http-response-status'] === 400) {
            console.warn(`The NERVE server returned an error. Bad request (possibly encode error): ${results.message}`);
            li.hide();
            w.dialogManager.show('message', {
                title: 'Error',
                msg: `The NERVE server returned an error. Bad request (possibly encode error): ${results.message}`,
                type: 'error'
            });
        }

        w.event('massUpdateStarted').publish();

        const doc = w.utilities.stringToXML(results.document);
        if (doc === null) {
            console.warn('nerve.run: could not parse response from NERVE');
            li.hide();
            return;
        }

        const context = JSON.parse(results.context);
        const entities = processNerveResponse(doc, context);

        li.setText('Processing Response');

        w.tagger.removeNoteWrappersForEntities();

        await w.utilities.processArray(entities, addEntityFromNerve);

        w.tagger.addNoteWrappersForEntities();

        li.hide();

        renderEntitiesList();

        w.event('massUpdateCompleted').publish();

        w.editor.setMode('readonly');
        $parent.find('button.run').hide();
        $parent.find('button.done').show();

        $parent.find('.filters').show();
        $parent.find('.listActions').show();

        $parent.find('select[name="processOptions"]').selectmenu('option', 'disabled', true);
        $parent.find('button.mergeEntities').button('enable');

    };

    // Converts to xml using just the _tag attribute and ignores everything else.
    // We don't want to do a full/normal conversion because of differences between entities in the editor and in the outputted xml.
    const getBasicXmlDocument = () => {
        let xmlString = `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-model href="${w.schemaManager.getXMLUrl()}" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>\n`;

        const _nodeToStringArray = (currNode) => {
            const tag = currNode.attr('_tag');
            let array = [];
            if (tag !== undefined) {
                array = [ ...array, `<${tag}>`, `</${tag}>`]
            } else {
                array = ['',''];
            }
            return array;
        }

        const doBuild = (currentNode) => {
            const tags = _nodeToStringArray(currentNode);

            if (tags[0] === '<teiHeader>') return; // * skip `<teiheader>` when sending document to NSSI [NERVE]
            
            xmlString += tags[0];
            currentNode.contents().each((index, el) => {
                if (el.nodeType == Node.ELEMENT_NODE) {
                    doBuild($(el));
                } else if (el.nodeType == Node.TEXT_NODE) {
                    xmlString += w.utilities.convertTextForExport(el.data);
                }
            });
            xmlString += tags[1];
        }

        w.entitiesManager.highlightEntity();
        const root = w.schemaManager.getRoot();
        const $body = $(w.editor.getBody());
        const $rootEl = $body.children(`[_tag=${root}]`);
        doBuild($rootEl);
        
        xmlString = xmlString.replace(/\uFEFF/g, '');

        return xmlString;
    }

    var buildContext = function() {
        const sm = w.schemaManager;
        
        const context = {
            name: sm.getCurrentSchema().id,
            tags: {}
        };

        const respAttr = sm.mapper.getResponsibilityAttributeName();
        
        for (let nerveTypeName in NerveToCWRCMappings) {
            const entityType = NerveToCWRCMappings[nerveTypeName];
            context.tags[nerveTypeName] = {
                name: sm.mapper.getParentTag(entityType),
                lemmaAttribute: sm.mapper.getMappingForProperty(entityType, 'lemma').replace('@', ''),
                linkAttribute: sm.mapper.getMappingForProperty(entityType, 'uri').replace('@', ''),
                idAttribute: sm.mapper.getIdAttributeName(),
                defaults: {}
            }
            context.tags[nerveTypeName].defaults[respAttr] = 'NERVE';
            Object.assign(context.tags[nerveTypeName].defaults, sm.mapper.getRequiredAttributes(entityType));
        }

        return context;
    }

    var processNerveResponse = function(document, context) {
        const sm = w.schemaManager;

        var entities = [];

        var tagsContext = {};
        for (var type in context.tags) {
            var entry = context.tags[type];
            tagsContext[entry.name] = {
                lemma: entry.lemmaAttribute,
                uri: entry.linkAttribute,
                type: NerveToCWRCMappings[type]
            }
        }

        var getOffsetFromParent = function(parent, target) {
            var offset = 0;
            var walker = parent.ownerDocument.createTreeWalker(parent, NodeFilter.SHOW_ALL);
            while (walker.nextNode()) {
                var currNode = walker.currentNode;
                if (currNode === target) {
                    break;
                } else if (currNode.nodeType === Node.TEXT_NODE) {
                    offset += currNode.length;
                }
            }
            return offset;
        }

        const respAttr = sm.mapper.getResponsibilityAttributeName();
        $(document.documentElement).find('['+respAttr+'=NERVE]').each((index, el) => {
            var tag = el.nodeName;

            const mapping = sm.mapper.getReverseMapping(el, true);
            if (mapping.type === undefined) {
                console.warn('nerve: unrecognized entity type for',tag);
            } else {
                if (mapping.lemma !== undefined || mapping.uri !== undefined) {
                    var xpath = w.utilities.getElementXPath(el.parentElement);
                    var offset = getOffsetFromParent(el.parentElement, el);
                    mapping.text = el.textContent;
                    mapping.xpath = xpath;
                    mapping.textOffset = offset;
                    mapping.textLength = el.textContent.length;

                    entities.push(mapping);
                }
            }
        })

        return entities;
    }

    var getNerveEntities = function(onlyEdited=false) {
        var entities = w.entitiesManager.getEntitiesArray(getCurrentSorting());
        entities = entities.filter(function(entry) {
            return entry.getCustomValue('nerve') === 'true' && (onlyEdited && entry.getCustomValue('edited') === 'true' || !onlyEdited);
        });
        return entities;
    }

    var renderEntitiesList = function() {
        $parent.find('.moduleContent ul').empty();

        var entityHtml = '';

        getNerveEntities().forEach(function(ent, index) {
            if (isEntityMerged(ent.getId()) === false) {
                entityHtml += getEntityView(ent, isMerge);
            }
        });

        for (var key in mergedEntities) {
            entityHtml += getMergedEntityView(key, isMerge);
        }

        $parent.find('ul.entitiesList').html(entityHtml);
        $parent.find('ul.entitiesList > li > div').on('click', function(event) {
            $(this).parent().toggleClass('expanded');
            var id = $(this).parent().attr('data-id');
            w.entitiesManager.highlightEntity(id, null, true);
        }).find('.actions > span').hover(function() {
            $(this).removeClass('ui-state-default');
            $(this).addClass('ui-state-active');
        }, function() {
            $(this).addClass('ui-state-default');
            $(this).removeClass('ui-state-active');
        }).on('click', function(event) {
            event.stopPropagation();
            var action = $(this).data('action');
            var id = $(this).parents('li').data('id');
            var merged = $(this).parents('li').hasClass('merged');
            switch (action) {
                case 'accept':
                    if (merged) {
                        acceptMerged(id);
                        w.entitiesList.update();
                    } else {
                        acceptEntity(id);
                        w.entitiesList.update();
                    }
                    break;
                case 'acceptmatching':
                    acceptMatching(id);
                    break;
                case 'reject':
                    if (merged) {
                        rejectMerged(id);
                    } else {
                        rejectEntity(id);
                    }
                    break;
                case 'edit':
                    if (merged) {
                        mergeEntities(id);
                    } else {
                        editEntity(id);
                    }
                    break;
                case 'unmerge':
                    unmergeEntities(id);
                    break;
            }
        });

        // merged entity navigation
        $parent.find('ul.entitiesList > li .nav > span').hover(function() {
            $(this).removeClass('ui-state-default');
            $(this).addClass('ui-state-active');
        }, function() {
            $(this).addClass('ui-state-default');
            $(this).removeClass('ui-state-active');
        }).on('click', function(event) {
            event.stopPropagation();
            var action = $(this).data('action');
            var entry = mergedEntities[$(this).parents('li').data('id')];
            var currId = w.entitiesManager.getCurrentEntity();
            var entityIndex = 0;
            if (action === 'previous') {
                if (currId == null) {
                    entityIndex = entry.entityIds.length-1;
                } else {
                    let idIndex = entry.entityIds.indexOf(currId);
                    entityIndex = idIndex - 1;
                    if (entityIndex < 0) {
                        entityIndex = entry.entityIds.length-1;
                    }
                }
            } else {
                if (currId == null) {
                    entityIndex = 0;
                } else {
                    let idIndex = entry.entityIds.indexOf(currId);
                    entityIndex = idIndex + 1;
                    if (entityIndex > entry.entityIds.length-1) {
                        entityIndex = 0;
                    }
                }
            }
            var id = entry.entityIds[entityIndex];
            w.entitiesManager.highlightEntity(id, null, true);
        });

        if (isMerge) {
            $parent.find('ul.entitiesList > li > input').on('click', function() {
                var checked = getCheckedEntities();
                if (checked.length === 0) {
                    filterEntityView('all');
                } else {
                    var type = checked.first().data('type');
                    filterEntityView('type_'+type);
                }
            });
        }

        $parent.find('ul.entitiesList .actions').tooltip({
            show: false,
            hide: false,
            classes: {
                'ui-tooltip': 'cwrc-tooltip'
            }
        });
    }

    var getEntityView = function(entity, merge) {
        var hasMatching = getMatchesForEntity(entity.getId()).length > 0;
        var html = ''+
        '<li class="'+entity.getType()+'" data-type="'+entity.getType()+'" data-id="'+entity.getId()+'">'+
            (merge === true ? '<input type="checkbox" />' : '')+
            '<div>'+
                '<div class="header">'+
                    '<span class="icon"/>'+
                    '<span class="entityTitle">'+
                    (entity.getCustomValue('edited') === 'true' ? '&#8226; ' : '')+
                        entity.getContent()+
                    '</span>'+
                    '<div class="actions">'+
                        (merge === true ? '' :
                        '<span data-action="edit" class="ui-state-default" title="Edit"><span class="ui-icon ui-icon-pencil"/></span>'+
                        '<span data-action="accept" class="ui-state-default" title="Accept"><span class="ui-icon ui-icon-check"/></span>'+
                        (hasMatching === true ? '<span data-action="acceptmatching" class="ui-state-default" title="Accept All Matching"><span class="ui-icon ui-icon-circle-check"/></span>' : '')+
                        '<span data-action="reject" class="ui-state-default" title="Reject"><span class="ui-icon ui-icon-close"/></span>')+
                    '</div>'+
                '</div>'+
                '<div class="info">'+getEntityViewInfo(entity)+'</div>'+
            '</div>'+
        '</li>';
        return html;
    }

    var getMergedEntityView = function(id, merge) {
        var entry = mergedEntities[id];
        var html = ''+
        '<li class="'+entry.type+' merged" data-type="'+entry.type+'" data-id="'+id+'">'+
            (merge === true ? '<input type="checkbox" />' : '')+
            '<div>'+
                '<div class="header">'+
                    '<span class="icon" style="margin-right: -4px;"/><span class="icon"/>'+
                    '<span class="entityTitle">&#8226; '+entry.lemma+'</span>'+
                    '<div class="actions">'+
                        (merge === true ? '' :
                        '<div class="nav">'+
                            '<span data-action="previous" class="ui-state-default" title="Previous Entity"><span class="ui-icon ui-icon-circle-arrow-w"></span></span>'+
                            '<span data-action="next" class="ui-state-default" title="Next Entity"><span class="ui-icon ui-icon-circle-arrow-e"></span></span>'+
                        '</div>'+
                        '<span data-action="unmerge" class="ui-state-default" title="Unmerge"><span class="ui-icon ui-icon-scissors"></span></span>'+
                        '<span data-action="edit" class="ui-state-default" title="Edit"><span class="ui-icon ui-icon-pencil"></span></span>'+
                        '<span data-action="accept" class="ui-state-default" title="Accept"><span class="ui-icon ui-icon-check"></span></span>'+
                        '<span data-action="reject" class="ui-state-default" title="Reject"><span class="ui-icon ui-icon-close"></span></span>')+
                    '</div>'+
                '</div>'+
                '<div class="info">'+
                    '<ul>'+
                        '<li><strong>URI</strong>: <a href="'+entry.uri+'" target="_blank" rel="noopener">'+entry.uri+'</a></li>'+
                    '</ul>'+
                '</div>'+
            '</div>'+
        '</li>';
        return html;
    }

    var getEntityViewInfo = function(entity) {
        var html = '<ul>';
        var lemma = entity.getLemma();
        if (lemma !== undefined) {
            html += '<li><strong>Standard</strong>: '+lemma+'</li>';
        }
        var uri = entity.getURI()
        if (uri !== undefined) {
            html += '<li><strong>URI</strong>: <a href="'+uri+'" target="_blank" rel="noopener">'+uri+'</a></li>';
        }
        html += '</ul>';
        return html;
    }

    var updateEntityView = function(entity, expand) {
        var view = $parent.find('ul.entitiesList > li[data-id='+entity.getId()+']');
        view.data('type', entity.getType()).attr('data-type', entity.getType());
        var alreadyExpanded = view.hasClass('expanded');
        view.removeClass();
        view.addClass(entity.getType());
        if (alreadyExpanded || expand === true) {
            view.addClass('expanded');
        }
        const title = (entity.getCustomValue('edited') === 'true' ? '&#8226; ' : '')+entity.getContent();
        view.find('.entityTitle').html(title);
        view.find('.info').html(getEntityViewInfo(entity));
    }

    /**
     * Filter the view based on the specified filter.
     * Can be either a type or status filter. If not specified, assumed to be type filter.
     * If specified, format is: filterType_filterValue. For example: status_edited, type_place
     * @param {String} filter
     */
    var filterEntityView = function(filter) {
        let filterType = 'type';
        if (filter.indexOf('_') !== -1) {
            const details = filter.split('_');
            filterType = details[0];
            filter = details[1];
        }
        $parent.find('ul.entitiesList > li').each(function(index, el) {
            const $ent = $(this)
            if (filter === 'all') {
                $ent.show();
            } else {
                if (filterType === 'type') {
                    if ($ent.hasClass(filter)) {
                        $ent.show();
                    } else {
                        $ent.hide();
                    }
                } else {
                    const entry = w.entitiesManager.getEntity($ent.data('id'))
                    const isEdited = (entry && entry.getCustomValue('edited') === 'true') || $ent.hasClass('merged');
                    if ((filter === 'edited' && isEdited) || (filter === 'notedited' && !isEdited)) {
                        $ent.show();
                    } else {
                        $ent.hide();
                    }
                }
            }
        });
    }

    var getFilterValue = function() {
        return $parent.find('select[name="filter"]').val();
    }
    var setFilterValue = function(value) {
        $parent.find('select[name="filter"]').val(value).selectmenu('refresh');
    }

    var getCurrentSorting = function() {
        return $parent.find('select[name="sorting"]').val();
    }

    var getEntryForEntityId = function(entityId) {
        return w.entitiesManager.getEntity(entityId);
    }

    var removeEntityFromView = function(id) {
        $parent.find('ul.entitiesList li[data-id='+id+']').remove();
    }

    var selectRangeForEntity = function(entry) {
        var parent = w.utilities.evaluateXPath(w.editor.getBody(), entry.xpath);
        if (parent === null) {
            console.warn('nerve: could not get parent for "',entry.lemma,'" at:',entry.xpath);
            return null;
        }

        var totalOffset = 0;
        var currNode;
        var walker = w.editor.getDoc().createTreeWalker(parent, NodeFilter.SHOW_ALL);
        while (walker.nextNode()) {
            currNode = walker.currentNode;
            if (currNode.nodeType === Node.TEXT_NODE) {
                if (totalOffset + currNode.length >= entry.textOffset) {
                    break;
                } else {
                    if (currNode.length === 1 && currNode.data === '\uFEFF') {
                        // skip empty elements
                    } else {
                        totalOffset += currNode.length;
                    }
                }
            }
        }

        var startOffset = entry.textOffset-totalOffset;
        var endOffset = startOffset+entry.textLength;

        var range = w.editor.selection.getRng(true);
        try {
            range.setStart(currNode, startOffset);
            range.setEnd(currNode, endOffset);
            return range;
        } catch (e) {
            range.collapse();
            console.warn('nerve: could not select range for',entry);
            return null;
        }
    }

    /**
     * Get the tag names used by the named entities
     */
    var getNamedEntityTags = function() {
        var namedEntities = ['person', 'place', 'org'];
        var namedEntityTags = namedEntities.map((type) => {
            return w.schemaManager.mapper.getParentTag(type);
        });
        return namedEntityTags;
    }

    var addEntityFromNerve = function(entry) {
        var range = selectRangeForEntity(entry);
        if (range !== null) {
            var parentEl = range.commonAncestorContainer.parentElement;
            if (range.startOffset === 0) {
                var namedEntityTags = getNamedEntityTags();
                if (parentEl.getAttribute('_entity') === 'true' || namedEntityTags.indexOf(parentEl.getAttribute('_tag')) !== -1) {
                    console.log('nerve: entity already exists for',entry);
                    range.collapse();
                    return false;
                }
            }

            var entityConfig = {
                type: entry.type,
                content: entry.text,
                attributes: {
                    _candidate: 'true'
                },
                customValues: {
                    nerve: 'true' // TODO need to differentiate between entities tagged by nerve and those linked by nerve
                }
            };
            
            if (entry.lemma !== '') {
                entityConfig.lemma = entry.lemma;
            }
            if (entry.uri !== '') {
                entityConfig.uri = entry.uri;
            }
            Object.assign(entityConfig.attributes, entry.attributes);

            var entity = w.entitiesManager.addEntity(entityConfig, range);

            $('#'+entity.id, w.editor.getBody()).attr('_candidate', 'true'); // have to manually add this since addEntityTag won't (since it's reserved)

            range.collapse();
            return true;
        }
        return false;
    }

    var acceptEntity = function(entityId, removeFromView=true) {
        var entity = w.entitiesManager.getEntity(entityId);
        var tag = $('#'+entityId, w.editor.getBody())[0];
        
        const respAttr = w.schemaManager.mapper.getResponsibilityAttributeName();
        w.tagger.removeAttributeFromTag(tag, respAttr);

        var taggedByNerve = entity.getCustomValue('nerve') !== undefined;
        var uri = entity.getURI();

        if (taggedByNerve && uri === undefined) {
            w.tagger.removeEntity(entityId);
        } else {
            entity.removeCustomValue('nerve');
            entity.removeCustomValue('edited');
            entity.removeAttribute(respAttr);
            entity.removeAttribute('_candidate');
            w.tagger.removeAttributeFromTag(tag, '_candidate');
        }

        if (removeFromView) {
            removeEntityFromView(entityId);
        }
    }

    var acceptMatching = function(entityId) {
        // get matches before accepting initial entity because that will remove it from the nerve entities
        var matches = getMatchesForEntity(entityId);
        
        acceptEntity(entityId);
        matches.forEach(function(entId) {
            acceptEntity(entId);
        });

        w.entitiesList.update();
    }

    var getMatchesForEntity = function(entityId) {
        var matches = [];
        var match = w.entitiesManager.getEntity(entityId);
        getNerveEntities().forEach(function(ent) {
            if (ent.getId() !== match.getId() &&
                ent.getContent() === match.getContent() &&
                ent.getLemma() === match.getLemma() &&
                ent.getURI() == match.getURI()) {
                    matches.push(ent.getId());
                }
        });
        return matches;
    }

    var acceptAll = function() {
        w.event('massUpdateStarted').publish();
        
        var filter = getFilterValue();

        var li = w.dialogManager.getDialog('loadingindicator');
        li.setText('Accepting Entities');
        li.show();

        for (var key in mergedEntities) {
            var entry = mergedEntities[key];
            if (filter === 'all' || filter === entry.type) {
                entry.entityIds.forEach(function(entId) {
                    w.entitiesManager.setLemmaForEntity(entId, entry.lemma);
                    w.entitiesManager.setURIForEntity(entId, entry.uri);
                });
                delete mergedEntities[key];
            }
        }

        w.utilities.processArray(getNerveEntities(), function(ent) {
            if (filter === 'all' || filter === ent.getType()) {
                acceptEntity(ent.getId(), false);
            }
        }).then(() => {
            setFilterValue('all');

            renderEntitiesList();

            w.event('massUpdateCompleted').publish();
        }).always(() => {
            li.hide();
        })
    }

    var rejectEntity = function(entityId, removeFromView=true) {
        var entry = w.entitiesManager.getEntity(entityId);
        var taggedByNerve = entry.getCustomValue('nerve') !== undefined;
        if (taggedByNerve) {
            w.tagger.removeStructureTag(entityId, false);
            /* TODO when we start using nerve for linking, we'll need to revisit taggedByNerve
            if (entry.getURI() === undefined || entry.getURI() === '') {
                // remove tag and entity if both added by nerve
                w.tagger.removeStructureTag(entityId, false);
            } else {
                // if tag already existed and nerve is just linking, then only remove the entity (and related nerve attributes)
                var tag = $('#'+entityId, w.editor.getBody())[0];
                const respAttr = w.schemaManager.mapper.getResponsibilityAttributeName();
                w.tagger.removeAttributeFromTag(tag, respAttr);
                w.tagger.removeAttributeFromTag(tag, '_candidate');

                w.tagger.removeEntity(entityId);
            }
            */
        } else {
            w.tagger.removeEntity(entityId);
        }

        if (removeFromView) {
            removeEntityFromView(entityId);
        }
    }

    var rejectAll = function(isDone) {
        w.event('massUpdateStarted').publish();

        var filter = getFilterValue();

        var li = w.dialogManager.getDialog('loadingindicator');
        li.setText('Rejecting Entities');
        li.show();

        for (var key in mergedEntities) {
            var entry = mergedEntities[key];
            if (filter === 'all' || filter === entry.type) {
                delete mergedEntities[key];
            }
        }

        w.utilities.processArray(getNerveEntities(), function(ent) {
            if (isDone || filter === 'all' || filter === ent.getType()) {
                rejectEntity(ent.getId(), false);
            }
        }).then(() => {
            setFilterValue('all');

            renderEntitiesList();

            w.event('massUpdateCompleted').publish();
        }).always(() => {
            li.hide();
        })
    }

    const editEntity = (entityId) => {
        if (editDialog === null) {
            editDialog = new NerveEditDialog(w, $parent);
            editDialog.$el.dialog('option', 'modal', false); // TODO modal dialog interferes with typing in lookups input
            editDialog.$el.on('save', (e, dialog) => {
                const entity = w.entitiesManager.getEntity(dialog.currentId);
                updateEntityView(entity, true);
                filterEntityView(getFilterValue());
            });
        }
        editDialog.show({entry: getEntryForEntityId(entityId)});
    }

    var setMergeMode = function(val) {
        isMerge = val;
        if (isMerge) {
            $parent.find('.mergeActions').show();
            $parent.find('button.mergeEntities').hide();
            $parent.find('select[name="filter"]').val('all').selectmenu('refresh').selectmenu('option', 'disabled', true);
        } else {
            $parent.find('.mergeActions').hide();
            $parent.find('button.mergeEntities').show();
            $parent.find('select[name="filter"]').selectmenu('option', 'disabled', false);
        }
        renderEntitiesList();
    }

    var isEntityMerged = function(entityId) {
        for (var key in mergedEntities) {
            var entry = mergedEntities[key];
            if (entry.entityIds.indexOf(entityId) !== -1) {
                return true;
            }
        }
        return false;
    }

    var mergeEntities = function(id) {
        if (mergeDialog === null) {
            mergeDialog = new MergeDialog(w, $parent);
            mergeDialog.$el.on('merge', function(e, entities, mergeEntry, lemma, uri) {
                if (mergeEntry != null) {
                    mergeEntry.lemma = lemma;
                    mergeEntry.uri = uri;
                    if (isMerge) {
                        // new entities have been added to the merge
                        mergeEntry.entityIds = entities.map((ent) => ent.getId());
                        setMergeMode(false);
                    } else {
                        // we just edited the merged entry
                        renderEntitiesList();
                    }
                } else {
                    var ids = entities.map(function(ent) {
                        return ent.getId();
                    });
                    var mId = w.getUniqueId('merged_');
                    mergedEntities[mId] = {
                        entityIds: ids,
                        type: entities[0].getType(),
                        lemma: lemma,
                        uri: uri
                    };
                    setMergeMode(false);
                }
            });
            mergeDialog.$el.on('cancel', function() {
            });
        }
        
        var entities = [];
        var entry;
        if (id !== undefined) {
            entry = mergedEntities[id];
            entities = entry.entityIds.map(function(entId) {
                return w.entitiesManager.getEntity(entId);
            });
        } else {
            getCheckedEntities().each(function(index, el) {
                var entityId = $(el).data('id');
                var entity = w.entitiesManager.getEntity(entityId);
                if (entity === undefined) {
                    // merged entity
                    entry = mergedEntities[entityId];
                    if (entry) {
                        entry.entityIds.forEach(function(entId) {
                            entities.push(w.entitiesManager.getEntity(entId));
                        });
                    }
                } else {
                    entities.push(entity);
                }
            });
        }

        if (entities.length > 1) {
            mergeDialog.show();
            mergeDialog.populate(entities, entry);
        } else {
            w.dialogManager.show('message', {
                title: 'Warning',
                msg: 'You must select at least 2 entities to merge.',
                type: 'info'
            });
        }
    }

    var unmergeEntities = function(mergeId) {
        delete mergedEntities[mergeId];
        renderEntitiesList();
    }

    var acceptMerged = function(mergeId) {
        var entry = mergedEntities[mergeId];
        entry.entityIds.forEach(function(entId) {
            w.entitiesManager.setLemmaForEntity(entId, entry.lemma);
            w.entitiesManager.setURIForEntity(entId, entry.uri);
            acceptEntity(entId);
        });
        delete mergedEntities[mergeId];
        removeEntityFromView(mergeId);
    }

    var rejectMerged = function(mergeId) {
        var entry = mergedEntities[mergeId];
        entry.entityIds.forEach(function(entId) {
            rejectEntity(entId);
        });
        delete mergedEntities[mergeId];
        removeEntityFromView(mergeId);
    }

    var getCheckedEntities = function() {
        return $parent.find('ul.entitiesList > li > input:checked').parent('li');
    }

    var handleDone = function() {
        $parent.find('select').selectmenu('option', 'disabled', false);
        $parent.find('button.mergeEntities').button('disable');
        w.editor.setMode('design');
        nrv.reset();

        w.event('contentChanged').publish();
    }

    var nrv = {
        reset: function() {
            mergedEntities = {};
            $parent.find('.moduleContent ul').empty();
            $parent.find('.listActions').hide();
            $parent.find('.filters').hide();
            $parent.find('button.run').show();
            $parent.find('button.done').hide();
        },
        destroy: function() {
            $parent.empty();
            $parent.find('ul.entitiesList .actions').tooltip('destroy');
        }
    }

    return nrv;
}

var doLookup = function(w, query, type, callback) {
    var cD = w.initialConfig.entityLookupDialogs;
    // cD.showCreateNewButton(false);
    // cD.showNoLinkButton(false);
    // cD.showEditButton(false);
    if (type === 'org') {
        type = 'organization';
    }
    cD.popSearch[type]({
        query: query,
        parentEl: w.dialogManager.getDialogWrapper(),
        success: function(result) {
            if ($.isArray(result.name)) {
                result.name = result.name[0];
            }
            callback.call(cD, result);
        },
        error: function(errorThrown) {
        }
    });
}

const NerveEditDialog = (writer, parentEl) => {
    let forceSave = false; // needed for confirmation dialog in beforeSave

    const $el = $(`
        <div class="annotationDialog">
            <div>
                <select data-transform="selectmenu" data-type="select" data-mapping="prop.type">
                    <option value="person">Person</option>
                    <option value="place">Place</option>
                    <option value="org">Organization</option>
                    <option value="title">Title</option>
                </select>
            </div>
            <div>
                <label>Standard name:</label>
                <input type="text" data-type="textbox" data-mapping="prop.lemma" />
            </div>
            <div>
                <label>URI:</label>
                <input type="text" data-type="textbox" data-mapping="prop.uri" style="margin-right: 5px;" />
                <button type="button" title="Entity lookup" data-action="lookup"></button>
            </div>
        </div>`).appendTo(parentEl);

    const dialog = new DialogForm({
        writer,
        $el,
        type: 'person',
        title: 'Edit Entity',
        width: 350,
        height: 300
    });

    dialog.$el.find('button[data-action=lookup]').button({icon: 'ui-icon-search'}).on('click', () => {
        const type = dialog.$el.find('select').val();
        const entity = dialog.showConfig.entry;
        const query = entity.content.trim().replace(/\s+/g, ' ');
        doLookup(writer, query, type, ({ name, uri }) => {
            dialog.$el.find('input[data-mapping="prop.lemma"]').val(name);
            dialog.$el.find('input[data-mapping="prop.uri"]').val(uri);
        });
    });

    dialog.$el.on('beforeShow', () => {
        forceSave = false;
    });

    dialog.$el.on('beforeSave', (e, dialog) => {        
        if (forceSave) {
            dialog.isValid = true;
        } else {
            const uri = dialog.$el.find('input[data-mapping="prop.uri"]').val();
            const isValidURLRegex = new RegExp('^https?:\/\/');
            if (uri !== '' && uri.search(isValidURLRegex) !== 0) {
                dialog.isValid = false;
                writer.dialogManager.confirm({
                    title: 'Warning',
                    msg: `
                        <p>The URI you have entered does not look valid.</p>
                        <p>Are you sure you want to use it?</p>`,
                    showConfirmKey: 'confirm-nerve-uri',
                    type: 'info',
                    callback: (doIt) => {
                        setTimeout(() => { // need setTimeout in case confirm dialog is skipped
                            if (doIt) {
                                forceSave = true;
                                dialog.save();
                            }
                        });
                    }
                });
            } else {
                dialog.isValid = true;
            }
        }

        if (dialog.isValid) {
            console.log(dialog.currentData)
            const sm = writer.schemaManager;

            const type = dialog.currentData.properties.type;
            const tag = sm.mapper.getParentTag(type);
            dialog.currentData.properties.tag = tag;

            const oldType = writer.entitiesManager.getEntity(dialog.currentId).getType();
            if (type !== oldType) {
                const requiredAttributes = sm.mapper.getRequiredAttributes(oldType)
                for (const attName in requiredAttributes) {
                    delete dialog.currentData.attributes[attName];
                }
            }

            const lemmaMapping = sm.mapper.getAttributeForProperty(type, 'lemma');
            if (lemmaMapping) {
                dialog.currentData.attributes[lemmaMapping] = dialog.$el.find('input[data-mapping="prop.lemma"]').val()
            }
            const uriMapping = sm.mapper.getAttributeForProperty(type, 'uri');
            if (uriMapping) {
                dialog.currentData.attributes[uriMapping] = dialog.$el.find('input[data-mapping="prop.uri"]').val()
            }

            dialog.currentData.customValues.edited = 'true';
        }
    });

    return dialog;
}

function MergeDialog(writer, parentEl) {
    var w = writer;

    var currEntities = [];
    var currEntry = null; // for editing
    var OTHER_OPTION = '$$$$OTHER$$$$';

    var $el = $(''+
    '<div class="annotationDialog">'+
        '<div class="selections">'+
            '<h3>Selections</h3>'+
            '<ul></ul>'+
        '</div>'+
        '<div>'+
            '<div class="lemma">'+
                '<label>Standard name:</label>'+
                '<select name="lemma"></select>'+
            '</div>'+
            '<div style="margin-top: 5px;">'+
                '<label>Other name:</label>'+
                '<input name="otherLemma" type="text" />'+
            '</div>'+
        '</div><div>'+
            '<div class="link">'+
                '<label>URI:</label>'+
                '<select name="link"></select>'+
            '</div>'+
            '<div style="margin-top: 5px;">'+
                '<label>Other URI:</label>'+
                '<input name="otherLink" type="text" style="margin-right: 5px;"/>'+
                '<button type="button" title="Entity lookup" data-action="lookup"></button>'+
            '</div>'+
        '</div>'+
    '</div>').appendTo(parentEl);
    
    $el.dialog({
        title: 'Merge Entities',
        modal: false,
        resizable: true,
        closeOnEscape: false,
        height: 500,
        width: 400,
        position: { my: 'center', at: 'center', of: w.layoutManager.getContainer() },
        autoOpen: false,
        buttons: [{
            text: 'Merge',
            click: function() {
                var lemma = $el.find('select[name=lemma]').val();
                var link = $el.find('select[name=link]').val();
                if (lemma === OTHER_OPTION) {
                    lemma = $el.find('input[name=otherLemma]').val();
                }
                if (link === OTHER_OPTION) {
                    link = $el.find('input[name=otherLink]').val();
                }
                $el.trigger('merge', [currEntities, currEntry, lemma, link]);
                $el.dialog('close');
            }
        },{
            text: 'Cancel',
            click: function() {
                $el.trigger('cancel');
                $el.dialog('close');
            }
        }]
    });

    $el.find('button[data-action=lookup]').button({icon: 'ui-icon-search'}).on('click', function() {
        var query = currEntities[0].getContent();
        var type = currEntities[0].getType();
        doLookup(w, query, type, function(result) {
            $el.find('input[name=otherLink]').val(result.uri);
        });
    });

    var reset = function() {
        $el.find('ul').empty();
        $el.find('select').empty().each(function(index, el) {
            if ($(el).selectmenu('instance') !== undefined) {
                $(el).selectmenu('destroy');
            }
        });

        $el.find('input[name=otherLemma]').val('').parent().hide();
        $el.find('input[name=otherLink]').val('').parent().hide();
    }

    var populate = function(entities, entry) {
        currEntities = entities;
        currEntry = entry;

        var selections = '';
        var lemmas = [];
        var links = [];

        entities.forEach(function(ent, index) {
            selections += '<li>'+ent.getContent()+'</li>';
            var lemma = ent.getLemma();
            if (lemma !== undefined && lemmas.indexOf(lemma) === -1) {
                lemmas.push(lemma);
            }
            var link = ent.getURI();
            if (link !== undefined && links.indexOf(link) === -1) {
                links.push(link);
            }
        });

        var otherLemma = lemmas.length === 0;
        var lemmaString = '';
        lemmas.forEach(function(lemma) {
            lemmaString += '<option value="'+lemma+'">'+lemma+'</option>';
            if (entry !== undefined && entry.lemma !== lemma) {
                otherLemma = true;
            }
        });
        lemmaString += '<option value="'+OTHER_OPTION+'">Other (specify)</option>';

        var otherLink = links.length === 0;
        var linkString = '';
        links.forEach(function(link) {
            linkString += '<option value="'+link+'">'+link+'</option>';
            if (entry !== undefined && entry.uri !== link) {
                otherLink = true;
            }
        })
        linkString += '<option value="'+OTHER_OPTION+'">Other (lookup)</option>';
        if (links.length === 0) {
            $el.find('input[name=otherLink]').parent().show();
        }
        
        $el.find('ul').html(selections);
        
        $el.find('select[name=lemma]').html(lemmaString).selectmenu({
            select: function(e, ui) {
                if (ui.item.value === OTHER_OPTION) {
                    $el.find('input[name=otherLemma]').parent().show();
                } else {
                    $el.find('input[name=otherLemma]').parent().hide();
                }
            }
        });
        
        $el.find('select[name=link]').html(linkString).selectmenu({
            select: function(e, ui) {
                if (ui.item.value === OTHER_OPTION) {
                    $el.find('input[name=otherLink]').parent().show();
                } else {
                    $el.find('input[name=otherLink]').parent().hide();
                }
            }
        });

        if (entry !== undefined) {
            if (otherLemma) {
                $el.find('select[name=lemma]').val(OTHER_OPTION).selectmenu('refresh');
                $el.find('input[name=otherLemma]').val(entry.lemma).parent().show();
            } else {
                $el.find('select[name=lemma]').val(entry.lemma);
            }
            if (otherLink) {
                $el.find('select[name=link]').val(OTHER_OPTION).selectmenu('refresh');
                $el.find('input[name=otherLink]').val(entry.uri).parent().show();
            } else {
                $el.find('select[name=link]').val(entry.uri);
            }
        }
    }

    return {
        show: function() {
            reset();
            $el.dialog('open')
        },
        $el: $el,
        populate: populate
    }
}

module.exports = Nerve;
