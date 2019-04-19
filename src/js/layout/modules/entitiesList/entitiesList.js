'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/button');
require('jquery-contextmenu');
    
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

    var $entities = $('#'+id);
    $entities.append(
        `<div class="moduleParent">
            <div class="moduleHeader">
                <button class="convert">Scrape Candidate Entities</button>
            </div>
            <div class="moduleContent">
                <ul class="entitiesList"></ul>
            </div>
            <div class="moduleFooter">
                <div>
                    <label for="filter">Filter</label>
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
                <div style="margin-top: 5px;">
                    <label for="sorting">Sorting</label>
                    <select name="sorting">
                        <option value="sequential" selected="selected">Sequential</option>
                        <option value="alphabetical">Alphabetical</option>
                        <option value="categorical">Categorical</option>
                    </select>
                </div>
            </div>
        </div>`
    );

    $entities.find('.convert').button().click(function() {
        pm.convertEntities();
    });

    var getFilter = function() {
        return $entities.find('select[name="filter"]').val();
    }
    var getSorting = function() {
        return $entities.find('select[name="sorting"]').val();
    }

    $entities.find('select[name="filter"]').change(function() { pm.update() });
    $entities.find('select[name="sorting"]').change(function() { pm.update() });
    
    if (w.isReadOnly !== true) {
        $.contextMenu({
            selector: '#'+id+' ul.entitiesList > li',
            zIndex: 10,
            appendTo: '#'+w.containerId,
            className: 'cwrc',
            items: {
                edit: {
                    name: 'Edit Entity',
                    icon: 'tag_edit',
                    callback: function(key, opt) {
                        w.tagger.editTagDialog(opt.$trigger.attr('name'));
                    }
                },
                remove: {
                    name: 'Remove Entity',
                    icon: 'tag_remove',
                    callback: function(key, opt) {
                        w.tagger.removeEntity(opt.$trigger.attr('name'));
                    }
                },
                separator: '',
                copy: {
                    name: 'Copy Entity',
                    icon: 'tag_copy',
                    callback: function(key, opt) {
                        w.tagger.copyTag(opt.$trigger.attr('name'));
                    }
                }
            }
        });
    }

    /**
     * @lends EntitiesList.prototype
     */
    var pm = {};

    pm.update = function() {
        clear();
        
        var entities = getEntities();
        var entitiesString = '';

        var filter = getFilter();
        if (filter !== 'all') {
            entities = entities.filter(function(entry) {
                return entry.getType() === filter;
            });
        }

        switch(getSorting()) {
            case 'categorical':
                var categories = {};
                entities.forEach(function(entry) {
                    var type = entry.getType();
                    if (categories[type] === undefined) {
                        categories[type] = [];
                    }
                    categories[type].push(entry);
                });
                for (var type in categories) {
                    var category = categories[type];
                    for (var i = 0; i < category.length; i++) {
                        var entry = category[i];
                        entitiesString += getEntityView(entry);
                    }
                }
                break;
            case 'alphabetical':
                entities.sort(function(a, b) {
                    var charA = a.getTitle().charAt(0).toLowerCase();
                    var charB = b.getTitle().charAt(0).toLowerCase();
                    if (charA < charB) return -1;
                    if (charA > charB) return 1;
                    return 0;
                });
            default:
                entities.forEach(function(entry) {
                    entitiesString += getEntityView(entry);
                });
                break;
        }
        
        $entities.find('ul.entitiesList').html(entitiesString);
        $entities.find('ul.entitiesList > li').click(function(event) {
            $(this).removeClass('over');
            w.entitiesManager.highlightEntity(this.getAttribute('name'), null, true);
        });
        
        if (w.entitiesManager.getCurrentEntity()) {
            $entities.find('ul.entitiesList  > li[name="'+w.entitiesManager.getCurrentEntity()+'"]').addClass('selected expanded').find('div[class="info"]').show();
        }
    };

    var getEntities = function() {
        var entities = [];
        var entityTags = $('[_entity][class~=start]:not([_nerve])', w.editor.getBody()); // sequential ordering
        entityTags.each(function(index, el) {
            var entry = w.entitiesManager.getEntity($(el).attr('name'));
            if (entry !== undefined) {
                entities.push(entry);
            }
        });
        return entities;
    }

    var getEntityView = function(entity) {
        var infoString = '<ul>';
        var buildString = function(infoObject) {
            var urlAttributes = w.schemaManager.mapper.getUrlAttributes();
            for (var infoKey in infoObject) {
                var info = infoObject[infoKey];
                if (urlAttributes.indexOf(infoKey) !== -1 || info.indexOf('http') === 0) {
                    infoString += '<li><strong>'+infoKey+'</strong>: <a href="'+info+'" target="_blank" rel="noopener">'+info+'</a></li>';
                } else {
                    if ($.isPlainObject(info)) {
                        buildString(info);
                    } else {
                        infoString += '<li><strong>'+infoKey+'</strong>: '+info+'</li>';
                    }
                }
            }
        };
        buildString(entity.getAttributes());
        infoString += '</ul>';
        return ''+
        '<li class="'+entity.getType()+'" name="'+entity.getId()+'">'+
            '<div>'+
                '<div class="header">'+
                    '<span class="icon"/><span class="entityTitle">'+entity.getContent()+'</span>'+
                '</div>'+
                '<div class="info">'+infoString+'</div>'+
            '</div>'+
        '</li>';
    }

    pm.convertEntities = function(typesToFind) {
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
            var li = w.dialogManager.getDialog('loadingindicator');
            li.setText('Converting Entities');
            li.show();

            w.utilities.processArray(potentialEntities, function(el) {
                w.schemaManager.mapper.convertTagToEntity(el);
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
    
    pm.destroy = function() {
        $('#'+id+' ul.entitiesList > li').contextMenu('destroy');

        $entities.find('.convert').button('destroy');
        
        $entities.remove();
    };

    var clear = function() {
        $entities.find('ul').empty();
    };
    
    var remove = function(id) {
        $entities.find('li[name="'+id+'"]').remove();
    };

    
    w.event('loadingDocument').subscribe(function() {
        clear();
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
        $entities.find('ul.entitiesList > li[name="'+entityId+'"]').addClass('selected').addClass('expanded').find('div[class="info"]').show();
    });
    w.event('entityUnfocused').subscribe(function(entityId) {
        $entities.find('ul.entitiesList > li').each(function(index, el) {
            $(this).removeClass('selected').removeClass('expanded').css('background-color', '').find('div[class="info"]').hide();
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
