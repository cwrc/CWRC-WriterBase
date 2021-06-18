'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/button');

/**
 * @class Relations
 * @param {Object} config
 * @param {Writer} config.writer
 * @param {String} config.parentId
 */
function Relations(config) {
    
    var w = config.writer;
    
    var id = config.parentId;
    $('#'+id).append(
        '<div class="moduleParent">'+
            '<ul class="moduleContent relationsList"></ul>'+
            '<div class="moduleFooter">'+
                '<button type="button" role="add">Add Relation</button><button type="button" role="remove">Remove Relation</button>'+
            '</div>'+
        '</div>');
    
    var $relations = $('#'+id);
    
    var $addButton = $relations.find('.moduleFooter button[role=add]').button();
    $addButton.click(function() {
        w.dialogManager.show('triple');
    });
    var $removeButton = $relations.find('.moduleFooter button[role=remove]').button();
    $removeButton.click(function() {
        var selected = $relations.find('ul li.selected');
        if (selected.length == 1) {
            var i = selected.data('index');
            w.triples.splice(i, 1);
            pm.update();
        } else {
            w.dialogManager.show('message', {
                title: 'No Relation Selected',
                msg: 'You must first select a relation to remove.',
                type: 'error'
            });
        }
    });

    $.contextMenu({
        selector: '#'+id+' ul li',
        zIndex: 10,
        appendTo: '#'+w.containerId,
        className: 'cwrc',
        items: {
            remove: {
                name: 'Remove Relation',
                icon: 'tag_remove',
                callback: function(key, opt) {
                    var i = opt.$trigger.data('index');
                    w.triples.splice(i, 1);
                    pm.update();
                }
            }
        }
    });
    
    w.event('loadingDocument').subscribe(function() {
        pm.clear();
    });
    w.event('documentLoaded').subscribe(function() {
        pm.update();
    });
    w.event('schemaLoaded').subscribe(function() {
        pm.update();
    });
    
    /**
     * @lends Relations.prototype
     */
    var pm = {
        currentlySelectedNode: null
    };
    
    /**
     * Update the list of relations.
     */
    pm.update = function() {
        pm.clear();
        
        var relationsString = '';
        
        for (var i = 0; i < w.triples.length; i++) {
            var triple = w.triples[i];
            relationsString += '<li>'+triple.subject.text+' '+triple.predicate.text+' '+triple.object.text+'</li>';
        }
        
        $relations.find('ul').html(relationsString);
        
        $relations.find('ul li').each(function(index, el) {
            $(this).data('index', index);
        }).click(function() {
            $(this).addClass('selected').siblings().removeClass('selected');
        });
    };
    
    pm.clear = function() {
        $relations.find('ul').empty();
    };
    
    pm.destroy = function() {
        $addButton.button('destroy');
        $removeButton.button('destroy');
        $('#'+id+'_contextMenu').remove();
    };
    
    // add to writer
    w.relations = pm;
    
    return pm;
};

module.exports = Relations;
