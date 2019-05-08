'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/button');
require('jquery-ui/ui/widgets/selectmenu');
    
/**
 * @class EntitiesList
 * @fires Writer#entitiesListInitialized
 * @param {Object} config
 * @param {Writer} config.writer
 * @param {String} config.parentId
 */
function EntitiesList(config) {
    
    var w = config.writer;
    var id = config.parentId;

    var isConvert = false; // are we in convert mode

    var $entities = $('#'+id);
    $entities.append(
        `<div class="moduleParent entitiesPanel">
            <div class="moduleHeader">
                <div>
                    <button type="button" class="convert">Scrape Candidate Entities</button>
                    <span style="display: none;">Candidate Entities</span>
                </div>
                <div class="convertActions" style="display: none;">
                    <button type="button" class="accept">Accept All</button>
                    <button type="button" class="reject">Reject All</button>
                    <button type="button" class="done">Done</button>
                </div>
            </div>
            <div class="moduleContent">
                <ul class="entitiesList"></ul>
            </div>
            <div class="moduleFooter">
                <div style="display: inline-block;">
                    <label for="filter" title="Filter" class="fas fa-filter"></label>
                    <select name="filter">
                        <option value="all" selected="selected">All</option>
                        <option value="person">Person</option>
                        <option value="place">Place</option>
                        <option value="date">Date</option>
                        <option value="org">Organization</option>
                        <option value="citation">Citation</option>
                        <option value="note">Note</option>
                        <option value="title">Title</option>
                        <option value="correction">Correction</option>
                        <option value="keyword">Keyword</option>
                        <option value="link">Link</option>
                    </select>
                </div>
                <div style="display: inline-block;">
                    <label for="sorting" title="Sorting" class="fas fa-sort"></label>
                    <select name="sorting">
                        <option value="seq" selected="selected">Sequential</option>
                        <option value="alpha">Alphabetical</option>
                        <option value="cat">Categorical</option>
                    </select>
                </div>
            </div>
        </div>`
    );

    $entities.find('select').selectmenu({
        appendTo: w.layoutManager.getContainer(),
        position: {
            my: "left bottom", at: "left top", collision: "flipfit"
        },
        width: 90
    });

    $entities.find('button.convert').button().click(function() {
        convertEntities();
    });
    $entities.find('button.accept').button().click(function() {
        acceptAll();
        pm.update();
    });
    $entities.find('button.reject').button().click(function() {
        rejectAll();
        pm.update();
    });
    $entities.find('button.done').button().click(function() {
        if (getCandidates().length > 0) {
            w.dialogManager.confirm({
                title: 'Warning',
                msg: '<p>All the remaining entities in the panel will be rejected.</p>'+
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

    if (w.isReadOnly) {
        $entities.find('.moduleHeader').hide();
    }

    var getFilter = function() {
        return $entities.find('select[name="filter"]').val();
    }
    var setFilter = function(value) {
        $entities.find('select[name="filter"]').val(value).selectmenu('refresh');
    }
    var getSorting = function() {
        return $entities.find('select[name="sorting"]').val();
    }

    $entities.find('select[name="filter"]').on('selectmenuchange', function() { pm.update() });
    $entities.find('select[name="sorting"]').on('selectmenuchange', function() { pm.update() });
    // $entities.find('select[name="filter"]').on('change', function() { pm.update() });
    // $entities.find('select[name="sorting"]').on('change', function() { pm.update() });

    /**
     * @lends EntitiesList.prototype
     */
    var pm = {};

    pm.update = function() {
        clear();

        var entities = w.entitiesManager.getEntitiesArray(getSorting());

        entities = entities.filter(function(entry) {
            return entry.getCustomValue('nerve') !== 'true';
        });

        var filter = getFilter();
        if (filter !== 'all') {
            entities = entities.filter(function(entry) {
                return entry.getType() === filter;
            });
        }

        var entitiesString = '';
        entities.forEach(function(entry) {
            entitiesString += getEntityView(entry);
        });

        if (isConvert) {
            $entities.find('ul.entitiesList').addClass('candidates');
        } else {
            $entities.find('ul.entitiesList').removeClass('candidates');
        }
        
        $entities.find('ul.entitiesList').html(entitiesString);
        $entities.find('ul.entitiesList > li > div').on('click', function(event) {
            $(this).parent().toggleClass('expanded');
            var id = $(this).parent().data('id');
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
            switch (action) {
                case 'edit':
                    w.tagger.editTagDialog(id);
                    break;
                case 'accept':
                    acceptEntity(id);
                    pm.update();
                    break;
                case 'reject':
                    rejectEntity(id);
                    pm.update();
                    break;
                case 'remove':
                    w.tagger.removeEntity(id);
                    break;
                case 'acceptmatching':
                    acceptMatching(id);
                    pm.update();
                    break;
                case 'rejectmatching':
                    rejectMatching(id);
                    pm.update();
                    break;
            }
        });
        
        if (w.entitiesManager.getCurrentEntity()) {
            $entities.find('ul.entitiesList  > li[data-id="'+w.entitiesManager.getCurrentEntity()+'"]').addClass('expanded').find('div[class="info"]').show();
        }
    };

    var getEntityView = function(entity) {
        var isCandidate = entity.getAttribute('_candidate') === 'true';

        var infoString = '<ul>';
        var entityAttributes = entity.getAttributes()
        var urlAttributes = w.schemaManager.mapper.getUrlAttributes();
        for (var name in entityAttributes) {
            if (w.converter.reservedAttributes[name] !== true) {
                var value = entityAttributes[name];
                if (urlAttributes.indexOf(name) !== -1 || value.indexOf('http') === 0) {
                    infoString += '<li><strong>'+name+'</strong>: <a href="'+value+'" target="_blank" rel="noopener">'+value+'</a></li>';
                } else {
                    infoString += '<li><strong>'+name+'</strong>: '+value+'</li>';
                }
            }
        }
        infoString += '</ul>';

        var actions = '';
        if (w.isReadOnly === false) {
            if (isConvert && isCandidate) {
                actions = '<span data-action="accept" class="ui-state-default" title="Accept"><span class="ui-icon ui-icon-check"/></span>'+
                '<span data-action="reject" class="ui-state-default" title="Reject"><span class="ui-icon ui-icon-close"/></span>';
                var hasMatching = getMatchesForEntity(entity.getId()).length > 0;
                if (hasMatching) {
                    actions += '<span data-action="acceptmatching" class="ui-state-default" title="Accept All Matching"><span class="ui-icon ui-icon-circle-check"/></span>';
                    actions += '<span data-action="rejectmatching" class="ui-state-default" title="Reject All Matching"><span class="ui-icon ui-icon-circle-close"/></span>';
                }
            } else {
                actions = '<span data-action="edit" class="ui-state-default" title="Edit"><span class="ui-icon ui-icon-pencil"/></span>'+
                '<span data-action="remove" class="ui-state-default" title="Remove"><span class="ui-icon ui-icon-close"/></span>';
            }
        }

        return `
        <li class="${entity.getType()} ${isCandidate ? 'candidate' : ''}" data-type="${entity.getType()}" data-id="${entity.getId()}">
            <div>
                <div class="header">
                    <span class="icon"/>
                    <span class="entityTitle">${entity.getContent()}</span>
                    <div class="actions">${actions}</div>
                </div>
                <div class="info">${infoString}</div>
            </div>
        </li>`;
    }
    
    pm.destroy = function() {
        $entities.find('button').button('destroy');
        $entities.find('select').selectmenu('destroy');
        $entities.remove();
    };

    var clear = function() {
        $entities.find('ul').empty();
    };
    
    var remove = function(id) {
        $entities.find('li[data-id="'+id+'"]').remove();
    };

    // CONVERSION
    var convertEntities = function() {
        var typesToFind = ['person', 'place', 'date', 'org', 'title', 'link'];
        var potentialEntitiesByType = w.schemaManager.mapper.findEntities(typesToFind);
        var potentialEntities = [];
        for (var type in potentialEntitiesByType) {
            potentialEntities = potentialEntities.concat(potentialEntitiesByType[type]);
        }

        // filter out duplicates
        potentialEntities = potentialEntities.filter(function(value, index, array) {
            return array.indexOf(value) === index;
        });

        if (potentialEntities.length > 0) {
            isConvert = true;
            $entities.find('.convertActions').show();
            $entities.find('button.convert').hide().button('option', 'disabled', true).next('span').show();

            var li = w.dialogManager.getDialog('loadingindicator');
            li.setText('Converting Entities');
            li.show();

            w.utilities.processArray(potentialEntities, function(el) {
                var entity = w.schemaManager.mapper.convertTagToEntity(el);
                entity.setAttribute('_candidate', 'true');
                $('#'+entity.id, w.editor.getBody()).attr('_candidate', 'true');
            }).then(function() {
                li.hide();
                w.event('contentChanged').publish();
            });
        } else {
            w.dialogManager.show('message', {
                title: 'Entities',
                msg: 'No candidate entities were found.',
                type: 'info'
            });
        }
    }

    var getCandidates = function() {
        var entities = w.entitiesManager.getEntitiesArray();
        entities = entities.filter(function(entry) {
            return entry.getAttribute('_candidate') === 'true' && entry.getCustomValue('nerve') !== 'true';
        });
        return entities;
    }

    var getMatchesForEntity = function(entityId) {
        var matches = [];
        var match = w.entitiesManager.getEntity(entityId);
        w.entitiesManager.eachEntity(function(i, ent) {
            if (ent.getId() !== match.getId()) {
                if (JSON.stringify(ent.getAttributes()) === JSON.stringify(match.getAttributes()) &&
                    JSON.stringify(ent.getCustomValues()) === JSON.stringify(match.getCustomValues()) &&
                    ent.getContent() === match.getContent()
                ) {
                    matches.push(ent.getId());
                }
            }
        });
        return matches;
    }

    var acceptEntity = function(entityId) {
        var entity = w.entitiesManager.getEntity(entityId);
        entity.removeAttribute('_candidate');
        $('#'+entity.id, w.editor.getBody()).removeAttr('_candidate');
    }

    var rejectEntity = function(entityId) {
        w.tagger.removeEntity(entityId);
    }

    var acceptMatching = function(entityId) {
        var matches = getMatchesForEntity(entityId);
        
        acceptEntity(entityId);
        matches.forEach(function(entId) {
            acceptEntity(entId);
        });
    }

    var rejectMatching = function(entityId) {
        var matches = getMatchesForEntity(entityId);
        
        rejectEntity(entityId);
        matches.forEach(function(entId) {
            rejectEntity(entId);
        });
    }

    var acceptAll = function() {
        var filter = getFilter();
        w.entitiesManager.eachEntity(function(i, entity) {
            if (entity.getAttribute('_candidate') === 'true' && entity.getCustomValue('nerve') !== 'true') {
                if (filter === 'all' || filter === entity.getType()) {
                    acceptEntity(entity.getId());
                }
            }
        });
        setFilter('all');
    }

    var rejectAll = function() {
        var filter = getFilter();
        w.entitiesManager.eachEntity(function(i, entity) {
            if (entity.getAttribute('_candidate') === 'true' && entity.getCustomValue('nerve') !== 'true') {
                if (filter === 'all' || filter === entity.getType()) {
                    rejectEntity(entity.getId());
                }
            }
        });
        setFilter('all');
    }

    var handleDone = function() {
        isConvert = false;
        $entities.find('.convertActions').hide();
        $entities.find('button.convert').show().button('option', 'disabled', false).next('span').hide();
        pm.update();
    }
    // CONVERSION END
    
    w.event('loadingDocument').subscribe(function() {
        clear();
        handleDone();
    });
    w.event('documentLoaded').subscribe(function() {
        pm.update();
    });
    w.event('schemaLoaded').subscribe(function() {
        pm.update();
    });
    w.event('contentChanged').subscribe(function() {
        pm.update();
    });
    w.event('contentPasted').subscribe(function() {
        pm.update();
    });
    w.event('entityAdded').subscribe(function(entityId) {
        pm.update();
    });
    w.event('entityEdited').subscribe(function(entityId) {
        pm.update();
    });
    w.event('entityRemoved').subscribe(function(entityId) {
        remove(entityId);
    });
    w.event('entityFocused').subscribe(function(entityId) {
        $entities.find('ul.entitiesList > li[data-id="'+entityId+'"]').addClass('expanded');
    });
    w.event('entityUnfocused').subscribe(function(entityId) {
        $entities.find('ul.entitiesList > li').each(function(index, el) {
            $(this).removeClass('expanded');
        });
    });
    w.event('entityPasted').subscribe(function(entityId) {
        pm.update();
    });


    // add to writer
    w.entitiesList = pm;
    
    w.event('entitiesListInitialized').publish(pm);
    
    return pm;
};

module.exports = EntitiesList;
