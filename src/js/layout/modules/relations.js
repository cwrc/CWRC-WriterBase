'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/button');
require('jquery-contextmenu');

/**
 * @class Relations
 * @param {Object} config
 * @param {Writer} config.writer
 * @param {String} config.parentId
 */
function Relations(config) {
    
    var w = config.writer;
    
    var id = config.parentId;
    $('#'+config.parentId).append(
        '<div class="moduleParent">'+
            '<ul class="moduleContent relationsList"></ul>'+
            '<div class="moduleFooter">'+
                '<button type="button" role="add">Add Relation</button><button type="button" role="remove">Remove Relation</button>'+
            '</div>'+
        '</div>');
    
    $(document.body).append(''+
        '<div id="'+id+'_contextMenu" class="contextMenu" style="display: none;">'+
            '<ul>'+
                '<li id="removeRelation"><ins style="background:url('+w.cwrcRootUrl+'img/cross.png) center center no-repeat;" />Remove Relation</li>'+
            '</ul>'+
        '</div>'
    );
    
    var $relations = $('#'+id);
    
    $relations.find('.moduleFooter button[role=add]').button().click(function() {
        w.dialogManager.show('triple');
    });
    $relations.find('.moduleFooter button[role=remove]').button().click(function() {
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
        }).contextMenu(id+'_contextMenu', {
            bindings: {
                'removeRelation': function(r) {
                    var i = $(r).data('index');
                    w.triples.splice(i, 1);
                    pm.update();
                }
            },
            shadow: false,
            menuStyle: {
                backgroundColor: '#FFFFFF',
                border: '1px solid #D4D0C8',
                boxShadow: '1px 1px 2px #CCCCCC',
                padding: '0px',
                width: '105px'
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
    };
    
    pm.clear = function() {
        $relations.find('ul').empty();
    };
    
    // add to writer
    w.relations = pm;
    
    return pm;
};

module.exports = Relations;
