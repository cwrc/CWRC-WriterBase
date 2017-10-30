//define(['jquery', 'jquery-ui', 'jquery.contextmenu'], function($, jqueryUi, jqueryContextMenu) {
'use strict';
//window.jQuery = window.$ = require('jquery');
//var $ = require('jquery');

require('jquery-ui/ui/widgets/button');
require('jquery-ui/ui/widgets/checkboxradio');
require('jquery-ui/ui/widgets/controlgroup');
//require('jquery-contextmenu');
    
/**
 * @class EntitiesList
 * @fires Writer#entitiesListInitialized
 * @param {Object} config
 * @param {Writer} config.writer
 * @param {String} config.parentId
 */
function EntitiesList(config) {
    
    var w = config.writer;
    
    var metaKeys = ['_id', '_ref'];
    var showMetaKeys = false;
    
    var id = config.parentId;
    $('#'+id).append(
        '<div class="moduleParent">'+
            '<ul class="moduleContent entitiesList"></ul>'+
            '<div class="moduleFooter entitiesOptions">'+
                '<div class="sortBy"><span>Sort By</span> '+
                    '<label>Sequence <input type="radio" class="sequence" name="sortBy" checked="checked" /></label>'+
                    '<label>Category <input type="radio" class="category" name="sortBy" /></label>'+
                '</div>'+
                '<!--<div><input type="checkbox" id="metaKeys" /><label for="metaKeys">Show Metadata</label></div>-->'+
            '</div>'+
        '</div>');
    
    // TODO remove context menu IDs
    // TODO context menu not appearing
    // TODO background icons have no dimensions
    $(document.body).append(''+
        '<div id="'+id+'_contextMenu" class="contextMenu" style="display: none;">'+
            '<ul>'+
                '<li id="editEntity"><ins style="background:url('+w.cwrcRootUrl+'img/tag_blue_edit.png) center center no-repeat;" />Edit Entity</li>'+
                '<li id="removeEntity"><ins style="background:url('+w.cwrcRootUrl+'img/cross.png) center center no-repeat;" />Remove Entity</li>'+
                '<li class="separator" id="copyEntity"><ins style="background:url('+w.cwrcRootUrl+'img/tag_blue_copy.png) center center no-repeat;" />Copy Entity</li>'+
            '</ul>'+
        '</div>'
    );
    
    var $entities = $('#'+id);
    
    var $seqButton = $entities.find('.sequence');
    $seqButton.button().click(function() {
        w.entitiesList.update('sequence');
        w.entitiesManager.highlightEntity(w.entitiesManager.getCurrentEntity());
    });
    var $catButton = $entities.find('.category')
    $catButton.button().click(function() {
        w.entitiesList.update('category');
        w.entitiesManager.highlightEntity(w.entitiesManager.getCurrentEntity());
    });
    $entities.find('.sortBy').controlgroup();
//    $('#metaKeys').button().click(function() {
//        showMetaKeys = !showMetaKeys;
//        w.entitiesList.update();
//        w.entitiesManager.highlightEntity(w.entitiesManager.getCurrentEntity());
//    });
    
    /**
     * @lends EntitiesList.prototype
     */
    var pm = {};
    
    w.event('loadingDocument').subscribe(function() {
        pm.clear();
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
        pm.remove(entityId);
    });
    w.event('entityFocused').subscribe(function(entityId) {
        $entities.find('ul.entitiesList > li[name="'+entityId+'"]').addClass('selected').find('div[class="info"]').show();
    });
    w.event('entityUnfocused').subscribe(function(entityId) {
        $entities.find('ul.entitiesList > li').each(function(index, el) {
            $(this).removeClass('selected').css('background-color', '').find('div[class="info"]').hide();
        });
    });
    w.event('entityPasted').subscribe(function(entityId) {
        pm.update();
    });
    
    /**
     * @param sort
     */
    pm.update = function(sort) {
        pm.clear();
        
        if (sort == null) {
            if ($seqButton.prop('checked')) {
                sort = 'sequence';
            } else {
                sort = 'category';
            }
        }
        
        var id, entry, i;
        var entitiesString = '';
        
        var entityTags = $('[_entity][class~=start]', w.editor.getBody());
        if (sort == 'category') {
            var categories = {};
            entityTags.each(function(index, el) {
                id = $(el).attr('name');
                if (w.entitiesManager.getEntity(id) === undefined) {
                    var deleted = w.deletedEntities[id];
                    if (deleted != null) {
                        w.entitiesManager.setEntity(id, deleted);
                        entry = deleted;
                        delete w.deletedEntities[id];
                    } else {
                        w.tagger.removeEntity(id);
                        return;
                    }
                } else {
                    entry = w.entitiesManager.getEntity(id);
                }
                if (categories[entry.getType()] == null) {
                    categories[entry.getType()] = [];
                }
                categories[entry.getType()].push(entry);
            });
            var category;
            for (id in categories) {
                category = categories[id];
                for (i = 0; i < category.length; i++) {
                    entry = category[i];
                    entitiesString += _buildEntity(entry);
                }
            }
        } else if (sort == 'sequence') {
            entityTags.each(function(index, el) {
                id = $(this).attr('name');
                if (w.entitiesManager.getEntity(id) === undefined) {
                    var deleted = w.deletedEntities[id];
                    if (deleted != null) {
                        w.entitiesManager.setEntity(id, deleted);
                        entry = deleted;
                        delete w.deletedEntities[id];
                    } else {
                        w.tagger.removeEntity(id);
                        return;
                    }
                } else {
                    entry = w.entitiesManager.getEntity(id);
                }
                if (entry) {
                    entitiesString += _buildEntity(entry);
                }
            });
        }
        
        $entities.find('ul.entitiesList').html(entitiesString);
        $entities.find('ul.entitiesList > li').hover(function() {
            if (!$(this).hasClass('selected')) {
                $(this).addClass('over');
            }
        }, function() {
            if (!$(this).hasClass('selected')) {
                $(this).removeClass('over');
            }
        }).mousedown(function(event) {
            $(this).removeClass('over');
            w.entitiesManager.highlightEntity(this.getAttribute('name'), null, true);
        });
        
        if (w.isReadOnly !== true) {
            $entities.find('ul.entitiesList > li').contextMenu(id+'_contextMenu', {
                bindings: {
                    'editEntity': function(tag) {
                        w.tagger.editTag($(tag).attr('name'));
                    },
                    'removeEntity': function(tag) {
                        w.tagger.removeEntity($(tag).attr('name'));
                    },
                    'copyEntity': function(tag) {
                        w.tagger.copyTag($(tag).attr('name'));
                    }
                },
                shadow: false,
                menuStyle: {
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #D4D0C8',
                    boxShadow: '1px 1px 2px #CCCCCC',
                    padding: '0px'
                },
                itemStyle: {
                    fontFamily: 'Tahoma,Verdana,Arial,Helvetica',
                    fontSize: '11px',
                    color: '#000',
                    lineHeight: '20px',
                    padding: '0px',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    border: 'none'
                },
                itemHoverStyle: {
                    color: '#000',
                    backgroundColor: '#DBECF3',
                    border: 'none'
                }
            });
        }
        
        if (w.entitiesManager.getCurrentEntity()) {
            $entities.find('ul.entitiesList  > li[name="'+w.entitiesManager.getCurrentEntity()+'"]').addClass('selected').find('div[class="info"]').show();
        }
    };
    
    pm.clear = function() {
        $entities.find('ul').empty();
    };
    
    function _buildEntity(entity) {
        var infoString = '<ul>';
        var buildString = function(infoObject) {
            var urlAttributes = w.schemaManager.mapper.getUrlAttributes();
            for (var infoKey in infoObject) {
                if (showMetaKeys || metaKeys.indexOf(infoKey) == -1) {
                    var info = infoObject[infoKey];
                    if (urlAttributes.indexOf(infoKey) !== -1) {
                        infoString += '<li><strong>'+infoKey+'</strong>: <a href="'+info+'" target="_blank">'+info+'</a></li>';
                    } else {
                        if ($.isPlainObject(info)) {
                            buildString(info);
                        } else {
                            infoString += '<li><strong>'+infoKey+'</strong>: '+info+'</li>';
                        }
                    }
                }
            }
        };
        buildString(entity.getAttributes());
        infoString += '</ul>';
        return '<li class="'+entity.getType()+'" name="'+entity.getId()+'">'+
            '<span class="box"/><span class="entityTitle">'+entity.getTitle()+'</span><div class="info">'+infoString+'</div>'+
        '</li>';
    };
    
    pm.remove = function(id) {
        $entities.find('li[name="'+id+'"]').remove();
    };
    
    // add to writer
    w.entitiesList = pm;
    
    w.event('entitiesListInitialized').publish(pm);
    
    return pm;
};

module.exports = EntitiesList;
