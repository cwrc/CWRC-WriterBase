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
        
    var lastUpdate = new Date().getTime();
    
    var showingFullDoc = false;
    
    w.utilities.addCSS('css/prism-ghcolors.css');
    $('#'+config.parentId).append(`
    <div class="moduleParent">
        <div id="${id}" class="moduleContent"></div>
        <div id="${id}_selectionContents" style="display: none;"></div>
    </div>
    `);
    
    var $prismContainer = $('#'+id);
    
    var $selectionContents = $('#'+id+'_selectionContents');
    
    w.event('selectionChanged').subscribe(function() {
        if (!w.editor.selection.isCollapsed()) {
            updateView();
        } else if (!showingFullDoc) {
            updateView(true);
        }
    });
    w.event('contentChanged').subscribe(function() {
        updateView(true);
    });
    w.event('nodeChanged').subscribe(function() {
        if (!showingFullDoc) {
            updateView();
        }
    });
    w.event('tagSelected').subscribe(function() {
        updateView();
    });
    w.event('tagAdded').subscribe(function() {
        updateView(true);
    });
    w.event('tagEdited').subscribe(function() {
        updateView(true);
    });
    w.event('tagRemoved').subscribe(function() {
        updateView(true);
    });
    
    /**
     * @lends Selection.prototype
     */
    var selection = {};
    
    function updateView(useDoc) {
        var timestamp = new Date().getTime();
        var timeDiff = timestamp - lastUpdate; // track to avoid double update on nodeChanged/tagSelected combo
        if ($prismContainer.is(':visible') && timeDiff > 250) {
            lastUpdate = new Date().getTime();
            
            var contents = '';
            if (useDoc || w.editor.selection.isCollapsed()) {
                contents = w.editor.getBody().firstChild.cloneNode(true);
                showingFullDoc = true;
            } else {
                var range = w.editor.selection.getRng(true);
                contents = range.cloneContents();
                showingFullDoc = false;
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
        updateView(true);
    };
    
    // add to writer
    w.selection = selection; // needed by view markup button
    
    return selection;
};

module.exports = Selection;
