'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/button');
require('jquery-ui/ui/widgets/selectmenu');

var DialogForm = require('dialogForm');

var NERVEWrapper = require('cwrc-nerve-wrapper');

// nerve values to schema mappings
// TODO merge with linkingXPath from mappings
var nerveAttributeMappings = {
    tei: {
        lemma: {
            person: 'key',
            org: 'key',
            place: 'key',
            title: 'key'
        },
        link: {
            person: 'ref',
            org: 'ref',
            place: 'ref',
            title: 'ref'
        },
        responsibility: {
            person: 'resp',
            org: 'resp',
            place: 'resp',
            title: 'resp'
        }
    }
}

/**
 * @class Nerve
 * @param {Object} config
 * @param {Writer} config.writer
 * @param {String} config.parentId
 */
function Nerve(config) {
    var w = config.writer;
    
    var id = config.parentId;

    var mergedEntities = {};

    var editDialog = null; // holder for initialized edit dialog

    var mergeDialog = null; // holder for initialized merge dialog

    var $parent = $('#'+id);
    $parent.append(
        '<div class="moduleParent nervePanel">'+
            '<div class="moduleHeader">'+
                '<div>'+
                    '<select name="processOptions">'+
                        '<option value="tag">Entity Recognition</option>'+
                        '<option value="both">Recognition & Linking</option>'+
                        '<option value="link">Linking Only</option>'+
                    '</select>'+
                    '<button class="run">Run</button>'+
                    '<button class="done" style="display: none;">Done</button>'+
                '</div>'+
                '<div class="filters" style="display: none;">'+
                    '<span class="all active">All <span class="count"/></span> |'+
                    '<span class="person">People <span class="count"/></span> |'+
                    '<span class="place">Places <span class="count"/></span> |'+
                    '<span class="org">Organizations <span class="count"/></span> |'+
                    '<span class="title">Titles <span class="count"/></span>'+
                '</div>'+
                '<div class="actions" style="display: none;">'+
                    '<button class="expand">Expand All</button>'+
                    '<button class="accept">Accept All</button>'+
                    '<button class="reject">Reject All</button>'+
                '</div>'+
            '</div>'+
            '<div class="moduleContent">'+
                '<ul class="entitiesList"></ul>'+
            '</div>'+
            '<div class="moduleFooter">'+
                '<button class="mergeEntities">Merge Entities</button>'+
                '<div class="mergeActions" style="display: none;">'+
                    '<button class="merge">Merge</button>'+
                    '<button class="cancelMerge">Cancel</button>'+
                '</div>'+
            '</div>'+
        '</div>');

    $parent.find('select').selectmenu({
        appendTo: w.layoutManager.getContainer()
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
                type: 'info',
                callback: function(doIt) {
                    if (doIt) {
                        rejectAll();
                        handleDone();
                    }
                }
            });
        } else {
            handleDone();
        }
    });
    // FILTER
    $parent.find('.filters > span').on('click', function() {
        if ($(this).hasClass('active')) {
            // do nothing
        } else {
            $parent.find('.filters > span').removeClass('active');
            var type = this.classList[0];
            filterEntityView(type);
            $(this).addClass('active');
        }

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
        $parent.find('.mergeActions').show();
        $(this).hide();
        renderEntitiesList(true);
    });
    // MERGE DIALOG
    $parent.find('.moduleFooter button.merge').button().on('click', function() {
        mergeEntities();
    });
    // CANCEL MERGE
    $parent.find('.moduleFooter button.cancelMerge').button().on('click', function() {
        $parent.find('.mergeActions').hide();
        $parent.find('button.mergeEntities').show();
        renderEntitiesList(false);
    });

    var run = function() {
        var options = $parent.find('select[name=processOptions]').val();
        nrv.reset();
        // var document = w.converter.getDocumentContent(false);
        var document = getBasicXmlDocument();
        var optionsArray = ['tag', 'link'];
        if (options === 'tag') {
            optionsArray = ['tag'];
        } else if (options === 'link') {
            optionsArray = ['link'];
        }
        nerveWrapper.run(document, optionsArray).then(function(resp) {
            var entities = processEncodedDocument(resp.result);

            w.tagger.removeNoteWrappersForEntities();
            
            var index = entities.length-1;
            while (index >= 0) {
                var entry = entities[index];
                var success = addEntity(entry);
                if (!success) {
                    entities.splice(index, 1);
                }
                index--;
            }

            w.tagger.addNoteWrappersForEntities();

            renderEntitiesList(false);

            $(w.editor.getBody()).addClass('nerve');
            w.editor.setMode('readonly');
            $parent.find('button.run').hide();
            $parent.find('button.done').show();

            $parent.find('.filters').show();
            $parent.find('.moduleHeader .actions').show();

            $parent.find('select').selectmenu('option', 'disabled', true);
            $parent.find('button.mergeEntities').button('enable');
        }, function(msg) {
            console.warn('encoding failed', msg);
            var li = w.dialogManager.getDialog('loadingindicator');
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
        var xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n';

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
                    xmlString += el.data;
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

        console.log(xmlString);

        return xmlString;
    }

    var processEncodedDocument = function(documentString) {
        var entities = [];

        function getOffsetFromParent(parent, target) {
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

        function getEntities(node) {
            if (node.nodeType === Node.ELEMENT_NODE && node.getAttribute('class') === 'taggedentity') {
                var tag = node.getAttribute('xmltagname');
                var type;
                switch (tag) {
                    case 'PERSON':
                        type = 'person';
                        break;
                    case 'LOCATION':
                        type = 'place';
                        break;
                    case 'ORGANIZATION':
                        type = 'org';
                        break;
                    case 'TITLE':
                        type = 'title';
                        break;
                }
                var header = w.schemaManager.mapper.getHeaderTag();
                var xpath = w.utilities.getElementXPath(node.parentElement, 'xmltagname');
                if (xpath.indexOf(header) === -1) {
                    var offset = getOffsetFromParent(node.parentElement, node);
                    var entity = {
                        text: node.textContent,
                        xpath: xpath,
                        textOffset: offset,
                        textLength: node.textContent.length,
                        lemma: node.getAttribute('data-lemma'),
                        link: node.getAttribute('data-link'),
                        type: type
                    }
                    entities.push(entity);
                } else {
                    // don't include tags in the header
                }
            }
            node.childNodes.forEach(function(el, index) {
                getEntities(el);
            });
        }

        var doc = w.utilities.stringToXML('<wrap>'+documentString+'</wrap>'); // need to wrap because response has no root node
        var docChildren = doc.documentElement.childNodes;
        var rootNode = undefined;
        for (var i = 0; i < docChildren.length; i++) {
            var child = docChildren[i];
            if (child.nodeType === Node.ELEMENT_NODE && child.getAttribute('class') === 'xmltag') {
                rootNode = child;
                break;
            }
        }

        if (rootNode !== undefined) {
            getEntities(rootNode);
        }

        return entities;
    }

    var getNerveEntities = function() {
        var entities = [];
        w.entitiesManager.eachEntity(function(index, ent) {
            if (ent.getCustomValue('nerve') === 'true') {
                entities.push(ent);
            }
        });
        entities.sort(function(a, b) {
            if (a.getId() > b.getId()) {
                return -1;
            } else {
                return 1;
            }
        });
        return entities;
    }

    var renderEntitiesList = function(isMerge) {
        $parent.find('.moduleContent ul').empty();

        var entityHtml = '';

        getNerveEntities().forEach(function(ent, index) {
            if (isEntityMerged(ent.getId()) === false) {
                entityHtml += getEntityView(ent, isMerge);
            }
        });

        if (isMerge === false) {
            for (var key in mergedEntities) {
                entityHtml += getMergedEntityView(key);
            }
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

        updateFilterCounts();
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
                        '<span data-action="edit" class="ui-state-default" title="Edit"><span class="ui-icon ui-icon-pencil"></span></span>'+
                        '<span data-action="accept" class="ui-state-default" title="Accept"><span class="ui-icon ui-icon-check"></span></span>'+
                        (hasMatching === true ? '<span data-action="acceptmatching" class="ui-state-default" title="Accept All Matching"><span class="ui-icon ui-icon-circle-check"></span></span>' : '')+
                        '<span data-action="reject" class="ui-state-default" title="Reject"><span class="ui-icon ui-icon-close"></span></span>')+
                    '</div>'+
                '</div>'+
                '<div class="info">'+getEntityViewInfo(entity)+'</div>'+
            '</div>'+
        '</li>';
        return html;
    }

    var getMergedEntityView = function(id) {
        var entry = mergedEntities[id];
        var html = ''+
        '<li class="'+entry.type+' merged" data-type="'+entry.type+'" data-id="'+id+'">'+
            '<div>'+
                '<div class="header">'+
                    '<span class="icon" style="margin-right: -4px;"/><span class="icon"/>'+
                    '<span class="entityTitle">'+entry.lemma+'</span>'+
                    '<div class="actions">'+
                        '<div class="nav">'+
                            '<span data-action="previous" class="ui-state-default" title="Previous Entity"><span class="ui-icon ui-icon-circle-arrow-w"></span></span>'+
                            '<span data-action="next" class="ui-state-default" title="Next Entity"><span class="ui-icon ui-icon-circle-arrow-e"></span></span>'+
                        '</div>'+
                        '<span data-action="unmerge" class="ui-state-default" title="Unmerge"><span class="ui-icon ui-icon-scissors"></span></span>'+
                        '<span data-action="edit" class="ui-state-default" title="Edit"><span class="ui-icon ui-icon-pencil"></span></span>'+
                        '<span data-action="accept" class="ui-state-default" title="Accept"><span class="ui-icon ui-icon-check"></span></span>'+
                        '<span data-action="reject" class="ui-state-default" title="Reject"><span class="ui-icon ui-icon-close"></span></span>'+
                    '</div>'+
                '</div>'+
                '<div class="info">'+
                    '<ul>'+
                        '<li><strong>URI</strong>: <a href="'+entry.link+'" target="_blank" rel="noopener">'+entry.link+'</a></li>'+
                    '</ul>'+
                '</div>'+
            '</div>'+
        '</li>';
        return html;
    }

    var getEntityViewInfo = function(entity) {
        var html = '<ul>';
        var lemma = entity.getCustomValue('lemma');
        if (lemma !== undefined) {
            html += '<li><strong>Standard</strong>: '+lemma+'</li>';
        }
        var link = entity.getCustomValue('link')
        if (link !== undefined) {
            html += '<li><strong>URI</strong>: <a href="'+link+'" target="_blank" rel="noopener">'+link+'</a></li>';
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

    var getCurrentFilter = function() {
        var filter = $parent.find('.filters > span.active');
        var type = filter[0].classList[0];
        return type;
    }

    var updateFilterCounts = function() {
        var typeCounts = {
            person: 0,
            place: 0,
            org: 0,
            title: 0
        }
        getNerveEntities().forEach(function(ent, index) {
            typeCounts[ent.getType()]++;
        });

        var total = typeCounts.person + typeCounts.place + typeCounts.org + typeCounts.title;
        $parent.find('.filters .all .count').text('('+total+')');
        $parent.find('.filters .person .count').text('('+typeCounts.person+')');
        $parent.find('.filters .place .count').text('('+typeCounts.place+')');
        $parent.find('.filters .org .count').text('('+typeCounts.org+')');
        $parent.find('.filters .title .count').text('('+typeCounts.title+')');
    }

    var getEntryForEntityId = function(entityId) {
        return w.entitiesManager.getEntity(entityId);
    }

    var removeEntityFromView = function(id) {
        $parent.find('ul.entitiesList li[data-id='+id+']').remove();
        updateFilterCounts();
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

    var getAttributeForNerveValue = function(valueName, entityType) {
        var schemaId = w.schemaManager.schemaId;
        var mappings = nerveAttributeMappings[schemaId];
        if (mappings === undefined) {
            console.warn('nerve: no attribute mappings for',schemaId);
            return undefined;
        } else {
            return mappings[valueName][entityType];
        }
    }

    var mapCustomValuesToAttributes = function(entity) {
        var type = entity.getType();
        var lemma = entity.getCustomValue('lemma');
        var link = entity.getCustomValue('link');
        var lemmaAttributeName = getAttributeForNerveValue('lemma', type);
        if (lemma && lemmaAttributeName) {
            entity.setAttribute(lemmaAttributeName, lemma);
        }
        var linkAttributeName = getAttributeForNerveValue('link', type);
        if (link && linkAttributeName) {
            entity.setAttribute(linkAttributeName, link);
        }
    }

    var addEntity = function(entry) {
        var range = selectRangeForEntity(entry);
        if (range !== null) {
            var parentEl = range.commonAncestorContainer.parentElement;
            if (parentEl.getAttribute('_entity') === 'true' && range.startOffset === 0) {
                console.log('nerve: entity already exists for',entry);
                range.collapse();
                return false;
            }

            var entityConfig = {
                type: entry.type,
                content: entry.text,
                attributes: {
                    _nerve: 'true'
                },
                customValues: {
                    nerve: 'true'
                }
            };
            if (entry.lemma !== '') {
                entityConfig.customValues.lemma = entry.lemma;
            }
            if (entry.link !== '') {
                entityConfig.customValues.link = entry.link;
            }
            var entity = w.entitiesManager.addEntity(entityConfig);
            mapCustomValuesToAttributes(entity);

            w.tagger.addEntityTag(entity, range);
            $('#'+entity.id, w.editor.getBody()).attr('_nerve', 'true'); // have to manually add this since addEntityTag won't (since it's reserved)

            range.collapse();
            return true;
        }
        return false;
    }

    var acceptEntity = function(entityId) {
        var entity = w.entitiesManager.getEntity(entityId);

        var linkAttributeName = getAttributeForNerveValue('link', entity.getType());
        var linkValue = entity.getAttribute(linkAttributeName);
        if (linkValue === undefined) {
            w.tagger.convertEntityToTag(entityId);
        } else {
            mapCustomValuesToAttributes(entity);
            entity.removeCustomValue('nerve');
            entity.removeCustomValue('lemma');
            entity.removeCustomValue('link');
            entity.removeAttribute('_nerve');
            $('#'+entityId, w.editor.getBody()).removeAttr('_nerve');
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
                ent.getCustomValue('lemma') === match.getCustomValue('lemma') &&
                ent.getCustomValue('link') == match.getCustomValue('link')) {
                    matches.push(ent.getId());
                }
        });
        return matches;
    }

    var acceptAll = function() {
        for (var key in mergedEntities) {
            acceptMerged(key);
        }

        getNerveEntities().forEach(function(ent, index) {
            acceptEntity(ent.getId());
        });

        w.entitiesList.update();
    }

    var rejectEntity = function(entityId) {
        w.tagger.removeEntity(entityId);
        removeEntityFromView(entityId);
    }

    var rejectAll = function() {
        for (var key in mergedEntities) {
            rejectMerged(key);
        }

        getNerveEntities().forEach(function(ent, index) {
            rejectEntity(ent.getId());
        });
    }

    var editEntity = function(entityId) {
        if (editDialog === null) {
            editDialog = new NerveEditDialog(w, $parent);
            editDialog.$el.dialog('option', 'modal', false); // TODO modal dialog interferes with typing in lookups input
            editDialog.$el.on('save', function(e, dialog) {
                var entity = w.entitiesManager.getEntity(dialog.currentId);
                mapCustomValuesToAttributes(entity);
                
                updateEntityView(entity, true);
                updateFilterCounts();
                filterEntityView(getCurrentFilter());
            });
        }
        editDialog.show({entry: getEntryForEntityId(entityId)});
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
            mergeDialog.$el.on('merge', function(e, entities, mergeEntry, lemma, link) {
                if (mergeEntry != null) {
                    mergeEntry.lemma = lemma;
                    mergeEntry.link = link;
                } else {
                    var ids = entities.map(function(ent) {
                        return ent.getId();
                    });
                    var mId = w.getUniqueId('merged_');
                    mergedEntities[mId] = {
                        entityIds: ids,
                        type: entities[0].getType(),
                        lemma: lemma,
                        link: link
                    };
            
                    $parent.find('.mergeActions').hide();
                    $parent.find('button.mergeEntities').show();
                }
                renderEntitiesList(false);
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
                entities.push(entity);
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
        renderEntitiesList(false);
    }

    var acceptMerged = function(mergeId) {
        var entry = mergedEntities[mergeId];
        entry.entityIds.forEach(function(entId) {
            var entity = w.entitiesManager.getEntity(entId);
            entity.setCustomValue('lemma', entry.lemma);
            entity.setCustomValue('link', entry.link);
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
        $(w.editor.getBody()).removeClass('nerve');
        w.editor.setMode('design');
        nrv.reset();

        w.event('contentChanged').publish();
    }


    var messageRelay = function(msgType, msgContent) {
        var li = w.dialogManager.getDialog('loadingindicator');
        switch(msgType) {
            case 'serverStart':
                li.setText(msgContent);
                li.setValue(false);
                li.show();
                break;
            case 'serverUpdateMessage':
                li.setText(msgContent);
                break;
            case 'serverUpdateProgress':
                li.setValue(msgContent);
                break;
            case 'serverEnd':
                li.hide();
                break;
        }
    }

    var nerveWrapper = new NERVEWrapper();
    var url = "wss://dh.sharcnet.ca:443/NERVESERVER/NerveSocket";
    // var url = "ws://localhost:8888/NERVESERVER/NerveSocket";
    nerveWrapper.init(url, messageRelay);

    var nrv = {
        reset: function() {
            mergedEntities = {};
            $parent.find('.moduleContent ul').empty();
            $parent.find('.moduleHeader .actions').hide();
            $parent.find('.filters').hide();
            $parent.find('button.run').show();
            $parent.find('button.done').hide();
        },
        destroy: function() {
            $parent.empty();
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
            '<input type="text" data-type="textbox" data-mapping="custom.lemma" />'+
        '</div>'+
        '<div>'+
            '<label>URI:</label>'+
            '<input type="text" data-type="textbox" data-mapping="custom.link" style="margin-right: 5px;" />'+
            '<button title="Entity lookup" data-action="lookup"></button>'+
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
        doLookup(w, entity.content, type, function(result) {
            $el.find('input[data-mapping="custom.lemma"]').val(result.name);
            $el.find('input[data-mapping="custom.link"]').val(result.uri);
        });
    });

    dialog.$el.on('beforeSave', function(e, dialog) {
        var type = dialog.currentData.properties.type;
        var tag = w.schemaManager.mapper.getParentTag(type);
        dialog.currentData.properties.tag = tag;
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
                '<button title="Entity lookup" data-action="lookup"></button>'+
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
            var lemma = ent.getCustomValue('lemma');
            if (lemma !== undefined && lemmas.indexOf(lemma) === -1) {
                lemmas.push(lemma);
            }
            var link = ent.getCustomValue('link');
            if (link !== undefined && links.indexOf('link') === -1) {
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
            if (entry !== undefined && entry.link !== link) {
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
                $el.find('input[name=otherLink]').val(entry.link).parent().show();
            } else {
                $el.find('select[name=link]').val(entry.link);
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
