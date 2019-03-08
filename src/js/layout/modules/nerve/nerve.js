'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/button');
require('jquery-ui/ui/widgets/selectmenu');

var DialogForm = require('dialogForm');

var NERVEWrapper = require('cwrc-nerve-wrapper');

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
                    '<span class="all active" /> | <span class="person" /> | <span class="place" /> | <span class="org" /> | <span class="title" />'+
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
    $parent.find('button.run').button().click(function() {
        var options = $parent.find('select[name=processOptions]').val();
        nrv.reset();
        var document = w.converter.getDocumentContent(false);
        var optionsArray = ['tag', 'link'];
        if (options === 'tag') {
            optionsArray = ['tag'];
        } else if (options === 'link') {
            optionsArray = ['link'];
        }
        nerveWrapper.run(document, optionsArray).then(function(resp) {
            var entities = processEncodedDocument(resp.result);

            var index = entities.length-1;
            while (index >= 0) {
                var entry = entities[index];
                var success = addEntity(entry);
                if (!success) {
                    entities.splice(index, 1);
                }
                index--;
            }

            renderEntitiesList(false);

            $(w.editor.getBody()).addClass('nerve');
            w.editor.setMode('readonly');
            $parent.find('button.run').hide();
            $parent.find('button.done').show();

            $parent.find('.filters').show();
            $parent.find('.moduleHeader .actions').show();

            $parent.find('select').selectmenu('option', 'disabled', true);
        }, function() {
            console.warn('encoding failed', arguments);
        });
    });
    // DONE
    $parent.find('button.done').button().click(function() {
        $parent.find('select').selectmenu('option', 'disabled', false);
        $(w.editor.getBody()).removeClass('nerve');
        w.editor.setMode('design');
        nrv.reset();
    });
    // FILTER
    $parent.find('.filters > span').click(function() {
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
    $parent.find('button.expand').button().click(function() {
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
    $parent.find('button.accept').button().click(function() {
        getNerveEntities().forEach(function(ent, index) {
            acceptEntity(ent.getId());
        });
    });
    // REJECT ALL
    $parent.find('button.reject').button().click(function() {
        getNerveEntities().forEach(function(ent, index) {
            rejectEntity(ent.getId());
        });
    });
    // ENTER MERGE MODE
    $parent.find('button.mergeEntities').button().click(function() {
        $parent.find('.mergeActions').show();
        $(this).hide();
        renderEntitiesList(true);
    });
    // MERGE DIALOG
    $parent.find('.moduleFooter button.merge').button().click(function() {
        mergeEntities();
    });
    // CANCEL MERGE
    $parent.find('.moduleFooter button.cancelMerge').button().click(function() {
        $parent.find('.mergeActions').hide();
        $parent.find('button.mergeEntities').show();
        renderEntitiesList(false);
    });

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
                        uri: node.getAttribute('data-link'),
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

        var doc = w.utilities.stringToXML('<wrap>'+documentString+'</wrap>');
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

        var typeCounts = {
            person: 0,
            place: 0,
            org: 0,
            title: 0
        }

        var entityHtml = '';

        getNerveEntities().forEach(function(ent, index) {
            typeCounts[ent.type]++;

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
        $parent.find('ul.entitiesList > li > div').hover(function() {
            // $(this).addClass('over');
        }, function() {
            // $(this).removeClass('over');
        }).on('click', function(event) {
            $(this).toggleClass('expanded');
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
                    } else {
                        acceptEntity(id);
                    }
                    break;
                case 'acceptall':
                    acceptAll(id);
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
            $parent.find('ul.entitiesList > li > input').click(function() {
                var checked = getCheckedEntities();
                if (checked.length === 0) {
                    filterEntityView('all');
                } else {
                    var type = checked.first().data('type');
                    filterEntityView(type);
                }
            });
        }

        var total = typeCounts.person + typeCounts.place + typeCounts.org + typeCounts.title;
        $parent.find('.filters .all').text('All ('+total+')');
        $parent.find('.filters .person').text('People ('+typeCounts.person+')');
        $parent.find('.filters .place').text('Places ('+typeCounts.place+')');
        $parent.find('.filters .org').text('Organizations ('+typeCounts.org+')');
        $parent.find('.filters .title').text('Titles ('+typeCounts.title+')');
    }

    var getEntityView = function(entity, merge) {
        var html = ''+
        '<li class="'+entity.getType()+'" data-type="'+entity.getType()+'" data-id="'+entity.getId()+'">'+
            (merge === true ? '<input type="checkbox" />' : '')+
            '<div>'+
                '<div class="header">'+
                    '<span class="icon"/>'+
                    '<span class="entityTitle">'+entity.getContent()+'</span>'+
                    '<div class="actions">'+
                        '<span data-action="edit" class="ui-state-default" title="Edit"><span class="ui-icon ui-icon-pencil"></span></span>'+
                        '<span data-action="accept" class="ui-state-default" title="Accept"><span class="ui-icon ui-icon-check"></span></span>'+
                        '<span data-action="acceptall" class="ui-state-default" title="Accept All"><span class="ui-icon ui-icon-circle-check"></span></span>'+
                        '<span data-action="reject" class="ui-state-default" title="Reject"><span class="ui-icon ui-icon-close"></span></span>'+
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
                    '<span class="icon" style="margin-right: 0px;"/><span class="icon"/>'+
                    '<span class="entityTitle">'+entry.lemma+'</span>'+
                    '<div class="nav">'+
                        '<span data-action="previous" class="ui-state-default" title="Previous Entity"><span class="ui-icon ui-icon-circle-arrow-w"></span></span>'+
                        '<span data-action="next" class="ui-state-default" title="Next Entity"><span class="ui-icon ui-icon-circle-arrow-e"></span></span>'+
                    '</div>'+
                    '<div class="actions">'+
                        '<span data-action="unmerge" class="ui-state-default" title="Unmerge"><span class="ui-icon ui-icon-scissors"></span></span>'+
                        '<span data-action="edit" class="ui-state-default" title="Edit"><span class="ui-icon ui-icon-pencil"></span></span>'+
                        '<span data-action="accept" class="ui-state-default" title="Accept"><span class="ui-icon ui-icon-check"></span></span>'+
                        '<span data-action="reject" class="ui-state-default" title="Reject"><span class="ui-icon ui-icon-close"></span></span>'+
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
        var lemma = entity.getCustomValue('lemma');
        if (lemma !== undefined) {
            html += '<li><strong>Standard</strong>: '+lemma+'</li>';
        }
        var uri = entity.getCustomValue('uri')
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

    var getEntryForEntityId = function(entityId) {
        return w.entitiesManager.getEntity(entityId);
    }

    var removeEntityFromView = function(entityId) {
        $parent.find('ul.entitiesList li[data-id='+entityId+']').remove();
    }

    var selectRangeForEntity = function(entry) {
        var parent = w.utilities.evaluateXPath(w.editor.getDoc(), entry.xpath);
        if (parent === null) {
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

    var addEntity = function(entry) {
        var range = selectRangeForEntity(entry);
        if (range !== null) {
            var entityConfig = {
                type: entry.type,
                content: entry.text,
                attributes: {
                    nerve: 'nerve'
                },
                customValues: {
                    nerve: 'true'
                }
            };
            if (entry.lemma !== '') {
                entityConfig.customValues.lemma = entry.lemma;
            }
            if (entry.uri !== '') {
                entityConfig.customValues.uri = entry.uri;
            }
            var entity = w.entitiesManager.addEntity(entityConfig);

            entry.id = entity.id;

            w.tagger.addEntityTag(entity, range);
            range.collapse();
            return true;
        }
        return false;
    }

    var acceptEntity = function(entityId) {
        var entity = w.entitiesManager.getEntity(entityId);
        entity.removeCustomValue('nerve');
        entity.removeAttribute('nerve');
        $('#'+entityId, w.editor.getBody()).removeAttr('nerve');
        removeEntityFromView(entityId);
    }

    var acceptAll = function(entityId) {
        var matches = [];
        var match = w.entitiesManager.getEntity(entityId);
        getNerveEntities().forEach(function(ent) {
            if (ent.getContent() === match.getContent() &&
                ent.getCustomValue('lemma') === match.getCustomValue('lemma') &&
                ent.getCustomValue('uri') == match.getCustomValue('uri')) {
                    matches.push(ent.getId());
                }
        });
        matches.forEach(function(entId) {
            acceptEntity(entId);
        });
    }

    var rejectEntity = function(entityId) {
        w.tagger.removeEntity(entityId);
        removeEntityFromView(entityId);
    }

    var editEntity = function(entityId) {
        if (editDialog === null) {
            editDialog = new NerveEditDialog(w, $parent);
            editDialog.$el.dialog('option', 'modal', false); // TODO modal dialog interferes with typing in lookups input
            editDialog.$el.on('save', function(e, dialog) {
                var entity = w.entitiesManager.getEntity(dialog.currentId);
                updateEntityView(entity, true);
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
            mergeDialog.$el.on('merge', function(e, entities, mergeId, lemma, uri) {
                if (mergeId != null) {
                    mergedEntities[mergeId].lemma = lemma;
                    mergedEntities[mergeId].uri = uri;
                } else {
                    var ids = entities.map(function(ent) {
                        return ent.getId();
                    });
                    var mId = w.getUniqueId('merged');
                    mergedEntities[mId] = {
                        entityIds: ids,
                        type: entities[0].getType(),
                        lemma: lemma,
                        uri: uri
                    };
            
                    $parent.find('.mergeActions').hide();
                    $parent.find('button.mergeEntities').show();
                }
                renderEntitiesList(false);
            });
            mergeDialog.$el.on('cancel', function() {
            });
        }
        mergeDialog.show();
        
        var entities = [];
        if (id !== undefined) {
            var entry = mergedEntities[id];
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

        mergeDialog.populate(entities, id);
    }

    var unmergeEntities = function(mergeId) {
        delete mergedEntities[mergeId];
        renderEntitiesList(false);
    }

    var acceptMerged = function(mergeId) {
        var entry = mergedEntities[mergeId];
        entry.entityIds.forEach(function(entId) {
            acceptEntity(entId);
        });
        delete mergedEntities[mergeId];
        renderEntitiesList(false);
    }

    var rejectMerged = function(mergeId) {
        var entry = mergedEntities[mergeId];
        entry.entityIds.forEach(function(entId) {
            rejectEntity(entId);
        });
        delete mergedEntities[mergeId];
        renderEntitiesList(false);
    }

    var getCheckedEntities = function() {
        return $parent.find('ul.entitiesList > li > input:checked').parent('li');
    }


    var messageRelay = function(msgType, msgContent) {
        var li = w.dialogManager.getDialog('loadingindicator');
        switch(msgType) {
            case 'serverStart':
                li.setText(msgContent);
                li.setValue(5);
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
    var url = "ws://dh.sharcnet.ca:8080/NERVESERVER/NerveSocket";
    url = "ws://localhost:8888/nerveserver/NerveSocket"; // TODO
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
            '<p>Standard name:</p>'+
            '<input type="text" data-type="textbox" data-mapping="custom.lemma" style="width:300px;" />'+
        '</div>'+
        '<div>'+
            '<p>URI:</p>'+
            '<input type="text" data-type="textbox" data-mapping="custom.uri" style="width:250px; margin-right: 5px;" />'+
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

    $el.find('button[data-action=lookup]').button({icon: 'ui-icon-search'}).click(function() {
        var entity = dialog.showConfig.entry;
        var type = $el.find('select').val();
        doLookup(entity.content, type);
    });

    var doLookup = function(query, type) {
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
                $el.find('input[data-mapping="custom.lemma"]').val(result.name);
                $el.find('input[data-mapping="custom.uri"]').val(result.uri);
            },
            error: function(errorThrown) {
            }
        });
    }

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
    var currId = null; // for editing

    var $el = $(''+
    '<div class="annotationDialog">'+
        '<div class="selections">'+
            '<h3>Selections</h3>'+
            '<ul></ul>'+
        '</div>'+
        '<div class="lemma">'+
            '<label>Standard name:</label>'+
            '<select name="lemma"></select>'+
        '</div>'+
        '<div>'+
            '<label>Other name:</label>'+
            '<input name="otherLemma" type="text"/>'+
        '</div>'+
        '<div class="uri">'+
            '<label>URI:</label>'+
            '<select name="uri"></select>'+
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
                var uri = $el.find('select[name=uri]').val();
                $el.trigger('merge', [currEntities, currId, lemma, uri]);
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

    var reset = function() {
        $el.find('ul').empty();
        $el.find('select').empty().each(function(index, el) {
            if ($(el).selectmenu('instance') !== undefined) {
                $(el).selectmenu('destroy');
            }
        });

        $el.find('input[name=otherLemma]').val('').parent().hide();
    }

    var populate = function(entities, id) {
        currEntities = entities;
        currId = id;

        var selections = '';
        var lemmas = [];
        var uris = [];

        entities.forEach(function(ent, index) {
            selections += '<li>'+ent.getContent()+'</li>';
            var lemma = ent.getCustomValue('lemma');
            if (lemma !== undefined && lemmas.indexOf(lemma) === -1) {
                lemmas.push(lemma);
            }
            var uri = ent.getCustomValue('uri');
            if (uri !== undefined && uris.indexOf('uri') === -1) {
                uris.push(uri);
            }
        });

        var lemmaString = '';
        lemmas.forEach(function(lemma) {
            lemmaString += '<option value="'+lemma+'">'+lemma+'</option>';
        });
        lemmaString += '<option value="[[[other]]]">Other (specify)</option>';

        var uriString = '';
        uris.forEach(function(uri) {
            uriString += '<option value="'+uri+'">'+uri+'</option>';
        })
        uriString += '<option value="[[[other]]]">Other (lookup)</option>';
        
        $el.find('ul').html(selections);
        
        $el.find('select[name=lemma]').html(lemmaString).selectmenu({
            select: function(e, ui) {
                if (ui.item.value === '[[[other]]]') {
                    $el.find('input[name=otherLemma]').parent().show();
                } else {
                    $el.find('input[name=otherLemma]').parent().hide();
                }
            }
        });
        
        $el.find('select[name=uri]').html(uriString).selectmenu({
            select: function(e, ui) {
                if (ui.item.value === '[[[other]]]') {
                } else {
                }
            }
        });
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
