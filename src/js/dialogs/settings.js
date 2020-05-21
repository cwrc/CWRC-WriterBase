import React, {Component} from 'react'
import ReactDOM, { createPortal } from 'react-dom';
import Button from '@material-ui/core/Button';
import Divider from '@material-ui/core/Divider';

import HeaderMenuOptions from './settingComponents/HeaderMenuOptions';
import SettingGroup from './settingComponents/SettingGroup';


import $ from 'jquery';
    
const settings = (writer, config) => {

    const w = writer;
    let setingsComponents;

    //SETUP JQUERY DIALOG
    const $settingsDialog = $('<div id="settingsDialogContainer"></div>').appendTo(w.dialogManager.getDialogWrapper());

    $settingsDialog.dialog({
        title: 'Settings',
        modal: true,
        resizable: false,
        closeOnEscape: true,
        width: 450,
        position: { my: 'center', at: 'center', of: w.layoutManager.getContainer() },
        autoOpen: false,
        open: (event, ui) => {
            $('.ui-dialog-titlebar-close', ui.dialog).show();
            updateSchema();
        },
        close: () => {
            $settingsDialog.dialog('close');
        }
    });


     //add HEADER OPTIONS
     ReactDOM.render(
        <HeaderMenuOptions 
            dialog={$settingsDialog}
        />,
        w.layoutManager.getHeaderButtonsParent()[0]
    );

    // $('<div class="helpLink"><a href="https://cwrc.ca/Documentation/CWRC-Writer" target="_blank">Help</a></div>').prependTo(w.layoutManager.getHeaderButtonsParent());
    // const $settingsLink = $('<div class="settingsLink">Settings</div>').prependTo(w.layoutManager.getHeaderButtonsParent());
    // $settingsLink.click(() => {
    //     $settingsDialog.dialog('open');
    // });


    //EXTERNAL FUNCION TO SELECT SCHEMA IN SETTINGG DIALOG
    const updateSchema = () => {
        setingsComponents.setState(() => ({ schemaId: w.schemaManager.schemaId }));
    }

    // SEETING DIALOG
    class SettingsDialog extends Component {

        state = {
            isAdvanced: true,
            fontSize: '11pt',
            showEntities: true,
            showTags: false,
            mode: 'xmlrdfoverlap',
            annotationMode: w.JSON,
            allowOverlap: false,
            schemaId: ''
        }

        fontSizeOptions = [
            {value: '8pt', label: '8pt'},
            {value: '9pt', label: '9pt'},
            {value: '10pt', label: '10pt'},
            {value: '11pt', label: '11pt'},
            {value: '12pt', label: '12pt'},
            {value: '13pt', label: '13pt'},
            {value: '14pt', label: '14pt'},
            {value: '15pt', label: '15pt'},
            {value: '16pt', label: '16pt'},
            {value: '18pt', label: '18pt'}
        ]

        editorModes = [
            { key: w.XML, value: 'xml', label: 'XML only (no overlap)'},
            { key: w.XMLRDF, value: 'xmlrdf', label: 'XML and RDF (no overlap)'},
            { key: w.XMLRDF, value: 'xmlrdfoverlap', label: 'XML and RDF (overlapping entities)'},
            { key: w.RDF, value: 'rdf', label: 'RDF only'}
        ]

        annotationModes = [
            { value: w.XML, label: 'RDF/XML'},
            { value: w.JSON, label: 'JSON-LD'}
        ]

        componentDidMount = () => {
            if (w.isReadOnly) this.toggleAdvanced(false);

            const editorMode = this.getEditorMode(w.mode);
            
            this.setState(() => ({
                showEntities: config.showEntities,
                showTags: config.showTags,
                mode: editorMode.value,
                annotationMode: w.annotationMode,
                allowOverlap: w.allowOverlap
            }));
        }

        toggleAdvanced = value => {
            this.setState(() => ({ isAdvanced: value }));
        }

        changeFontSize = size => {
            this.setState(() => ({ fontSize: size }));
            const styles = { fontSize: size };
            w.editor.dom.setStyles(w.editor.dom.getRoot(), styles);
        }

        toggleEntities = () => {
            this.setState((prevState) => ({ showEntities: !prevState.showEntities }));
            $('body', w.editor.getDoc()).toggleClass('showEntities');
        }

        toggleTags = () => {
            this.setState((prevState) => ({ showTags: !prevState.showTags }));
            $('body', w.editor.getDoc()).toggleClass('showTags');
        }

        getEditorMode = value => {
            let mode;
            if (typeof value === 'number')  {
                mode = this.editorModes.find(emode => {
                    if (emode.key === value) {
                        if (emode.key === 0 && w.allowOverlap === true) return emode;
                        if (emode.key === 0 && w.allowOverlap === false) return emode;
                        return emode;
                    }
                });
            } else if (typeof value === 'string')  {
                mode = this.editorModes.find(emode => emode.value === value);
            }
            return mode;
        }

        changeEditorMode = editorMode => {
            
            let doModeChange = false;

            if (editorMode === 'xml' && w.mode !== w.XML) {
                doModeChange = true;
            } else if (editorMode === 'xmlrdf') {
                if (w.mode !== w.XMLRDF || w.allowOverlap === true) doModeChange = true;
            } else if (editorMode === 'xmlrdfoverlap') {
                if (w.mode !== w.XMLRDF || w.allowOverlap === false) doModeChange = true;
            } else if (editorMode === 'rdf') {
                if (w.mode !== w.RDF || w.allowOverlap === false) doModeChange = true;
            }

            if (!doModeChange) {
                this.setState((prevState) => ({ mode: prevState.mode }));
                return
            }
            
            if (doModeChange) {

                let message;
                const existingOverlaps = w.entitiesManager.doEntitiesOverlap();

                // switching to xml mode from an xmlrdf mode
                if (editorMode === 'xml') {
                    message = `If you select the XML only mode, no RDF will be created when tagging entities.<br/>
                    Furthermore, the existing RDF annotations will be discarded.<br/><br/>
                    Do you wish to continue?`;
                }
                // switching from xml mode to no-overlap
                if (editorMode === 'xmlrdf' && w.mode === w.XML) {
                    message = `XML tags and RDF/Semantic Web annotations equivalent to the XML tags will be created, consistent with the hierarchy of the XML schema, so annotations will not be allowed to overlap.<br/><br/>
                    Do you wish to continue?`;
                }
                // switching from no-overlap to overlap
                if (editorMode === 'xmlrdfoverlap' && w.allowOverlap === false) {
                    message = `The editor mode will be switched to XML and RDF (Overlapping Entities) and only RDF will be created for entities that overlap existing XML structures.<br/><br/>
                    Do you wish to continue?`;
                }
                // switching from overlap to no-overlap
                if (w.allowOverlap && editorMode !== 'xmlrdfoverlap') {
                    if (existingOverlaps) {
                        message = `You have overlapping entities and are attemping to switch to a mode which prohibits them.<br/>
                        The overlapping entities will be discarded if you continue.<br/><br/>
                        Do you wish to continue?`;
                    }
                }

                // TODO rdf message

                if (message === undefined) {
                    this.applyChangeEditorMode(editorMode);
                    return;
                }

                w.dialogManager.confirm({
                    title: 'Warning',
                    msg: message,
                    callback: confirmed => {
                        if (!confirmed) return;
                        
                        if (editorMode !== 'xmlrdfoverlap') {
                            w.entitiesManager.removeOverlappingEntities();
                            w.entitiesManager.convertBoundaryEntitiesToTags();
                        }

                        this.applyChangeEditorMode(editorMode);
                    }
                });
                
            }

        }

        applyChangeEditorMode = (editorMode) => {
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

            this.setState(() => ({ mode: editorMode }));
        }

        getAnnotationMode = value => {
            let mode;
            if (typeof value === 'number')  {
                mode = this.annotationModes.find(amode => amode.key === value);
            } else if (typeof value === 'string')  {
                mode = this.annotationModes.find(amode => amode.value === value);
            }
            return mode;
        }

        changeAnnotationMode = annotationMode => {
            w.annotationMode = annotationMode;
            this.setState(() => ({ annotationMode: annotationMode }));
        }

        changeSchema = async schemaId => {
            
            if (schemaId === this.state.schema) {
                this.setState((prevState) => ({ mode: prevState.schemaId }));
                return;
            }
                
            // changeApplyButton(true);

            const rootName = await w.schemaManager.getRootForSchema(schemaId)
                .catch( () => {
                    console.warn('getRootSchema failed');
                    // this.setState((prevState) => ({ mode: prevState.schemaId }));
                    // $settingsDialog.dialog('close');
                    // w.event('schemaChanged').publish(schemaId);
                    // return;
                });
            
            // changeApplyButton(false);
            const currRootName = w.utilities.getRootTag().attr('_tag');

            if (rootName === null) {
                this.setState((prevState) => ({ schemaId: prevState.schemaId }));
                w.dialogManager.show('message', {
                    title: 'Error',
                    msg: 'The root element of the schema could not be determined and so it will not be used.',
                    type: 'error'
                });
                // $settingsDialog.dialog('close');
            } else if (currRootName !== rootName) {
                w.dialogManager.confirm({
                    title: 'Warning',
                    msg: `<p>The root element (${rootName}) required by the selected schema is different from the root element (${currRootName}) of the current document.</p>
                            <p>Applying this schema change will cause a document loading error.</p>
                            <p>Continue?</p>`,
                    type: 'info',
                    callback: doIt => {
                        if (doIt) {
                            this.setState(() => ({ schemaId: schemaId }));
                            // $settingsDialog.dialog('close');
                            w.event('schemaChanged').publish(schemaId);
                        } else {
                            this.setState((prevState) => ({ schemaId: prevState.schemaId }));
                            // $(`select[name="schema"] > option[value="${w.schemaManager.schemaId}"]`, $settingsDialog).prop('selected', true);
                        }
                    }
                });
            } else {
                this.setState((prevState) => ({ schemaId: schemaId }));
                // $settingsDialog.dialog('close');
                w.event('schemaChanged').publish(schemaId);
            }
                
        }

        handleAddSchema = () => w.dialogManager.show('addschema');

        handleResetDialogPreferences = () => {
            w.dialogManager.clearDialogPrefs();
            w.dialogManager.show('message', {
                title: 'Settings',
                msg: 'Confirmation dialog preferences have been reset.',
                height: 200
            })
        }

        handleRevertToDefault = () => {
            if (this.state.fontSize !== '11pt') this.changeFontSize('11pt');
            if (this.state.showEntities === false) this.toggleEntities();
            if (this.state.showTags === true) this.toggleTags();
            if (this.state.mode !== 'xmlrdfoverlap') this.changeEditorMode('xmlrdf');
            if (this.state.annotationMode !== w.JSON) this.changeAnnotationMode(w.JSON);
        }

        handleClose = () => $settingsDialog.dialog('close')

        render() {
            return (
                <div style={{marginTop: '10px'}}>
                    <SettingGroup 
                        label="Font Size"
                        inputs={[{
                                type: 'select',
                                value: this.state.fontSize,
                                onChange: this.changeFontSize,
                                options: this.fontSizeOptions
                            }
                        ]}
                    />
                    <SettingGroup 
                        label="Show"
                        inputs={[{
                                type: 'switch',
                                label: "Entities",
                                checked: this.state.showEntities,
                                onChange: this.toggleEntities,
                            },
                            {
                                type: 'switch',
                                label: "Tags",
                                checked: this.state.showTags,
                                onChange: this.toggleTags,
                            }
                        ]}
                    />
                    {this.state.isAdvanced &&
                    <div className="settingsDialogAdvanced">
                        <Divider style={{marginTop: '10px', marginBottom: '10px'}}/>
                        <SettingGroup 
                            label="Editor Mode"
                            inputs={[{
                                    type: 'select',
                                    id: 'editorMode',
                                    value: this.state.mode,
                                    onChange: this.changeEditorMode,
                                    options: this.editorModes
                                }
                            ]}
                        />
                        <SettingGroup 
                            label="Annotation Mode"
                            inputs={[{
                                    type: 'select',
                                    id: 'annotationMode',
                                    value: this.state.annotationMode,
                                    onChange: this.changeAnnotationMode,
                                    options: this.annotationModes
                                }
                            ]}
                        />
                        <Divider style={{marginTop: '10px', marginBottom: '10px'}}/>
                        <SettingGroup 
                            label="Schema"
                            inputs={[{
                                    type: 'select',
                                    id: 'schemaId',
                                    value: this.state.schemaId,
                                    onChange: this.changeSchema,
                                    options: w.schemaManager.schemas.map(({id,name}) => (
                                        { value: id, label: name}
                                    ))
                                },
                                {
                                    type: 'button',
                                    id: 'addSchema',
                                    label: 'Add',
                                    onClick: this.handleAddSchema
                                }
                            ]}
                        />
                        <Divider style={{marginTop: '10px', marginBottom: '10px'}}/>
                        <SettingGroup 
                            label="Dialog Preferences"
                            inputs={[{
                                    type: 'button',
                                    id: 'resetConfirmButton',
                                    label: 'Reset Confirmations',
                                    onClick: this.handleResetDialogPreference
                                }
                            ]}
                        />
                        <SettingGroup 
                            label="Editor Preferences"
                            inputs={[{
                                    type: 'button',
                                    id: 'revertToDefault',
                                    label: 'Revert to Default',
                                    onClick: this.handleRevertToDefault
                                }
                            ]}
                        />
                        <Divider style={{marginTop: '10px', marginBottom: '10px'}}/>
                        <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                            <Button
                                variant="outlined"
                                size="small"
                                name="closeButton"
                                onClick={this.handleClose}>
                                Close
                            </Button>
                        </div>
                    </div>
                    }
                </div>
            )
        }

    }


    //
    ReactDOM.render(
        <SettingsDialog ref={(settingsConponent) => {setingsComponents = settingsConponent}} />,
        document.getElementById('settingsDialogContainer')
    );
    
    
    //
    return {
        getSettings: () => {
            //convert editor mode and annotation mode back to Code Numbers
            const settings = {...setingsComponents.state}
            settings.mode = setingsComponents.getEditorMode(settings.mode).key;
            return settings;
        },
        hideAdvanced: () => (setingsComponents.toggleAdvanced(false)),
        showAdvanced: () => (setingsComponents.toggleAdvanced(true)),
        destroy: () => ($settingsDialog.dialog('destroy'))
    };
}

export {settings as settingsDialog};
