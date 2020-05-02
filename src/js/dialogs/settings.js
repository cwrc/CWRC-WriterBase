import React, {Component} from 'react'
import ReactDOM, { createPortal } from 'react-dom';
import Button from '@material-ui/core/Button';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import Divider from '@material-ui/core/Divider';
import Icon from '@material-ui/core/Icon';
import IconButton from '@material-ui/core/IconButton';
import { makeStyles } from '@material-ui/core/styles'

import grey from '@material-ui/core/colors/grey';


const colorGrey = grey[600];

import $ from 'jquery';

// import 'jquery-ui/ui/widgets/button';
    
const settings = (writer, config) => {

    const w = writer;

    class HeaderMenuOptions extends Component {

        useStyles = makeStyles((theme) => ({
            root: {
                '& > *': {
                    margin: theme.spacing(1),
                },
            },
            colorPrimary: '#FFFFFF'
        }));

        openDialog = () => {
            $settingsDialog.dialog('open');
        }

        render() {
            return (
                <div className={this.useStyles.root} style={{textDecoration: "none"}}>
                    <IconButton 
                        size="small"
                        onClick={this.openDialog}
                        color="inherit" 
                        className="settingsLink"
                        aria-label="settings">
                        <Icon fontSize="small">settings</Icon>
                    </IconButton>
                    <IconButton 
                        size="small"
                        href="https://cwrc.ca/Documentation/CWRC-Writer"
                        target="_blank"
                        rel="noopener noreferrer"
                        color="inherit" 
                        className="helpLink"
                        aria-label="help">
                        <Icon fontSize="small">help</Icon>
                    </IconButton>
                </div>
            )
        }
    }

    ReactDOM.render(
        <HeaderMenuOptions />,
        w.layoutManager.getHeaderButtonsParent()[0]
    );

    // $('<div class="helpLink"><a href="https://cwrc.ca/Documentation/CWRC-Writer" target="_blank">Help</a></div>').prependTo(w.layoutManager.getHeaderButtonsParent());
    // const $settingsLink = $('<div class="settingsLink">Settings</div>').prependTo(w.layoutManager.getHeaderButtonsParent());
    // $settingsLink.click(() => {
    //     $settingsDialog.dialog('open');
    // });

    const $settingsDialog = $('<div id="settingsDialogContainer"></div>').appendTo(w.dialogManager.getDialogWrapper());

    $settingsDialog.dialog({
        title: 'Settings',
        modal: true,
        resizable: false,
        // dialogClass: 'splitButtons',
        closeOnEscape: true,
        // height: 360,
        width: 450,
        position: { my: 'center', at: 'center', of: w.layoutManager.getContainer() },
        autoOpen: false,
        open: (event, ui) => {
            $('.ui-dialog-titlebar-close', ui.dialog).show();
        },
        close: () => {
            $settingsDialog.dialog('close');
        }
    });


    class SettingsDialog extends Component {

        state = {
            isAdvanced: true,
            fontSize: '11pt',
            showTags: false,
            showEntities: false,
            mode: 'xmlrdfoverlap',
            annotationMode: 'json',
            allowOverlap: false,
            schemaId: 'tei'
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
            { key: w.XML, value: 'xml', label: 'RDF/XML'},
            { key: w.JSON, value: 'json', label: 'JSON-LD'}
        ]

        componentDidMount = () => {
            if (w.isReadOnly) this.toggleAdvanced(false);

            const editorMode = this.getEditorMode(w.mode);
            const annotationMode = this.getAnnotationMode(w.annotationMode);
            
            this.setState(() => ({
                showEntities: config.showEntities,
                showTags: config.showTags,
                mode: editorMode.value,
                annotationMode: annotationMode.value,
                allowOverlap: w.allowOverlap
            }));
        }

        toggleAdvanced = value => {
            this.setState(() => ({ isAdvanced: value }));
            // const height = (value === false) ? 150 : 'auto';
            // $settingsDialog.dialog('option', 'height', height);
        }

        changeFontSize = element => {
            const newSize = element.target.value;
            this.setState(() => ({ fontSize: newSize }));
            const styles = { fontSize: newSize };
            w.editor.dom.setStyles(w.editor.dom.getRoot(), styles);
        }

        toggleTags = () => {
            this.setState((prevState) => ({ showTags: !prevState.showTags }));
            $('body', w.editor.getDoc()).toggleClass('showTags');
        }

        toggleEntities = () => {
            this.setState((prevState) => ({ showEntities: !prevState.showEntities }));
            $('body', w.editor.getDoc()).toggleClass('showEntities');
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

        changeEditorMode = element => {

            const editorMode = element.target.value;
            
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
                this.setState((prevState) => ({ mode: prevStateZ.editorMode }));
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

        changeAnnotationMode = element => {
            const annotationMode = element.target.value;
            w.annotationMode = annotationMode;
            this.setState(() => ({ annotationMode: annotationMode }));
        }

        changeSchema = async element => {
            const schemaId = element.target.value;

            console.log(schemaId);

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
                            this.setState(() => ({ schema: schemaId }));
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

        // resetSettings = () => {
        //     let editorVal;
        //     switch(defaultSettings.mode) {
        //         case w.XMLRDF:
        //             editorVal = 'xmlrdf';
        //             if (defaultSettings.allowOverlap) {
        //                 editorVal = 'xmlrdfoverlap';
        //             }
        //             break;
        //         case w.XML:
        //             editorVal = 'xml';
        //             break;
        //         case w.RDF:
        //             editorVal = 'rdf';
        //             break;
        //     }
        //     $('select[name="editormode"]', $settingsDialog).val(editorVal);
        //     $('select[name="annotations"]', $settingsDialog).val(defaultSettings.annotationMode);
            
        //     $('select[name="schema"]', $settingsDialog).val(defaultSettings.validationSchema);
        // }

        render() {
            return (
                <div style={{marginTop: '10px'}}>

                    <div id="fontSizeContainer" style={{display: 'flex', marginBottom: '20px'}}>
                        <div style={{flex: 1, textAlignLast: 'right', paddingRight: '10px', paddingTop: '7px'}}>
                            {/* <label><b>Font Size</b></label> */}
                            {/* <h3>Font Size</h3> */}
                            {/* <Typography className={classes.title} variant="h6" noWrap>
                                Font Size
                            </Typography> */}
                            Font Size
                        </div>
                        <div style={{flex: 2}}>
                            <Select
                                labelId="font-size"
                                id="dfontSize"
                                value={this.state.fontSize}
                                onChange={this.changeFontSize}
                                >
                                {this.fontSizeOptions.map(({value,label}) => (
                                    <MenuItem key={value} value={value}>{label}</MenuItem>
                                ))}
                            </Select>
                            {/* <Select
                                label="fontsize"
                                value={this.state.fontSize}
                                options={this.fontSizeOptions}
                                onChange={this.changeFontSize} /> */}
                        </div>
                    </div>

                    <div id="showTagsContainer" style={{display: 'flex', marginBottom: '20px'}}>
                        <div style={{flex: 1, textAlignLast: 'right', paddingRight: '10px', paddingTop: '7px'}}>
                            <label><b>Show</b></label>
                        </div>
                        <div style={{flex: 2}}>
                            <div stlye={{dispaly: 'flex', flexDirection: 'colunm'}}>
                                <div>
                                    <FormControlLabel
                                        control={
                                        <Switch
                                            checked={this.state.showEntities}
                                            onChange={this.toggleEntities}
                                            name="showEntities"
                                            color="primary"
                                            size="small" 
                                            inputProps={{ 'aria-label': 'show entities' }}
                                        />
                                        }
                                        label="Entities"
                                    />
                                    {/* <FormControlLabel
                                        control={
                                        <Checkbox
                                            checked={this.state.showEntities}
                                            onChange={this.toggleEntities}
                                            inputProps={{ 'aria-label': 'show entities' }}
                                            name="Tags"
                                            // color="primary"
                                            style={{paddingTop: '0px', paddingBottom: '0px'}}
                                        />
                                        }
                                        label="Entities"
                                    /> */}
                                </div>
                                <div>
                                    <FormControlLabel
                                        control={
                                        <Switch
                                            checked={this.state.showTags}
                                            onChange={this.toggleTags}
                                            name="showTags"
                                            color="primary"
                                            size="small"
                                            inputProps={{ 'aria-label': 'show tags' }}
                                        />
                                        }
                                        label="Tags"
                                    />
                                    {/* <FormControlLabel
                                        control={
                                        <Checkbox
                                            checked={this.state.showTags}
                                            onChange={this.toggleTags}
                                            inputProps={{ 'aria-label': 'show tags' }}
                                            name="Tags"
                                            color="primary"
                                            style={{paddingTop: '0px', paddingBottom: '0px'}}
                                        />
                                        }
                                        label="Tags"
                                    /> */}
                                </div>
                                {/* <Checkbox
                                    label='Entities'
                                    isSelected={this.state.showEntities}
                                    onCheckboxChange={this.toggleEntities}
                                    key='Entities'
                                />
                                <Checkbox
                                    label='Tags'
                                    isSelected={this.state.showTags}
                                    onCheckboxChange={this.toggleTags}
                                    key='Tags'
                                /> */}
                            </div>
                        </div>
                    </div>

                    {this.state.isAdvanced &&
                        <div className="settingsDialogAdvanced">

                            {/* <hr style={{marginTop: '20px', borderBottom: 0, borderTop: '1px solid #aaa'}} /> */}
                            <Divider style={{marginTop: '10px', marginBottom: '20px'}}/>

                            <div id="editorModeContainer" style={{display: 'flex', marginBottom: '20px'}} >
                                <div style={{flex: 1, textAlignLast: 'right', paddingRight: '10px', paddingTop: '7px'}}>
                                    <label><b>Editor Mode</b></label>
                                </div>
                                <div style={{flex: 2}}>
                                    <Select
                                        labelId="editor-mode"
                                        id="editorMode"
                                        value={this.state.mode}
                                        onChange={this.changeEditorMode}
                                        >
                                        {this.editorModes.map(({value,label}) => (
                                            <MenuItem key={value} value={value}>{label}</MenuItem>
                                        ))}
                                    </Select>
                                    {/* <Select
                                        label="editormode"
                                        value={this.state.mode}
                                        options={this.editorModes}
                                        onChange={this.changeEditorMode} /> */}
                                </div>
                            </div>

                            <div id="annotationMode" style={{display: 'flex', marginBottom: '20px'}}>
                                <div style={{flex: 1, textAlignLast: 'right', paddingRight: '10px', paddingTop: '7px'}}>
                                    <label><b>Annotations Format</b></label>
                                </div>
                                <div style={{flex: 2}}>
                                    <Select
                                        labelId="annotation-mode"
                                        id="annotationMode"
                                        value={this.state.annotationMode}
                                        onChange={this.changeAnnotationMode}
                                        >
                                        {this.annotationModes.map(({value,label}) => (
                                            <MenuItem key={value} value={value}>{label}</MenuItem>
                                        ))}
                                    </Select>
                                    {/* <Select
                                        label="annotations"
                                        value={this.state.annotationMode}
                                        options={this.annotationModes}
                                        onChange={this.changeAnnotationMode} /> */}
                                </div>
                            </div>

                            <Divider style={{marginTop: '10px', marginBottom: '20px'}}/>
                            {/* <hr style={{marginTop: '20px', borderBottom: 0, borderTop: '1px solid #ccc'}} /> */}

                            <div id="schemaOptionContainer" style={{display: 'flex', marginBottom: '20px'}}>
                                <div style={{flex: 1, textAlignLast: 'right', paddingRight: '10px', paddingTop: '7px'}}>
                                    <label><b>Schema</b></label>
                                </div>
                                <div style={{flex: 2}}>
                                    <div style={{display: 'flex', flexDirection: 'column'}}>
                                        <div>
                                            <Select
                                                labelId="schema-id"
                                                id="schemaId"
                                                value={this.state.schemaId}
                                                onChange={this.changeSchema}
                                                >
                                                {w.schemaManager.schemas.map(({id,name}) => (
                                                    <MenuItem key={id} value={id}>{name}</MenuItem>
                                                ))}
                                            </Select>
                                            {/* <Select
                                                label="schema"
                                                value={this.state.schemaId}
                                                options={w.schemaManager.schemas.map(({id,name}) => (
                                                    { value: id, label: name}
                                                ))}
                                                onChange={this.changeSchema} /> */}
                                        </div>
                                        <div style={{marginTop: '15px'}}>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                name="addSchemaButton"
                                                onClick={this.handleAddSchema}>
                                                Add
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Divider style={{marginTop: '10px', marginBottom: '20px'}}/>

                            {/* <hr style={{marginTop: '20px', borderBottom: 0, borderTop: '1px solid #ccc'}} /> */}

                            <div id="dialogPrefsContainer" style={{display: 'flex', marginBottom: '20px'}}>
                                <div style={{flex: 1, textAlignLast: 'right', paddingRight: '10px', paddingTop: '7px'}}>
                                    <label><b>Dialog Preferences</b></label>
                                </div>
                                <div style={{flex: 2}}>
                                    <Button
                                        variant="outlined"
                                        name="resetConfirmButton"
                                        size="small"
                                        onClick={this.handleResetDialogPreferences}>
                                        Reset Confirmations
                                    </Button>
                                </div>
                            </div>
                            {/* <div id="settingsPrefsContainer" style={{display: 'flex', marginTop: '10px'}}>
                                <div style={{flex: 1, textAlign: 'right'}}>
                                    <label><b>Settings Preferences</b></label>
                                </div>
                                <div style={{flex: 2}}>
                                    <button
                                        type="button"
                                        name="resetConfirmButton"
                                        onClick={this.resetSettings}>
                                        Revert to Default
                                    </button>
                                </div>
                            </div> */}
                        </div>
                    }
                </div>
            )
        }

    }


    let setingsComponents;

    ReactDOM.render(
        <SettingsDialog ref={(settingsConponent) => {setingsComponents = settingsConponent}} />,
        document.getElementById('settingsDialogContainer')
    );
    
    
    return {
        getSettings: () => {
            //convert editor mode and annotation mode back to Code Numbers
            const settings = {...setingsComponents.state}
            settings.mode = setingsComponents.getEditorMode(settings.mode).key;
            settings.annotationMode = setingsComponents.getAnnotationMode(settings.annotationMode).key;
            return settings;
        },
        hideAdvanced: () => (setingsComponents.toggleAdvanced(false)),
        showAdvanced: () => (setingsComponents.toggleAdvanced(true)),
        destroy: () => ($settingsDialog.dialog('destroy'))
    };
}

export {settings as settingsDialog};