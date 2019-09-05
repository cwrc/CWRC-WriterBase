'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/button');
require('jquery-ui/ui/widgets/selectmenu');
require('jquery-ui/ui/widgets/tooltip');

var DialogForm = require('dialogForm');

const NerveToCWRCMappings = {
    "PERSON": "person",
    "LOCATION": "place",
    "ORGANIZATION": "org",
    "TITLE": "title"
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

    var runOptions = []; // what options did the user select when running nerve

    var $parent = $('#'+id);
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
                            <option value="person">Person</option>
                            <option value="place">Place</option>
                            <option value="org">Organization</option>
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
        if (getNerveEntities().length > 0) {
            w.dialogManager.confirm({
                title: 'Warning',
                msg: '<p>All the remaining entities in the panel will be rejected, including any edited ones.</p>'+
                '<p>Do you wish to proceed?</p>',
                showConfirmKey: 'confirm-reject-nerve-entities',
                type: 'info',
                callback: function(doIt) {
                    if (doIt) {
                        rejectAll(true);
                        handleDone();
                    }
                }
            });
        } else {
            handleDone();
        }
    });
    // FILTER
    $parent.find('select[name="filter"]').on('selectmenuchange', function() {
        filterEntityView(getFilter());
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


    var run = function() {
        nrv.reset();
        
        var document = getBasicXmlDocument();
        
        var options = $parent.find('select[name="processOptions"]').val();
        runOptions = ['tag', 'link'];
        if (options === 'tag') {
            runOptions = ['tag'];
        } else if (options === 'link') {
            runOptions = ['link'];
        }
        
        var li = w.dialogManager.getDialog('loadingindicator');
        li.setText('Contacting NERVE');
        li.setValue(false);
        li.show();
        
        $.when(
            $.ajax({
                url: nerveUrl + '/ner',
                method: 'POST',
                data: JSON.stringify({"document": document})
            })
        ).then(function(response) {
            w.tree.disable();
            w.entitiesList.disable();

            var doc = w.utilities.stringToXML(response.document);
            if (doc === null) {
                console.warn('nerve.run: could not parse response from NERVE');
            }
            var context = JSON.parse(response.context);
            var entities = processNerveResponse(doc, context);

            li.setText('Processing Response');

            w.tagger.removeNoteWrappersForEntities();

            w.utilities.processArray(entities, addEntityFromNerve).then(()=>{
                w.tagger.addNoteWrappersForEntities();

                li.hide();
    
                renderEntitiesList();
    
                w.tree.enable();
                w.entitiesList.enable();
    
                w.editor.setMode('readonly');
                $parent.find('button.run').hide();
                $parent.find('button.done').show();
    
                $parent.find('.filters').show();
                $parent.find('.listActions').show();
    
                $parent.find('select[name="processOptions"]').selectmenu('option', 'disabled', true);
                $parent.find('button.mergeEntities').button('enable');
            });
            
        }, function(msg) {
            console.warn('encoding failed', msg);
            li.hide();
            w.dialogManager.show('message', {
                title: 'Error',
                msg: 'The NERVE server returned an error: '+msg.exception,
                type: 'error'
            });
        });
    }

    // Converts to xml using just the _tag attribute and ignores everything else.
    // We don't want to do a full/normal conversion because of differences between entities in the editor and in the outputted xml.
    var getBasicXmlDocument = function() {
        var xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n<?xml-model href="'+w.schemaManager.getCurrentSchema().url+'" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>\n';

        function _nodeToStringArray(currNode) {
            var array = [];
            var tag = currNode.attr('_tag');
            if (tag !== undefined) {
                array.push('<'+tag+'>');
                array.push('</'+tag+'>');
            } else {
                array = ['',''];
            }
            return array;
        }

        function doBuild(currentNode) {
            var tags = _nodeToStringArray(currentNode);
            xmlString += tags[0];
            currentNode.contents().each(function(index, el) {
                if (el.nodeType == Node.ELEMENT_NODE) {
                    doBuild($(el));
                } else if (el.nodeType == Node.TEXT_NODE) {
                    xmlString += w.utilities.convertTextForExport(el.data);
                }
            });
            xmlString += tags[1];
        }

        w.entitiesManager.highlightEntity();
        var root = w.schemaManager.getRoot();
        var $body = $(w.editor.getBody());
        var $rootEl = $body.children('[_tag='+root+']');
        doBuild($rootEl);
        
        xmlString = xmlString.replace(/\uFEFF/g, '');

        return xmlString;
    }

    var processNerveResponse = function(document, context) {
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

        var getEntities = function(el) {
            var tag = el.nodeName;
            var contextEntry = tagsContext[tag];
            if (contextEntry !== undefined) {
                var lemma = el.getAttribute(contextEntry.lemma);
                var uri = el.getAttribute(contextEntry.uri);
                if (lemma !== null || uri !== null) {
                    var type = contextEntry.type;//w.schemaManager.mapper.getEntityTypeForTag(tag);
                    if (type === undefined) {
                        console.warn('nerve: unrecognized entity type for',tag);
                    } else {
                        var xpath = w.utilities.getElementXPath(el.parentElement);
                        var offset = getOffsetFromParent(el.parentElement, el);
                        var entity = {
                            text: el.textContent,
                            xpath: xpath,
                            textOffset: offset,
                            textLength: el.textContent.length,
                            type: type
                        }
                        if (lemma !== null) {
                            entity.lemma = lemma;
                        }
                        if (uri !== null) {
                            entity.uri = uri;
                        }
                        entities.push(entity);
                    }
                }
            }

            for (var i = 0; i < el.children.length; i++) {
                var child = el.children[i];
                if (child.nodeName !== w.schemaManager.mapper.getHeaderTag()) {
                    getEntities(child);
                }
            }
        }
        
        getEntities(document.documentElement);

        return entities;
    }

    var getNerveEntities = function() {
        var entities = w.entitiesManager.getEntitiesArray(getCurrentSorting());
        entities = entities.filter(function(entry) {
            return entry.getCustomValue('nerve') === 'true';
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
                    var idIndex = entry.entityIds.indexOf(currId);
                    entityIndex = idIndex - 1;
                    if (entityIndex < 0) {
                        entityIndex = entry.entityIds.length-1;
                    }
                }
            } else {
                if (currId == null) {
                    entityIndex = 0;
                } else {
                    var idIndex = entry.entityIds.indexOf(currId);
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
                    filterEntityView(type);
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
                    '<span class="entityTitle">'+entity.getContent()+'</span>'+
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
                    '<span class="entityTitle">'+entry.lemma+'</span>'+
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
        view.find('.entityTitle').text(entity.getContent());
        view.find('.info').html(getEntityViewInfo(entity));
    }

    var filterEntityView = function(filterType) {
        $parent.find('ul.entitiesList > li').each(function(index, el) {
            if (filterType === 'all' || $(this).hasClass(filterType)) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    }

    var getFilter = function() {
        return $parent.find('select[name="filter"]').val();
    }
    var setFilter = function(value) {
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
                    nerve: 'true'
                }
            };
            if (entry.lemma !== '') {
                entityConfig.lemma = entry.lemma;
            }
            if (entry.uri !== '') {
                entityConfig.uri = entry.uri;
            }
            var entity = w.entitiesManager.addEntity(entityConfig);

            w.tagger.addEntityTag(entity, range);
            $('#'+entity.id, w.editor.getBody()).attr('_candidate', 'true'); // have to manually add this since addEntityTag won't (since it's reserved)

            range.collapse();
            return true;
        }
        return false;
    }

    var acceptEntity = function(entityId) {
        var entity = w.entitiesManager.getEntity(entityId);
        var taggedByNerve = entity.getCustomValue('nerve') !== undefined;
        
        var uri = entity.getURI();
        var lemma = entity.getLemma();

        if (uri !== undefined) {
            var uriMapping = w.schemaManager.mapper.getAttributeForProperty(entity.getType(), 'uri');
            if (uriMapping !== undefined) {
                entity.setAttribute(uriMapping, uri);
            }
        }
        if (lemma !== undefined) {
            var lemmaMapping = w.schemaManager.mapper.getAttributeForProperty(entity.getType(), 'lemma');
            if (lemmaMapping !== undefined) {
                entity.setAttribute(lemmaMapping, lemma);
            }
        }

        if (taggedByNerve && uri === undefined) {
            w.tagger.removeEntity(entityId);
        } else {
            entity.removeCustomValue('nerve');
            entity.removeAttribute('_candidate');
            $('#'+entityId, w.editor.getBody()).removeAttr('_candidate');
        }

        removeEntityFromView(entityId);
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
        w.tree.disable();
        w.entitiesList.disable();
        
        var filter = getFilter();

        for (var key in mergedEntities) {
            var entry = mergedEntities[key];
            if (filter === 'all' || filter === entry.type) {
                acceptMerged(key);
            }
        }

        getNerveEntities().forEach(function(ent, index) {
            if (filter === 'all' || filter === ent.getType()) {
                acceptEntity(ent.getId());
            }
        });

        setFilter('all');

        renderEntitiesList();

        w.tree.enable();
        w.entitiesList.enable();
    }

    var rejectEntity = function(entityId) {
        var entry = w.entitiesManager.getEntity(entityId);
        var taggedByNerve = entry.getCustomValue('nerve') !== undefined;
        if (taggedByNerve) {
            if (entry.getURI() === undefined) {
                // remove tag and entity if both added by nerve
                w.tagger.removeStructureTag(entityId, false);
            } else {
                // if tag already existed and nerve is just linking, then only remove the entity
                w.tagger.removeEntity(entityId);
            }
        } else {
            w.tagger.removeEntity(entityId);
        }
        removeEntityFromView(entityId);
    }

    var rejectAll = function(isDone) {
        w.tree.disable();
        w.entitiesList.disable();

        var filter = getFilter();

        for (var key in mergedEntities) {
            var entry = mergedEntities[key];
            if (isDone || filter === 'all' || filter === entry.type) {
                rejectMerged(key);
            }
        }

        getNerveEntities().forEach(function(ent, index) {
            if (isDone || filter === 'all' || filter === ent.getType()) {
                rejectEntity(ent.getId());
            }
        });

        setFilter('all');

        renderEntitiesList();

        w.tree.enable();
        w.entitiesList.enable();
    }

    var editEntity = function(entityId) {
        if (editDialog === null) {
            editDialog = new NerveEditDialog(w, $parent);
            editDialog.$el.dialog('option', 'modal', false); // TODO modal dialog interferes with typing in lookups input
            editDialog.$el.on('save', function(e, dialog) {
                var entity = w.entitiesManager.getEntity(dialog.currentId);
                
                updateEntityView(entity, true);
                filterEntityView(getFilter());
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
};

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

function NerveEditDialog(writer, parentEl) {
    var w = writer;
    var forceSave = false; // needed for confirmation dialog in beforeSave
    var $el = $(''+
    '<div class="annotationDialog">'+
        '<div>'+
            '<select data-transform="selectmenu" data-type="select" data-mapping="prop.type">'+
                '<option value="person">Person</option>'+
                '<option value="place">Place</option>'+
                '<option value="org">Organization</option>'+
                '<option value="title">Title</option>'+
            '</select>'+
        '</div>'+
        '<div>'+
            '<label>Standard name:</label>'+
            '<input type="text" data-type="textbox" data-mapping="prop.lemma" />'+
        '</div>'+
        '<div>'+
            '<label>URI:</label>'+
            '<input type="text" data-type="textbox" data-mapping="prop.uri" style="margin-right: 5px;" />'+
            '<button type="button" title="Entity lookup" data-action="lookup"></button>'+
        '</div>'+
    '</div>').appendTo(parentEl);

    var dialog = new DialogForm({
        writer: w,
        $el: $el,
        type: 'person',
        title: 'Edit Entity',
        width: 350,
        height: 300
    });

    $el.find('button[data-action=lookup]').button({icon: 'ui-icon-search'}).on('click', function() {
        var entity = dialog.showConfig.entry;
        var type = $el.find('select').val();
        var query = entity.content.trim().replace(/\s+/g, ' ');
        doLookup(w, query, type, function(result) {
            $el.find('input[data-mapping="prop.lemma"]').val(result.name);
            $el.find('input[data-mapping="prop.uri"]').val(result.uri);
        });
    });

    dialog.$el.on('beforeShow', function() {
        forceSave = false;
    });

    dialog.$el.on('beforeSave', function(e, dialog) {
        if (forceSave) {
            dialog.isValid = true;
        } else {
            var uri = dialog.currentData.properties.uri;
            if (uri !== undefined && uri.search(/^https?:\/\//) !== 0) {
                dialog.isValid = false;
                w.dialogManager.confirm({
                    title: 'Warning',
                    msg: '<p>The URI you\'ve entered does not look valid.</p>'+
                    '<p>Are you sure you want to use it?</p>',
                    showConfirmKey: 'confirm-nerve-uri',
                    type: 'info',
                    callback: function(doIt) {
                        setTimeout(function() { // need setTimeout in case confirm dialog is skipped
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
            var type = dialog.currentData.properties.type;
            var tag = w.schemaManager.mapper.getParentTag(type);
            dialog.currentData.properties.tag = tag;

            var lemmaMapping = w.schemaManager.mapper.getAttributeForProperty(type, 'lemma');
            if (lemmaMapping) {
                dialog.currentData.attributes[lemmaMapping] = dialog.currentData.properties.lemma
            }
            var uriMapping = w.schemaManager.mapper.getAttributeForProperty(type, 'uri');
            if (uriMapping) {
                dialog.currentData.attributes[uriMapping] = dialog.currentData.properties.uri
            }
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
        position: { my: "center", at: "center", of: w.layoutManager.getContainer() },
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
