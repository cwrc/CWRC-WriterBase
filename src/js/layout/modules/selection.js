'use strict';

var $ = require('jquery');
var Prism = require('prismjs');
require('jquery-ui/ui/widgets/checkboxradio');

/**
 * @class Selection
 * @param {Object} config
 * @param {Writer} config.writer
 * @param {String} config.parentId
 */
function Selection(config) {
    
    var w = config.writer;
    
    var id = w.getUniqueId('selection_');
    
    var selectionTrimLength = 100000;
    
    var showFullDoc = true;
    
    var lastUpdate = new Date().getTime();
    
    w.utilities.addCSS('css/prism-ghcolors.css');
    $('#'+config.parentId).append(`
    <div class="moduleParent">
        <div id="${id}" class="moduleContent"></div>
        <div id="${id}_options" class="moduleFooter">
            <span>Show </span>
            <label>Document<input type="radio" name="show" value="document" checked="true"></label>
            <label>Selection<input type="radio" name="show" value="selection"></label>
        </div>
        <div id="${id}_selectionContents" style="display: none;"></div>
    </div>
    `);
    
    var $inputs = $('#'+id+'_options input').checkboxradio();
    $inputs.click(function() {
        if (this.value == 'document') {
            showFullDoc = true;
        } else {
            showFullDoc = false;
        }
        updateSelection();
    });
    
    var $prismContainer = $('#'+id);
    
    var $selectionContents = $('#'+id+'_selectionContents');
        
    w.event('nodeChanged').subscribe(function() {
        if (!showFullDoc || (showFullDoc && $prismContainer.text() == '')) {
            updateSelection();
        }
    });
    w.event('tagSelected').subscribe(function(tagId) {
        if (!showFullDoc || (showFullDoc && $prismContainer.text() == '')) {
            updateSelection();
        }
    });
    
    /**
     * @lends Selection.prototype
     */
    var selection = {};
    
    function updateSelection(useDoc) {
        var timestamp = new Date().getTime();
        var timeDiff = timestamp - lastUpdate; // track to avoid double update on nodeChanged/tagSelected combo
        if ($prismContainer.is(':visible') && timeDiff > 250) {
            lastUpdate = new Date().getTime();
            
            var contents = '';
            if (showFullDoc || (w.editor.selection.isCollapsed() && useDoc)) {
                contents = w.editor.getBody().firstChild.cloneNode(true);
            } else {
                var range = w.editor.selection.getRng(true);
                contents = range.cloneContents();
            }
            
            $selectionContents.html(contents);
            var xmlString = w.converter.buildXMLString($selectionContents);
            var escapedContents = w.utilities.escapeHTMLString(xmlString);
            if (escapedContents.length > selectionTrimLength) {
                escapedContents = escapedContents.substring(0, selectionTrimLength);// + '&hellip;';
            }
            $prismContainer.html('<pre style="width:100%;height:100%;padding:0;margin:0;border:none !important;"><code class="language-markup" style="white-space: pre-wrap;">'+escapedContents+'</code></pre>');
            Prism.highlightElement($('code', $prismContainer)[0]);
        }
    }
    
    selection.showSelection = function() {
        w.layoutManager.showModule('selection');
        updateSelection(true);
    };
    
    // add to writer
    w.selection = selection;
    
    return selection;
};

module.exports = Selection;
