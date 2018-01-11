'use strict';

var $ = require('jquery');
var Prism = require('prismjs');
    
/**
 * @class Selection
 * @param {Object} config
 * @param {Writer} config.writer
 * @param {String} config.parentId
 */
function Selection(config) {
    
    var w = config.writer;
    
    var id = w.getUniqueId('selection_');
    
    var lastUpdate = new Date().getTime();
    
    w.utilities.addCSS('css/prism-ghcolors.css');
    $('#'+config.parentId).append(`
    <div class="moduleParent">
        <div id="${id}" class="moduleContent"></div>
    </div>
    `);
    $(document.body).append('<div id="'+id+'selectionContents" style="display: none;"></div>');
    
    w.event('nodeChanged').subscribe(function() {
        updateSelection();
    });
    w.event('tagSelected').subscribe(function(tagId) {
        updateSelection();
    });
    
    /**
     * @lends Selection.prototype
     */
    var selection = {};
    
    function updateSelection(useDoc) {
        var timestamp = new Date().getTime();
        var timeDiff = timestamp - lastUpdate; // track to avoid double update on nodeChanged/tagSelected combo
        if ($('#'+id).is(':visible') && timeDiff > 250) {
            lastUpdate = new Date().getTime();
            
            var contents = '';
            if (w.editor.selection.isCollapsed() && useDoc) {
                contents = w.editor.getBody().firstChild.cloneNode(true);
            } else {
                var range = w.editor.selection.getRng(true);
                contents = range.cloneContents();
            }
            
            $('#'+id+'selectionContents').html(contents);
            var xmlString = w.converter.buildXMLString($('#'+id+'selectionContents'));
            var escapedContents = w.utilities.escapeHTMLString(xmlString);   //$('#selectionContents')[0].innerHTML
            if (escapedContents.length < 100000) {
                if (escapedContents != '\uFEFF') {
                    $('#'+id).html('<pre style="width:100%;height:100%;padding:0;margin:0;"><code class="language-markup">'+escapedContents+'</code></pre>');
                    Prism.highlightElement($('#'+id+' code')[0]);
                } else {
                    $('#'+id).html('<pre><code>Nothing selected.</code></pre>');
                }
            } else {
                $('#'+id).html('<pre><code>The selection is too large to display.</code></pre>');
            }
        }
    }
    
    selection.showSelection = function() {
        w.layout.ui.center.children.layout1.open('south');
        $('#southTabs').tabs('option', 'active', 1);
        updateSelection(true);
    }
    
    // add to writer
    w.selection = selection;
    
    return selection;
};

module.exports = Selection;
