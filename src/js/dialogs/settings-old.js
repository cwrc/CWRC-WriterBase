'use strict';

const $ = require('jquery');

require('jquery-ui/ui/widgets/button');
    
const settings = (writer, config) => {
    const w = writer;
    
    const settings = {
        fontSize: '11pt',
        showEntities: false,
        showTags: false
    };
    
    $.extend(settings, config);
    
    const defaultSettings = {
        mode: w.mode,
        annotationMode: w.annotationMode,
        allowOverlap: w.allowOverlap
        //,validationSchema: w.schemaManager.schemaId
    };
    $.extend(defaultSettings, settings);
    
    $('<div class="helpLink"><a href="https://cwrc.ca/Documentation/CWRC-Writer" target="_blank">Help</a></div>').prependTo(w.layoutManager.getHeaderButtonsParent());
    const $settingsLink = $('<div class="settingsLink">Settings</div>').prependTo(w.layoutManager.getHeaderButtonsParent());
    
    const fontSizeOptions = {
        min: 8,
        max: 18
    }

    const fontSizeSelectOptions = () => {
        let size = fontSizeOptions.min;
        let htnl = '';
        while (size <= fontSizeOptions.max) {
            htnl += `<option value="${size}pt">${size}pt</option>\n`
            size++;
        }
        return htnl;
    }

    const listSchemasHTML = () => {
        let schemasHTML = '';
        for (const schema of w.schemaManager.schemas) {
            schemasHTML += `<option value="${schema.id}">${schema.name}</option>`;
        }
        return schemasHTML;
    }

    const $settingsDialog = $(`
    <div>
        <div>
            <label>Font Size</label>
            <select name="fontsize">
                ${fontSizeSelectOptions()}




            </select>
        </div>
        <div style="margin-top: 10px;">
            <label>Show Entities <input type="checkbox" name="showEntities" class="showentities" /></label>
        </div>
        <div style="margin-top: 10px;">
            <label>Show Tags <input type="checkbox" name="showTags" class="showtags" /></label>
        </div>
        <div class="settingsDialogAdvanced">
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #aaa;">
                <label>Editor Mode</label>
                <select name="editormode">
                    <option value="xml">XML only (no overlap)</option>
                    <option value="xmlrdf">XML and RDF (no overlap)</option>
                    <option value="xmlrdfoverlap">XML and RDF (overlapping entities)</option>
                    <option value="rdf">RDF only</option>
                </select>
            </div>
            <div style="margin-top: 10px;">
                <label>Annotations Format</label>
                <select name="annotations">
                    <option value="xml">RDF/XML</option>
                    <option value="json">JSON-LD</option>
                </select>
            </div>
            <div style="margin-top: 10px;">
                <label>Schema</label>
                <select name="schema">
                ${listSchemasHTML()}
                </select>
                <br/><br/><button type="button" name="addSchemaButton">Add Schema</button>
            </div>
            <div style="margin-top: 10px;">
                <button type="button" name="resetConfirmButton">Reset Confirmation Dialog Preferences</button>
            </div>
        </div>
    </div>
    `).appendTo(w.dialogManager.getDialogWrapper());

    //// Actions

    //// Actions: Font size
    $('select[name="fontsize"]', $settingsDialog).change(element => {
        const styles = { fontSize: element.currentTarget.value };
        w.editor.dom.setStyles(w.editor.dom.getRoot(), styles);
        settings.fontSize = styles;
    });

    //// Actions: Show Tags
    $('.showtags').click(element => {
        const showTags = $(element.currentTarget).is(':checked');
        if (settings.showTags != showTags) $('body', w.editor.getDoc()).toggleClass('showTags');
        settings.showTags = showTags;
    });

    //// Actions: Show Entities size
    $('.showentities').click(element => {
        const showEntities = $(element.currentTarget).is(':checked');
        if (settings.showEntities != showEntities) $('body', w.editor.getDoc()).toggleClass('showEntities');
        settings.showEntities = showEntities;
    });

    //// Actions: Annotation format
    $('select[name="annotations"]', $settingsDialog).change(element => {
        const annotationMode = element.currentTarget.value;
        settings.annotationMode = annotationMode;
        if (settings.annotationMode === 'xml') {
            w.annotationMode = w.XML;
        } else {
            w.annotationMode = w.JSON;
        }
    });



    $('button[name="addSchemaButton"]', $settingsDialog).button().click(() => {
        w.dialogManager.show('addschema');
    });

    $('button[name="resetConfirmButton"]', $settingsDialog).button().click(() => {
        w.dialogManager.clearDialogPrefs();
        w.dialogManager.show('message', {
            title: 'Settings',
            msg: 'Confirmation dialog preferences have been reset.',
            height: 200
        })
    });
    
    $settingsLink.click(() => {
        $('select[name="fontsize"] > option[value="'+settings.fontSize+'"]', $settingsDialog).prop('selected', true);
        $settingsDialog.find('.showentities').prop('checked', settings.showEntities);
        $settingsDialog.find('.showtags').prop('checked', settings.showTags);
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
    
    $settingsDialog.dialog({
        title: 'Settings',
        modal: true,
        resizable: false,
        dialogClass: 'splitButtons',
        closeOnEscape: true,
        height: 450,
        width: 450,
        position: { my: 'center', at: 'center', of: w.layoutManager.getContainer() },
        autoOpen: false,
        buttons: [{
            text: 'Revert to Defaults',
            role: 'revert',
            'class': 'left',
            click: function() {
                setDefaults();
                applySettings();
            },
        },{
            text: 'Cancel',
            role: 'cancel',
            click: function() {
                $settingsDialog.dialog('close');
            }
        },{
            text: 'Apply',
            role: 'ok',
            click: function() {
                applySettings();
            }
        }]
    });


    const doApplySettings = async editorMode => {
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

        const schemaId = $('select[name="schema"]', $settingsDialog).val();



        if (schemaId !== w.schemaManager.schemaId) {
            
            changeApplyButton(true);

            const rootName = await w.schemaManager.getRootForSchema(schemaId)
                .catch( () => {
                    console.warn('getRootSchema failed');
                    $settingsDialog.dialog('close');
                    w.event('schemaChanged').publish(schemaId);
                });
            
            changeApplyButton(false);
            const currRootName = w.utilities.getRootTag().attr('_tag');

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
                    msg: `<p>The root element (${rootName}) required by the selected schema is different from the root element (${currRootName}) of the current document.</p>
                          <p>Applying this schema change will cause a document loading error.</p>
                          <p>Continue?</p>`,
                    type: 'info',
                    callback: function(doIt) {
                        if (doIt) {
                            $settingsDialog.dialog('close');
                            w.event('schemaChanged').publish(schemaId);
                        } else {
                            $(`select[name="schema"] > option[value="${w.schemaManager.schemaId}"]`, $settingsDialog).prop('selected', true);
                        }
                    }
                });
            } else {
                $settingsDialog.dialog('close');
                w.event('schemaChanged').publish(schemaId);
            }
            
        } else {
            $settingsDialog.dialog('close');
        }


    }
    
    
    const applySettings = () => {
        let editorMode = $('select[name="editormode"]', $settingsDialog).val();
        let doModeChange = false;
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
            let message;
            const existingOverlaps = w.entitiesManager.doEntitiesOverlap();
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
                                w.entitiesManager.removeOverlappingEntities();
                                w.entitiesManager.convertBoundaryEntitiesToTags();
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
        
        
























































































    }
    
    const changeApplyButton = isLoading => {
        const buttons = $settingsDialog.dialog('option', 'buttons')
        if (isLoading) {
            buttons[2].icon = 'ui-icon-clock'
            buttons[2].disabled = true
        } else {
            buttons[2].icon = undefined
            buttons[2].disabled = false
        }
        $settingsDialog.dialog('option', 'buttons', buttons)
    }

    const setDefaults = () => {
        $('select[name="fontsize"]', $settingsDialog).val(defaultSettings.fontSize);
        $settingsDialog.find('.showentities').prop('checked', defaultSettings.showEntities);
        $settingsDialog.find('.showtags').prop('checked', defaultSettings.showTags);
        
        let editorVal;
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
    }
    
    const hideAdvanced = () => {
        $settingsDialog.find('.settingsDialogAdvanced').hide();
        $settingsDialog.dialog('option', 'height', 260);
    }
    
    // TODO don't rebuild the whole schema list when one schema gets added
    // w.event('schemaAdded').subscribe(buildSchema);
    
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
}

// module.exports = Settings;

export {settings as settingsDialog};