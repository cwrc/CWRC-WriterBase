'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/button');
require('jquery-ui/ui/widgets/controlgroup');
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
                        w.tagger.editTag(opt.$trigger.attr('name'));
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
        
        var entitiesString = '';
        var entityTags = $('[_entity][class~=start]', w.editor.getBody());
        if (sort == 'category') {
            var categories = {};
            entityTags.each(function(index, el) {
                var entry = w.entitiesManager.getEntity($(el).attr('name'));
                if (entry !== undefined) {
                    var type = entry.getType();
                    if (categories[type] == null) {
                        categories[type] = [];
                    }
                    categories[type].push(entry);
                }
            });
            for (var type in categories) {
                var category = categories[type];
                for (var i = 0; i < category.length; i++) {
                    var entry = category[i];
                    entitiesString += _buildEntity(entry);
                }
            }
        } else if (sort == 'sequence') {
            entityTags.each(function(index, el) {
                var entry = w.entitiesManager.getEntity($(el).attr('name'));
                if (entry !== undefined) {
                    entitiesString += _buildEntity(entry);
                }
            });
        }

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
                '<span class="box"/><span class="entityTitle">'+entity.getContent()+'</span><div class="info">'+infoString+'</div>'+
            '</li>';
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
        
        if (w.entitiesManager.getCurrentEntity()) {
            $entities.find('ul.entitiesList  > li[name="'+w.entitiesManager.getCurrentEntity()+'"]').addClass('selected').find('div[class="info"]').show();
        }
    };

    pm.clear = function() {
        $entities.find('ul').empty();
    };
    
    pm.remove = function(id) {
        $entities.find('li[name="'+id+'"]').remove();
    };
    
    pm.destroy = function() {
        $seqButton.button('destroy');
        $catButton.button('destroy');
        $entities.find('.sortBy').controlgroup('destroy');
        
        $('#'+id+'_contextMenu').remove();
        
        $entities.remove();
    };
    
    // add to writer
    w.entitiesList = pm;
    
    w.event('entitiesListInitialized').publish(pm);
    
    return pm;
};

module.exports = EntitiesList;
