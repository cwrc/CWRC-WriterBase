'use strict';

const path = require('path');

// uncomment to show ui
const eWin = require('electron').remote.getCurrentWindow();
eWin.setSize(900, 700);
// eWin.show();

const WAIT_TIME = 150;

// override alert function so it doesn't hold up tests
// window.alert = function(msg) {
//     console.warn('window.alert:',msg);
// }

const config = require('./mocks/config.json');
config.cwrcRootUrl = path.resolve('./build')+'\\';
config.storageDialogs = require('./mocks/storage-dialogs-mock');
config.entityLookupDialogs = require('./mocks/entity-dialogs-mock');
config.container = 'cwrcWriterContainer';
config.modules = {
    west: [ {id: 'structure'}, {id: 'entities'} ], // TODO entities selectmenu is messing up ui-layout panel heights
    south: [ {id: 'selection'}, {id: 'validation', config: {"validationUrl": "https://validator.services.cwrc.ca/validator/validate.html"}} ]
};

const CWRCWriter = require('../src/js/writer.js');
let writer = undefined;

function initAndLoadDoc(writer, doc) {
    return new Promise((resolve, reject) => {
        function handleInitialized() {
            writer.layoutManager.getContainer().height(700) // need to manually set the height otherwise it's 0
            writer.setDocument(doc)
        }
        function handleDocLoaded(success, body) {
            dialogClickOk()
            writer.event('writerInitialized').unsubscribe(handleInitialized)
            writer.event('documentLoaded').unsubscribe(handleDocLoaded)
            resolve(success, body)
        }
        writer.event('writerInitialized').subscribe(handleInitialized)
        writer.event('documentLoaded').subscribe(() => {
            setTimeout(handleDocLoaded, 50) // wait for doc load message to be shown
        })
    })
}

function getWriterInstance() {
    return new CWRCWriter(config);
}

function resetWriter() {
    if (writer) {
        writer.destroy();
        writer = undefined;
    }
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.write('<html><body><div id="cwrcWriterContainer" style="width:900px;height:700px;"></div></body></html>')
}

beforeEach(() => {
    resetWriter();
})

test('writer constructor', () => {
    expect.assertions(1);
    
    writer = getWriterInstance();
    
    return new Promise((resolve, reject) => {
        writer.event('writerInitialized').subscribe(function() {
            expect(writer.isInitialized).toBe(true);
            resolve(true);
        })
    })
});

test('writer.setDocument writer.getDocument', () => {
    expect.assertions(1);
    
    writer = getWriterInstance();
    
    return initAndLoadDoc(writer, teiDoc).then(() => {
        var doc = writer.getDocument();
        expect(doc.firstElementChild.textContent.indexOf('Sample letter content')).toBeGreaterThan(-1);
    })
});

test('writer.setDocument convertEntities', () => {
    expect.assertions(1);
    
    writer = getWriterInstance()
    
    return new Promise((resolve, reject) => {
        initAndLoadDoc(writer, teiDoc).then(() => {

            writer.event('contentChanged').subscribe(() => {
                expect($('[_entity]', writer.editor.getBody()).length).toBeGreaterThan(1);
                resolve();
            });

            writer.entitiesList.convertEntities();
        })
    })
});


test('writer.validate pass', () => {
    expect.assertions(1);
    
    writer = getWriterInstance();

    return initAndLoadDoc(writer, teiDoc).then(() => {
        writer.event('documentValidated').subscribe(function(valid, data) {
            jest.restoreAllMocks();
            expect(valid).toBe(true);
        });
        
        jest.spyOn(window.$, 'ajax').mockImplementation(({success}) => {
            success('<?xml version="1.0" encoding="UTF-8"?><validation-result><status>pass</status></validation-result>');
        });

        writer.validate();
    })
});

test('writer.validate fail', () => {
    expect.assertions(1);
    
    writer = getWriterInstance()

    return initAndLoadDoc(writer, teiDoc).then(() => {
        writer.event('documentValidated').subscribe(function(valid, data) {
            jest.restoreAllMocks();
            expect(valid).toBe(false);
        });
        
        jest.spyOn(window.$, 'ajax').mockImplementation(({success}) => {
            success('<?xml version="1.0" encoding="UTF-8"?><validation-result><status>fail</status><warning><line>19</line><column>15</column><message></message><element>title</element><path>/TEI/text[1]/body[1]/div[1]</path></warning></validation-result>');
        });

        writer.validate();
    })
});

test('tagger.addTagDialog tagger.addStructureTag tagger.removeStructureTag', () => {
    expect.assertions(2);
    
    writer = getWriterInstance()
    
    const tagToAdd = 'label';
    
    return new Promise((resolve, reject) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            writer.event('tagAdded').subscribe(function(tag) {
                expect(tag.getAttribute('_tag')).toBe(tagToAdd);
                writer.tagger.removeStructureTag(tag.getAttribute('id'));
            });
        
            writer.event('tagRemoved').subscribe(function(tagId) {
                expect(window.$('#'+tagId, writer.editor.getBody()).length).toBe(0);
                resolve();
            });
            
            writer.utilities.selectElementById('dom_'+(tinymce.DOM.counter-1), true);
            writer.tagger.addTagDialog(tagToAdd, 'add');
            setTimeout(dialogClickOk, WAIT_TIME);
        })
    });
});

test('tagger.editTagDialog tagger.editStructureTag', () => {
    expect.assertions(1);
    
    writer = getWriterInstance()
    
    let attributeName;
    const attributeValue = 'test';

    return new Promise((resolve, reject) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            writer.event('tagEdited').subscribe(function(tag) {
                expect(tag.getAttribute(attributeName)).toBe(attributeValue);
                resolve();
            });
            
            writer.utilities.selectElementById('dom_'+(tinymce.DOM.counter-1), true);
            writer.tagger.editTagDialog();
            setTimeout(() => {
                let li = window.$('.attributeSelector:visible li:eq(0)');
                attributeName = li.attr('data-name');
                li.click();
                let input = window.$('.attsContainer:visible input[name="'+attributeName+'"]');
                input.val(attributeValue);
                dialogClickOk();
            }, WAIT_TIME);
        })
    })
});

test('tagger.editEntity', () => {
    expect.assertions(1);
    
    writer = getWriterInstance()
    
    let attributeName;
    const attributeValue = 'test';
    
    return new Promise((resolve, rejct) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            writer.event('entityEdited').subscribe(function(entityId) {
                let entry = writer.entitiesManager.getEntity(entityId);
                expect(entry.getAttribute(attributeName)).toBe(attributeValue);
                resolve();
            });
            
            let entityEl = window.$('[_entity]', writer.editor.getBody()).first();
            let entry = writer.entitiesManager.getEntity(entityEl.attr('id'));
            writer.dialogManager.show('schema/'+entry.getType(), {entry: entry})
            
            setTimeout(() => {
                let li = window.$('.attributeSelector:visible li:eq(0)');
                attributeName = li.attr('data-name');
                li.click();
                let input = window.$('.attsContainer:visible input[name="'+attributeName+'"]');
                input.val(attributeValue);
                dialogClickOk();
            }, WAIT_TIME);
        })
    })
});

test('tagger.changeTagDialog', () => {
    expect.assertions(1);
    
    writer = getWriterInstance()
    
    const tagName = 'name';
    
    return new Promise((resolve, rejct) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            writer.event('tagEdited').subscribe(function(tag) {
               expect(tag.getAttribute('_tag')).toBe(tagName);
               resolve();
            });
            
            writer.utilities.selectElementById('dom_'+(tinymce.DOM.counter-1), true);
            writer.tagger.changeTagDialog(tagName);
            setTimeout(() => {
                dialogClickOk();
            }, WAIT_TIME);
        })
    });
});

test('tagger.addEntityDialog tagger.removeEntity', () => {
    expect.assertions(2);
    
    writer = getWriterInstance()

    const entityType = 'link';
    
    return new Promise((resolve, rejct) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            writer.event('entityAdded').subscribe(function(entityId) {
                expect(window.$('#'+entityId, writer.editor.getBody()).attr('_type')).toBe(entityType);
                writer.tagger.removeEntity(entityId);
            });
        
            writer.event('entityRemoved').subscribe(function(entityId) {
                expect(window.$('#'+entityId, writer.editor.getBody()).length).toBe(0);
                resolve();
            });

            writer.utilities.selectElementById('dom_'+(tinymce.DOM.counter-1), true);
            writer.tagger.addEntityDialog(entityType);
            setTimeout(() => {
                dialogClickOk();
            }, WAIT_TIME);
        })
    });
});

test('tagger.copyTag tagger.pasteTag', () => {
    expect.assertions(2);
    
    writer = getWriterInstance()

    const entityType = 'link';
    
    return initAndLoadDoc(writer, teiDoc).then(() => {
        let tagId = 'dom_'+(tinymce.DOM.counter-1);
        let tagType = $('#'+tagId, writer.editor.getBody()).attr('_tag');
        let tagTypeCount = $('[_tag="'+tagType+'"]', writer.editor.getBody()).length;
        writer.tagger.copyTag(tagId);
        expect(writer.editor.copiedElement.element).not.toBeNull();

        writer.tagger.pasteTag();
        expect($('[_tag="'+tagType+'"]', writer.editor.getBody()).length).toBe(tagTypeCount+1);
    })
});

test('tagger.splitTag tagger.mergeTags', () => {
    expect.assertions(2);
    
    writer = getWriterInstance()

    let pTagCount;
    let textNode;

    let splitHandler = function() {
        expect(window.$('[_tag="body"] [_tag="p"]', writer.editor.getBody()).length).toBe(pTagCount+1);

        let tag1 = textNode.parentElement;
        let tag2 = tag1.nextElementSibling;

        writer.event('contentChanged').unsubscribe(splitHandler);
        writer.event('contentChanged').subscribe(mergeHandler);

        writer.tagger.mergeTags([tag1, tag2]);
    }

    let mergeHandler = function() {
        expect(window.$('[_tag="body"] [_tag="p"]', writer.editor.getBody()).length).toBe(pTagCount);
        writer.event('contentChanged').unsubscribe(mergeHandler);
    }

    return initAndLoadDoc(writer, teiDoc).then(() => {
        pTagCount = window.$('[_tag="body"] [_tag="p"]', writer.editor.getBody()).length;
        textNode = window.$('[_tag="body"] [_tag="p"]', writer.editor.getBody())[0].firstChild;

        writer.event('contentChanged').subscribe(splitHandler);
        
        let range = writer.editor.selection.getRng(1);
        range.setStart(textNode, 3);
        range.setEnd(textNode, 3);
        writer.editor.selection.setRng(range);
        writer.tagger.splitTag();
    })
});

test('schemaManager.getRootForSchema', () => {
    expect.assertions(1);
    
    writer = getWriterInstance()
    
    return new Promise((resolve, reject) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            writer.schemaManager.getRootForSchema('tei').then((result) => {
                expect(result).toBe('TEI');
                resolve();
            });
        })
    })
});

test('mapper.convertTagToEntity', () => {
    expect.assertions(1);
    
    writer = getWriterInstance()
    
    return initAndLoadDoc(writer, teiDoc).then(() => {
        writer.event('entityAdded').subscribe((entityId) => {
            let tag = window.$('#'+entityId, writer.editor.getBody());
            expect(tag.attr('_type')).toBe('person');
        });

        let persTag = window.$('[_tag="persName"]', writer.editor.getBody())[0];
        writer.schemaManager.mapper.convertTagToEntity(persTag);
    })
});

test('mapper.findEntities', () => {
    expect.assertions(1);
    
    writer = getWriterInstance()
    
    return initAndLoadDoc(writer, teiDoc).then(() => {
        let entities = writer.schemaManager.mapper.findEntities();
        expect(entities.person.length).toBe(1);
    })
});

// test('tagContextMenu.show', (t) => {
//     expect.assertions(1);
    
//     writer = getWriterInstance()
    
//     initAndLoadDoc(writer, teiDoc).then(() => {
//         writer.editor.fire('contextmenu')
//         setTimeout(() => {
//             t.true(window.$('.tagContextMenu').length === 1, 'menu shown')
//             resetWriter()
//         }, 50)
//     })
// });

test('dialogs.settings', () => {
    expect.assertions(2);
    
    writer = getWriterInstance()
    
    return new Promise((resolve, reject) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            let initShowTagSetting = writer.settings.getSettings().showTags;

            window.$('.settingsLink', writer.layoutManager.getHeaderButtonsParent()).click();
            
            let settingsDialog = window.$('.cwrcDialogWrapper .ui-dialog:visible');
            expect(settingsDialog.find('.ui-dialog-title').text()).toBe('Settings');
            
            settingsDialog.find('.showtags').prop('checked', !initShowTagSetting);

            dialogClickOk();

            expect(writer.settings.getSettings().showTags).not.toBe(initShowTagSetting);

            resolve();
        })
    })
});

test('dialogs.header', () => {
    expect.assertions(2);
    
    writer = getWriterInstance()
    
    return new Promise((resolve, reject) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            window.$('.editHeader', writer.layoutManager.getHeaderButtonsParent()).click();
            
            let headerDialog = window.$('.cwrcDialogWrapper .ui-dialog:visible');
            expect(headerDialog.find('.ui-dialog-title').text()).toBe('Edit Header');
            
            headerDialog.find('textarea').val('<test>Test Header</test>');

            dialogClickOk();

            expect(window.$('[_tag="teiHeader"] > [_tag="test"]', writer.editor.getBody()).length).toBe(1);

            resolve();
        })
    });
});

test('dialogs.message confirm', () => {
    expect.assertions(2);
    
    writer = getWriterInstance()
    
    return new Promise((resolve, reject) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            writer.dialogManager.confirm({
                title: 'Confirm Test',
                msg: 'Test',
                callback: (doIt) => {
                    expect(doIt).toBe(true);
                    resolve();
                }
            })

            let confirmDialog = window.$('.cwrcDialogWrapper .ui-dialog:visible');
            expect(confirmDialog.find('.ui-dialog-title').text()).toBe('Confirm Test');

            dialogClickYes();
        })
    });
});

test('dialogs.editSource', () => {
    expect.assertions(2);
    
    writer = getWriterInstance()
    
    return new Promise((resolve, reject) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            writer.dialogManager.show('editSource');
            dialogClickYes();

            setTimeout(() => {
                let editDialog = window.$('.cwrcDialogWrapper .ui-dialog:visible');
                expect(editDialog.find('.ui-dialog-title').text()).toBe('Edit Source');

                editDialog.find('textarea').val('<?xml version="1.0" encoding="UTF-8"?><?xml-model href="https://cwrc.ca/schemas/cwrc_tei_lite.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?><?xml-stylesheet type="text/css" href="https://cwrc.ca/templates/css/tei.css"?><TEI xmlns="http://www.tei-c.org/ns/1.0" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><text><body>Test</body></text></TEI>');
                dialogClickOk();

                setTimeout(() => {
                    expect(window.$('[_tag="teiHeader"]', writer.editor.getBody()).length).toBe(0);
                    resolve();
                }, 50);
            }, 50);
        })
    });
});

test('dialogs.popup', () => {
    expect.assertions(1);
    
    writer = getWriterInstance()
    
    return new Promise((resolve, reject) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            window.$('[_tag="ref"][_type="link"]', writer.editor.getBody()).trigger('mouseover');

            setTimeout(() => {
                let popup = window.$('.cwrcDialogWrapper .ui-dialog.popup:visible');
                expect(popup.length).toBe(1);
                resolve();
            }, 50)
        })
    });
});

let dialogClickOk = () => {
    let ok = window.$('.cwrcDialogWrapper .ui-dialog:visible .ui-dialog-buttonset .ui-button[role="ok"]');
    if (ok.length === 0) console.warn('ok button not visible');
    ok.click();
}

let dialogClickCancel = () => {
    let cancel = window.$('.cwrcDialogWrapper .ui-dialog:visible .ui-dialog-buttonset .ui-button[role="cancel"]');
    if (cancel.length === 0) console.warn('cancel button not visible');
    cancel.click();
}

let dialogClickYes = () => {
    let yes = window.$('.cwrcDialogWrapper .ui-dialog:visible .ui-dialog-buttonset .ui-button[role="yes"]');
    if (yes.length === 0) console.warn('yes button not visible');
    yes.click();
}

let dialogClickNo = () => {
    let no = window.$('.cwrcDialogWrapper .ui-dialog:visible .ui-dialog-buttonset .ui-button[role="no"]');
    if (no.length === 0) console.warn('no button not visible');
    no.click();
}

const teiDoc = `<?xml version="1.0" encoding="UTF-8"?><?xml-model href="https://cwrc.ca/schemas/cwrc_tei_lite.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?><?xml-stylesheet type="text/css" href="https://cwrc.ca/templates/css/tei.css"?><TEI xmlns="http://www.tei-c.org/ns/1.0" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<teiHeader>
    <fileDesc>
        <titleStmt>
            <title>Sample Document Title</title>
        </titleStmt>
        <publicationStmt>
            <p></p>
        </publicationStmt>
        <sourceDesc>
            <p></p>
        </sourceDesc>
    </fileDesc>
<xenoData>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:cw="http://cwrc.ca/ns/cw#">
<rdf:Description rdf:datatype="http://www.w3.org/TR/json-ld/"><![CDATA[
{
"@context": "http://www.w3.org/ns/oa/oa.ttl",
"@id": "http://id.cwrc.ca/annotation/6cae06d6-5c6c-4def-b902-c556a7050761",
"@type": "oa:Annotation",
"motivatedBy": [
    "oa:linking"
],
"annotatedAt": "2019-04-16T21:43:15.680Z",
"annotatedBy": {
    "@id": "http://id.cwrc.ca/user/8497d2ed-fe1a-48ca-8901-ff9cbdd34488",
    "@type": "foaf:Person",
    "mbox": {
        "@id": ""
    },
    "name": ""
},
"serializedAt": "2019-04-16T21:43:15.680Z",
"serializedBy": "",
"hasBody": {
    "@id": "http://id.cwrc.ca/link/f18a4646-7a88-47d0-b0e4-4118f16ac4d8",
    "@type": [
        "cnt:ContentAsText",
        "oa:SemanticTag"
    ]
},
"hasTarget": {
    "@id": "http://id.cwrc.ca/doc/18cdc1bd-45d3-4c92-89d5-670a9f865f1c",
    "@type": "oa:SpecificResource",
    "hasSource": {
        "@id": "http://id.cwrc.ca/doc/18cdc1bd-45d3-4c92-89d5-670a9f865f1c",
        "@type": "dctypes:Text",
        "format": "text/xml"
    },
    "hasSelector": {
        "@id": "http://id.cwrc.ca/selector/b815ec89-cd08-4a90-83fc-0d7839f5b79d",
        "@type": "oa:FragmentSelector",
        "dcterms:conformsTo": "http://tools.ietf.org/rfc/rfc3023",
        "rdf:value": "xpointer(TEI/text/body/div/p/ref)"
    }
},
"cwrcAttributes": {
    "target": "#"
}
}
]]></rdf:Description></rdf:RDF></xenoData></teiHeader>
<text>
    <body>
        <div type="letter">
            <head>
                <title>Sample Letter Title</title>
            </head>
            <opener>
                <note type="setting">
                    <p>Some opening note describing the writing setting</p>
                </note>
                <dateline>
                    <date>Some date (set date value in attribute).</date>
                </dateline>
                <salute>Some salutation, e.g. "Dearest <persName cert="definite" type="real" ref="http://viaf.org/viaf/39569752">Miquel</persName>"</salute>
            </opener>
            <p>Sample letter content, including a <ref target="#">link</ref>.</p>
            <closer>
                <salute>Some closing salutation, e.g. "With love..."</salute>
                <signed>Sender name and/or signature.</signed>
            </closer>
        </div>
    </body>
</text>
</TEI>`;
