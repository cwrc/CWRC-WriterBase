'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/button');
    
function Settings(writer, config) {
    var w = writer;
    
    var settings = {
        fontSize: '11pt',
        fontFamily: 'Book Antiqua',
        showEntityBrackets: false,
        showStructBrackets: false
    };
    
    $.extend(settings, config);
    
    var defaultSettings = {
        mode: w.mode,
        annotationMode: w.annotationMode,
        allowOverlap: w.allowOverlap
        //,validationSchema: w.schemaManager.schemaId
    };
    $.extend(defaultSettings, settings);
    
    var $helpLink = $('<div class="helpLink">Help</div>').prependTo(w.layoutManager.getHeaderButtonsParent());
    var $settingsLink = $('<div>Settings</div>').prependTo(w.layoutManager.getHeaderButtonsParent());
    
    var $settingsDialog = $(''+
    '<div>'+
        '<div>'+
            '<label>Font Size</label>'+
            '<select name="fontsize">'+
                '<option value="9pt">9pt</option>'+
                '<option value="10pt">10pt</option>'+
                '<option value="11pt">11pt</option>'+
                '<option value="12pt">12pt</option>'+
                '<option value="13pt">13pt</option>'+
            '</select>'+
        '</div>'+
        '<div style="margin-top: 10px;">'+
            '<label>Font Type</label>'+
            '<select name="fonttype">'+
                '<option value="Arial" style="font-family: Arial; font-size: 14px;">Arial</option>'+
                '<option value="Book Antiqua" style="font-family: Book Antiqua; font-size: 14px;">Book Antiqua</option>'+
                '<option value="Georgia" style="font-family: Georgia; font-size: 14px;">Georgia</option>'+
                '<option value="Helvetica" style="font-family: Helvetica; font-size: 14px;">Helvetica</option>'+
                '<option value="Palatino" style="font-family: Palatino; font-size: 14px;">Palatino</option>'+
                '<option value="Tahoma" style="font-family: Tahoma; font-size: 14px;">Tahoma</option>'+
                '<option value="Times New Roman" style="font-family: Times New Roman; font-size: 14px;">Times New Roman</option>'+
                '<option value="Verdana" style="font-family: Verdana; font-size: 14px;">Verdana</option>'+
                '<option value="Lato" style="font-family: Lato; font-size: 14px;">Lato</option>'+
            '</select>'+
        '</div>'+
        '<div style="margin-top: 10px;">'+
            '<label>Show Entity Brackets <input type="checkbox" class="showentitybrackets" /></label>'+
        '</div>'+
        '<div style="margin-top: 10px;">'+
            '<label>Show Tags <input type="checkbox" class="showstructbrackets" /></label>'+
        '</div>'+
        '<div class="settingsDialogAdvanced">'+
            '<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #aaa;">'+
                '<label>Editor Mode</label>'+
                '<select name="editormode">'+
                    '<option value="xml">XML only (no overlap)</option>'+
                    '<option value="xmlrdf">XML and RDF (no overlap)</option>'+
                    '<option value="xmlrdfoverlap">XML and RDF (overlapping entities)</option>'+
                    '<option value="rdf">RDF only</option>'+
                '</select>'+
            '</div>'+
            '<div style="margin-top: 10px;">'+
                '<label>Annotations Format</label>'+
                '<select name="annotations">'+
                    '<option value="xml">RDF/XML</option>'+
                    '<option value="json">JSON-LD</option>'+
                '</select>'+
            '</div>'+
            '<div style="margin-top: 10px;">'+
                '<label>Schema</label>'+
                '<select name="schema">'+
                '</select>'+
                '<br/><br/><button type="button">Add Schema</button>'+
            '</div>'+
        '</div>'+
    '</div>').appendTo(w.dialogManager.getDialogWrapper());
    
    buildSchema();
    $('select[name="schema"]', $settingsDialog).nextAll('button').button().click(function() {
        w.dialogManager.show('addschema');
    });
    
    $settingsLink.click(function() {
        $('select[name="fontsize"] > option[value="'+settings.fontSize+'"]', $settingsDialog).prop('selected', true);
        $('select[name="fonttype"] > option[value="'+settings.fontFamily+'"]', $settingsDialog).prop('selected', true);
        $settingsDialog.find('.showentitybrackets').prop('checked', settings.showEntityBrackets);
        $settingsDialog.find('.showstructbrackets').prop('checked', settings.showStructBrackets);
        if (w.mode === w.XML) {
            $('select[name="editormode"] > option[value="xml"]', $settingsDialog).prop('selected', true);
        } else if (w.mode === w.XMLRDF){
            if (w.allowOverlap) {
                $('select[name="editormode"] > option[value="xmlrdfoverlap"]', $settingsDialog).prop('selected', true);
            } else {
                $('select[name="editormode"] > option[value="xmlrdf"]', $settingsDialog).prop('selected', true);
            }
        } else if (w.mode === w.RDF) {
            $('select[name="editormode"] > option[value="rdf"]', $settingsDialog).prop('selected', true);
        }
        if (w.annotationMode === w.XML) {
            $('select[name="annotations"] > option[value="xml"]', $settingsDialog).prop('selected', true);
        } else {
            $('select[name="annotations"] > option[value="json"]', $settingsDialog).prop('selected', true);
        }
        $('select[name="schema"] > option[value="'+w.schemaManager.schemaId+'"]', $settingsDialog).prop('selected', true);
        $settingsDialog.dialog('open');
    });
    
    $helpLink.click(function() {
        w.dialogManager.show('message', {
            title: 'CWRC-Writer Help',
            msg: '<p>For help with CWRC-Writer click <a href="https://cwrc.ca/CWRC-Writer_Documentation/" target="_blank">here</a>.</p>',
            modal: false
        });
    });
    
    $settingsDialog.dialog({
        title: 'Settings',
        modal: true,
        resizable: false,
        dialogClass: 'splitButtons',
        closeOnEscape: true,
        height: 450,
        width: 450,
        position: { my: "center", at: "center", of: w.layoutManager.getContainer() },
        autoOpen: false,
        buttons: [{
            text: 'Revert to Defaults',
            'class': 'left',
            click: function() {
                setDefaults();
                applySettings();
            },
        },{
            text: 'Cancel',
            click: function() {
                $settingsDialog.dialog('close');
            }
        },{
            text: 'Apply',
            click: function() {
                applySettings();
            }
        }]
    });
    
    function buildSchema() {
        var schemasHTML = '';
        for (var schema in w.schemaManager.schemas) {
            schemasHTML += '<option value="' + schema + '">' + w.schemaManager.schemas[schema]['name'] + '</option>';
        }
        $('select[name="schema"]', $settingsDialog).html(schemasHTML);
    }
    
    function applySettings() {
        var editorMode = $('select[name="editormode"]', $settingsDialog).val();
        var doModeChange = false;
        if (editorMode === 'xml') {
            if (w.mode !== w.XML) {
                doModeChange = true;
            }
        } else if (editorMode === 'xmlrdf') {
            if (w.mode !== w.XMLRDF || w.allowOverlap === true) {
                doModeChange = true;
            }
        } else if (editorMode === 'xmlrdfoverlap') {
            if (w.mode !== w.XMLRDF || w.allowOverlap === false) {
                doModeChange = true;
            }
        } else if (editorMode === 'rdf') {
            if (w.mode !== w.RDF || w.allowOverlap === false) {
                doModeChange = true;
            }
        }
        
        if (doModeChange) {
            var message;
            var existingOverlaps = w.utilities.doEntitiesOverlap();
            // switching to xml mode from an xmlrdf mode
            if (editorMode === 'xml') {
                message = 'If you select the XML only mode, no RDF will be created when tagging entities.<br/>Furthermore, the existing RDF annotations will be discarded.<br/><br/>Do you wish to continue?';
            }
            // switching from xml mode to no-overlap
            if (editorMode === 'xmlrdf' && w.mode === w.XML) {
                message = 'XML tags and RDF/Semantic Web annotations equivalent to the XML tags will be created, consistent with the hierarchy of the XML schema, so annotations will not be allowed to overlap.<br/><br/>Do you wish to continue?';
            }
            // switching from no-overlap to overlap
            if (w.allowOverlap === false && editorMode === 'xmlrdfoverlap') {
                message = 'The editor mode will be switched to XML and RDF (Overlapping Entities) and only RDF will be created for entities that overlap existing XML structures.<br/><br/>Do you wish to continue?';
            }
            // switching from overlap to no-overlap
            if (w.allowOverlap && editorMode !== 'xmlrdfoverlap') {
                if (existingOverlaps) {
                    message = 'You have overlapping entities and are attemping to switch to a mode which prohibits them.<br/>The overlapping entities will be discarded if you continue.<br/><br/>Do you wish to continue?';
                }
            }
            // TODO rdf message
            
            if (message !== undefined) {
                w.dialogManager.confirm({
                    title: 'Warning',
                    msg: message,
                    callback: function(confirmed) {
                        if (confirmed) {
                            if (editorMode !== 'xmlrdfoverlap') {
                                w.utilities.removeOverlappingEntities();
                                w.utilities.convertBoundaryEntitiesToTags();
                            }
                            doApplySettings(editorMode);
                        }
                    }
                });
            } else {
                doApplySettings(editorMode);
            }
        } else {
            doApplySettings();
        }
        
        function doApplySettings(editorMode) {
            if (editorMode !== undefined) {
                if (editorMode === 'xml') {
                    w.mode = w.XML;
                    w.allowOverlap = false;
                } else if (editorMode === 'xmlrdf') {
                    w.mode = w.XMLRDF;
                    w.allowOverlap = false;
                } else if (editorMode === 'xmlrdfoverlap') {
                    w.mode = w.XMLRDF;
                    w.allowOverlap = true;
                } else if (editorMode === 'rdf') {
                    w.mode = w.RDF;
                    w.allowOverlap = true;
                }
            }
            
            settings.annotationMode = $('select[name="annotations"]', $settingsDialog).val();
            if (settings.annotationMode === 'xml') {
                w.annotationMode = w.XML;
            } else {
                w.annotationMode = w.JSON;
            }
            
            settings.fontSize = $('select[name="fontsize"]', $settingsDialog).val();
            settings.fontFamily = $('select[name="fonttype"]', $settingsDialog).val();
            
            if (settings.showEntityBrackets != $settingsDialog.find('.showentitybrackets').prop('checked')) {
                $('body', w.editor.getDoc()).toggleClass('showEntityBrackets');
            }
            settings.showEntityBrackets = $settingsDialog.find('.showentitybrackets').prop('checked');
            
            if (settings.showStructBrackets != $settingsDialog.find('.showstructbrackets').prop('checked')) {
                $('body', w.editor.getDoc()).toggleClass('showStructBrackets');
            }
            settings.showStructBrackets = $settingsDialog.find('.showstructbrackets').prop('checked');
            
            var styles = {
                fontSize: settings.fontSize,
                fontFamily: settings.fontFamily
            };
            w.editor.dom.setStyles(w.editor.dom.getRoot(), styles);

            var schemaId = $('select[name="schema"]', $settingsDialog).val();
            if (schemaId !== w.schemaManager.schemaId) {
                changeApplyButton(true);
                w.schemaManager.getRootForSchema(schemaId).then(function(rootName) {
                    changeApplyButton(false);
                    var currRootName = w.utilities.getRootTag().attr('_tag');
                    if (rootName === null) {
                        w.dialogManager.show('message', {
                            title: 'Error',
                            msg: 'The root element of the schema could not be determined and so it will not be used.',
                            type: 'error'
                        });
                        $settingsDialog.dialog('close');
                    } else if (currRootName !== rootName) {
                        w.dialogManager.confirm({
                            title: 'Warning',
                            msg: '<p>The root element ('+rootName+') required by the selected schema is different from the root element ('+currRootName+') of the current document.</p>'+
                                '<p>Applying this schema change will cause a document loading error.</p><p>Continue?</p>',
                            type: 'info',
                            callback: function(doIt) {
                                if (doIt) {
                                    $settingsDialog.dialog('close');
                                    w.event('schemaChanged').publish(schemaId);
                                } else {
                                    $('select[name="schema"] > option[value="'+w.schemaManager.schemaId+'"]', $settingsDialog).prop('selected', true);
                                }
                            }
                        });
                    } else {
                        $settingsDialog.dialog('close');
                        w.event('schemaChanged').publish(schemaId);
                    }
                }, function() {
                    console.warn('getRootSchema failed');
                    $settingsDialog.dialog('close');
                    w.event('schemaChanged').publish(schemaId);
                });
            } else {
                $settingsDialog.dialog('close');
            }
        }
    };
    
    function changeApplyButton(isLoading) {
        var buttons = $settingsDialog.dialog('option', 'buttons')
        if (isLoading) {
            buttons[2].icon = 'ui-icon-clock'
            buttons[2].disabled = true
        } else {
            buttons[2].icon = undefined
            buttons[2].disabled = false
        }
        $settingsDialog.dialog('option', 'buttons', buttons)
    }

    function setDefaults() {
        $('select[name="fontsize"]', $settingsDialog).val(defaultSettings.fontSize);
        $('select[name="fonttype"]', $settingsDialog).val(defaultSettings.fontFamily);
        $settingsDialog.find('.showentitybrackets').prop('checked', defaultSettings.showEntityBrackets);
        $settingsDialog.find('.showstructbrackets').prop('checked', defaultSettings.showStructBrackets);
        
        var editorVal;
        switch(defaultSettings.mode) {
        case w.XMLRDF:
            editorVal = 'xmlrdf';
            if (defaultSettings.allowOverlap) {
                editorVal = 'xmlrdfoverlap';
            }
            break;
        case w.XML:
            editorVal = 'xml';
            break;
        case w.RDF:
            editorVal = 'rdf';
            break;
        }
        $('select[name="editormode"]', $settingsDialog).val(editorVal);
        $('select[name="annotations"]', $settingsDialog).val(defaultSettings.annotationMode);
        
        //$('select[name="schema"]', $settingsDialog).val(defaultSettings.validationSchema);
    };
    
    function hideAdvanced() {
        $settingsDialog.find('.settingsDialogAdvanced').hide();
        $settingsDialog.dialog('option', 'height', 260);
    }
    
    w.event('schemaAdded').subscribe(buildSchema);
    
    if (w.isReadOnly) {
        hideAdvanced();
    }
    
    return {
        getSettings: function() {
            return settings;
        },
        hideAdvanced: hideAdvanced,
        destroy: function() {
            $settingsDialog.dialog('destroy');
        }
    };
};

module.exports = Settings;