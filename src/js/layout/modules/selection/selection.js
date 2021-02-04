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
    
    var enabled = true;

    var selectionTrimLength = 500000;
        
    var lastUpdate = new Date().getTime();
    
    var showingFullDoc = false;
    
    // w.utilities.addCSS('css/prism-ghcolors.css');
    $('#'+config.parentId).append(`
    <div class="moduleParent">
        <div id="${id}" class="moduleContent"></div>
        <div id="${id}" class="moduleFooter">
            <label>Include RDF <input type="checkbox" name="includeRdf" /></label>
        </div>
        <div id="${id}_selectionContents" style="display: none;"></div>
    </div>
    `);
    
    var $prismContainer = $('#'+id);
    
    var $selectionContents = $('#'+id+'_selectionContents');
    
    var $includeRdf = $('#'+id+' [name="includeRdf"]').checkboxradio();
    $includeRdf.on('click', function(ev) {
        updateView(true);
    });

    w.event('loadingDocument').subscribe(function() {
        clearView();
    });

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
    w.event('massUpdateStarted').subscribe(function() {
        selection.disable();
    });
    w.event('massUpdateCompleted').subscribe(function() {
        selection.enable(true);
    });
    
    /**
     * @lends Selection.prototype
     */
    var selection = {};
    
    const updateView = async (useDoc) => {
        if (!enabled) return;

        const timestamp = new Date().getTime();
        const timeDiff = timestamp - lastUpdate; // track to avoid double update on nodeChanged/tagSelected combo
        if (!$prismContainer.is(':visible') || timeDiff < 250) return;
        // if ($prismContainer.is(':visible') && timeDiff > 250) {
        
        lastUpdate = new Date().getTime();
        
        if (useDoc || w.editor.selection.isCollapsed()) {
            showingFullDoc = true;
            const includeRdf = $includeRdf.prop('checked');
            // w.converter.getDocumentContent(includeRdf, _showString);
            const content = await w.converter.getDocumentContent(includeRdf);
            _showString(content);
        } else {
            showingFullDoc = false;
            const range = w.editor.selection.getRng(true);
            const contents = range.cloneContents();
            $selectionContents.html(contents);
            const xmlString = w.converter.buildXMLString($selectionContents);
            _showString(xmlString);
        }
    };

    var _showString = function(xmlString) {
        var escapedContents = w.utilities.escapeHTMLString(xmlString);
        if (escapedContents.length > selectionTrimLength) {
            escapedContents = escapedContents.substring(0, selectionTrimLength);// + '&hellip;';
        }
        $prismContainer.html(
            '<pre style="width:100%;height:100%;padding:0;margin:0;border:none !important;"><code class="language-markup" style="white-space: pre-wrap;">'
                +escapedContents+
            '</code></pre>'
        );
        Prism.highlightElement($('code', $prismContainer)[0]);
    }

    var clearView = function() {
        $prismContainer.html('');
    }

    selection.enable = function(forceUpdate) {
        enabled = true;
        if (forceUpdate) {
            updateView(true);
        }
    }
    selection.disable = function() {
        enabled = false;
    }
    
    selection.showSelection = function() {
        w.layoutManager.showModule('selection');
        updateView(true);
    };

    selection.destroy = function() {
        // TODO
    }
    
    // add to writer
    w.selection = selection; // needed by view markup button
    
    return selection;
};

module.exports = Selection;
