'use strict';

// load up the test 'harness' and add support for promises
// We use tape as the test harness:  https://github.com/substack/tape
const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape) // decorate tape so we can test promises

const sinon = require('sinon');

const storageDialogs = require('./mocks/storage-dialogs-mock')
const entityDialogs = require('./mocks/entity-dialogs-mock');
const config = require('./mocks/config.json')

// babel-plugin-istanbul adds instrumentation to the browserified/babelified bundle, during babelification.
// When the tests are run on the browserified/babelified bundle, the instrumentation records test coverage and puts it in
// the global scope (which in the browser is 'window'.)  So when the tests finish, we get the test coverage output
// from window.__coverage__ , prepend '# coverage', and then append all of it to the TAPE console output (which also has the tape test results).
// We prepend '# coverage' to the coverage information, so we can easily find it later
// when we extract the coverage in the node test/extract-coverage.js command, used in the test scripts in package.json
test.onFinish(() => {
    console.log('# coverage:', JSON.stringify(window.__coverage__))
    window.close()
});

if (!window.$) {
    window.jQuery = window.$ = require('jquery')
}

// override alert function so it doesn't hold up tests
window.alert = function(msg) {
    console.warn('window.alert:',msg);
}

const CWRCWriter = require('../src/js/writer.js')

function initAndLoadDoc(writer, doc) {
    let docLoaded = new Promise((resolve, reject) => {
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
    return docLoaded
}

function getConfigForTestingConstructor() {
    config.storageDialogs = storageDialogs;
    config.entityLookupDialogs = entityDialogs;
    config.container = 'cwrcWriterContainer';
    config.modules = {
        west: [ {id: 'structure'}, {id: 'entities'} ], // TODO entities selectmenu is messing up ui-layout panel heights
        south: [ {id: 'selection'}, {id: 'validation', config: {"validationUrl": "https://validator.services.cwrc.ca/validator/validate.html"}} ]
    };
    return config;
}

function reset(writer) {
    if (writer != null) {
        writer.destroy();
    }
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.write('<html><body><div id="cwrcWriterContainer" style="width:900px;height:700px;"></div></body></html>')
}

reset(null);

test('writer constructor', (t) => {
    t.plan(1)
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    writer.event('writerInitialized').subscribe(function() {
        t.true(writer.isInitialized, 'writer initialized');
        reset(writer);
    });
});

test('writer.setDocument writer.getDocument', (t)=> {
    t.plan(1);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    initAndLoadDoc(writer, teiDoc).then(() => {
        var doc = writer.getDocument();
        t.true(doc.firstElementChild.textContent.indexOf('Sample letter content') !== -1, 'document set & got');
        reset(writer);
    })
});

// test('writer.setDocument convertEntities', (t)=> {
//     t.plan(1);
    
//     let writer = new CWRCWriter(getConfigForTestingConstructor())
    
//     initAndLoadDoc(writer, teiDoc).then(() => {

//         writer.event('contentChanged').subscribe(() => {
//             t.true(window.$('[_entity]', writer.editor.getBody()).length > 0, 'document set, entities converted');
//             reset(writer);
//         });

//         writer.entitiesList.convertEntities();
//     })
// });

test('writer.validate pass', (t)=> {
    t.plan(1);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())

    initAndLoadDoc(writer, teiDoc).then(() => {
        let passStub = sinon.stub(window.$, 'ajax')
        passStub.yieldsTo('success', '<?xml version="1.0" encoding="UTF-8"?><validation-result><status>pass</status></validation-result>')
        
        writer.event('documentValidated').subscribe(function(valid, data) {
            window.$.ajax.restore();
            if (valid) {
                t.pass('document validated pass');
            } else {
                t.pass('document validated fail');
            }
            reset(writer);
        });
        
        writer.validate();
    })
});

test('writer.validate fail', (t)=> {
    t.plan(1);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())

    initAndLoadDoc(writer, teiDoc).then(() => {
        let failStub = sinon.stub(window.$, 'ajax')
        failStub.yieldsTo('success', '<?xml version="1.0" encoding="UTF-8"?><validation-result><status>fail</status><warning><line>19</line><column>15</column><message></message><element>title</element><path>/TEI/text[1]/body[1]/div[1]</path></warning></validation-result>')
        
        writer.event('documentValidated').subscribe(function(valid, data) {
            window.$.ajax.restore();
            if (valid) {
                t.pass('document validated pass');
            } else {
                t.pass('document validated fail');
            }
            reset(writer);
        });
        
        writer.validate();
    })
});

test('tagger.addTagDialog tagger.addStructureTag tagger.removeStructureTag', (t) => {
    t.plan(2);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    const tagToAdd = 'label';
    
    initAndLoadDoc(writer, teiDoc).then(() => {
        writer.event('tagAdded').subscribe(function(tag) {
            t.true(tag.getAttribute('_tag') === tagToAdd, 'tag added');
            writer.tagger.removeStructureTag(tag.getAttribute('id'))
        });
    
        writer.event('tagRemoved').subscribe(function(tagId) {
            t.true(window.$('#'+tagId, writer.editor.getBody()).length === 0, 'tag removed');
            reset(writer);
        });
        
        writer.utilities.selectElementById('dom_'+(tinymce.DOM.counter-1), true);
        writer.tagger.addTagDialog(tagToAdd, 'add');
        setTimeout(dialogClickOk, 250);
    })
});

test('tagger.editTagDialog tagger.editStructureTag', (t) => {
    t.plan(1);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    let attributeName;
    const attributeValue = 'test';

    initAndLoadDoc(writer, teiDoc).then(() => {
        writer.event('tagEdited').subscribe(function(tag) {
            t.true(tag.getAttribute(attributeName) === attributeValue, 'tag edited');
            reset(writer);
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
        }, 250);
    })
});

test('tagger.editEntity', (t) => {
    t.plan(1);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    let attributeName;
    const attributeValue = 'test';
    
    initAndLoadDoc(writer, teiDoc).then(() => {
        writer.event('entityEdited').subscribe(function(entityId) {
            let entry = writer.entitiesManager.getEntity(entityId);
            t.true(entry.getAttribute(attributeName) === attributeValue, 'entity edited');
            reset(writer);
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
        }, 250);
    })
});

test('tagger.changeTagDialog', (t) => {
    t.plan(1);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    const tagName = 'name';
    
    initAndLoadDoc(writer, teiDoc).then(() => {
        writer.event('tagEdited').subscribe(function(tag) {
            t.true(tag.getAttribute('_tag') === tagName, 'tag changed');
            reset(writer);
        });
        
        writer.utilities.selectElementById('dom_'+(tinymce.DOM.counter-1), true);
        writer.tagger.changeTagDialog(tagName);
        setTimeout(() => {
            dialogClickOk();
        }, 250);
    })
});

test('tagger.addEntityDialog tagger.removeEntity', (t) => {
    t.plan(2);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())

    const entityType = 'link';
    
    initAndLoadDoc(writer, teiDoc).then(() => {
        writer.event('entityAdded').subscribe(function(entityId) {
            t.true(window.$('#'+entityId, writer.editor.getBody()).attr('_type') === entityType, 'entity added');
            writer.tagger.removeEntity(entityId);
        });
    
        writer.event('entityRemoved').subscribe(function(entityId) {
            t.true(window.$('#'+entityId, writer.editor.getBody()).length === 0, 'entity removed');
            reset(writer);
        });

        writer.utilities.selectElementById('dom_'+(tinymce.DOM.counter-1), true);
        writer.tagger.addEntityDialog(entityType);
        setTimeout(() => {
            dialogClickOk();
        }, 250);
    })
});

test('tagger.copyTag tagger.pasteTag', (t) => {
    t.plan(2);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())

    const entityType = 'link';
    
    initAndLoadDoc(writer, teiDoc).then(() => {
        let tagId = 'dom_'+(tinymce.DOM.counter-1);
        let tagType = $('#'+tagId, writer.editor.getBody()).attr('_tag');
        let tagTypeCount = $('[_tag="'+tagType+'"]', writer.editor.getBody()).length;
        writer.tagger.copyTag(tagId);
        t.true(writer.editor.copiedElement.element !== null, 'tag copied');

        writer.tagger.pasteTag();
        t.true($('[_tag="'+tagType+'"]', writer.editor.getBody()).length === tagTypeCount+1, 'tag pasted');

        reset(writer);
    })
});

test('tagger.splitTag tagger.mergeTags', (t) => {
    t.plan(2);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())

    let pTagCount;
    let textNode;

    let splitHandler = function() {
        t.true(window.$('[_tag="body"] [_tag="p"]', writer.editor.getBody()).length === pTagCount+1, 'tag split');

        let tag1 = textNode.parentElement;
        let tag2 = tag1.nextElementSibling;

        writer.event('contentChanged').unsubscribe(splitHandler);
        writer.event('contentChanged').subscribe(mergeHandler);

        writer.tagger.mergeTags([tag1, tag2]);
    }

    let mergeHandler = function() {
        t.true(window.$('[_tag="body"] [_tag="p"]', writer.editor.getBody()).length === pTagCount, 'tags merged');
        reset(writer);
    }

    initAndLoadDoc(writer, teiDoc).then(() => {
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

test('schemaManager.getRootForSchema', (t) => {
    t.plan(1);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    initAndLoadDoc(writer, teiDoc).then(() => {
        writer.schemaManager.getRootForSchema('tei').then((result) => {
            t.true(result === 'TEI', 'got root for schema');
            reset(writer);
        });
    })
});

test('mapper.convertTagToEntity', (t) => {
    t.plan(1);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    initAndLoadDoc(writer, teiDoc).then(() => {
        writer.event('entityAdded').subscribe((entityId) => {
            let tag = window.$('#'+entityId, writer.editor.getBody());
            t.true(tag.attr('_type') === 'person', 'tag converted');
            reset(writer);
        });

        let persTag = window.$('[_tag="persName"]', writer.editor.getBody())[0];
        writer.schemaManager.mapper.convertTagToEntity(persTag);
    })
});

test('mapper.findEntities', (t) => {
    t.plan(1);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    initAndLoadDoc(writer, teiDoc).then(() => {
        let entities = writer.schemaManager.mapper.findEntities()
        t.true(entities.person.length === 1, 'entity found')
        reset(writer)
    })
});

test('tagContextMenu.show', (t) => {
    t.plan(1);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    initAndLoadDoc(writer, teiDoc).then(() => {
        writer.editor.fire('contextmenu')
        setTimeout(() => {
            t.true(window.$('.tagContextMenu').length === 1, 'menu shown')
            reset(writer)
        }, 50)
    })
});

test('dialogs.settings', (t) => {
    t.plan(2);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    initAndLoadDoc(writer, teiDoc).then(() => {
        let initShowTagSetting = writer.settings.getSettings().showTags;

        window.$('.settingsLink', writer.layoutManager.getHeaderButtonsParent()).click();
        
        let settingsDialog = window.$('.cwrcDialogWrapper .ui-dialog:visible');
        t.true(settingsDialog.find('.ui-dialog-title').text() === 'Settings', 'dialog shown');
        
        settingsDialog.find('.showtags').prop('checked', !initShowTagSetting);

        dialogClickOk();

        t.true(writer.settings.getSettings().showTags === !initShowTagSetting, 'show tags changed');

        reset(writer)
    })
});

test('dialogs.header', (t) => {
    t.plan(2);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    initAndLoadDoc(writer, teiDoc).then(() => {
        window.$('.editHeader', writer.layoutManager.getHeaderButtonsParent()).click();
        
        let headerDialog = window.$('.cwrcDialogWrapper .ui-dialog:visible');
        t.true(headerDialog.find('.ui-dialog-title').text() === 'Edit Header', 'dialog shown');
        
        headerDialog.find('textarea').val('<test>Test Header</test>');

        dialogClickOk();

        t.true(window.$('[_tag="teiHeader"] > [_tag="test"]', writer.editor.getBody()).length === 1, 'header changed');

        reset(writer)
    })
});

test('dialogs.message confirm', (t) => {
    t.plan(2);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    initAndLoadDoc(writer, teiDoc).then(() => {
        writer.dialogManager.confirm({
            title: 'Confirm Test',
            msg: 'Test',
            callback: (doIt) => {
                t.true(doIt === true, 'yes clicked');
                reset(writer);
            }
        })

        let confirmDialog = window.$('.cwrcDialogWrapper .ui-dialog:visible');
        t.true(confirmDialog.find('.ui-dialog-title').text() === 'Confirm Test', 'dialog shown');

        dialogClickYes();
    })
});

test('dialogs.editSource', (t) => {
    t.plan(2);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    initAndLoadDoc(writer, teiDoc).then(() => {
        writer.dialogManager.show('editSource');
        dialogClickYes();

        setTimeout(() => {
            let editDialog = window.$('.cwrcDialogWrapper .ui-dialog:visible');
            t.true(editDialog.find('.ui-dialog-title').text() === 'Edit Source', 'dialog shown');

            editDialog.find('textarea').val('<?xml version="1.0" encoding="UTF-8"?><?xml-model href="https://cwrc.ca/schemas/cwrc_tei_lite.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?><?xml-stylesheet type="text/css" href="https://cwrc.ca/templates/css/tei.css"?><TEI xmlns="http://www.tei-c.org/ns/1.0" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><text><body>Test</body></text></TEI>');
            dialogClickOk();

            setTimeout(() => {
                t.true(window.$('[_tag="teiHeader"]', writer.editor.getBody()).length === 0, 'source edited');
                reset(writer);
            }, 50);
        }, 50);
    })
});

test('dialogs.popup', (t) => {
    t.plan(1);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    initAndLoadDoc(writer, teiDoc).then(() => {
        window.$('[_tag="ref"][_type="link"]', writer.editor.getBody()).trigger('mouseover');

        setTimeout(() => {
            let popup = window.$('.cwrcDialogWrapper .ui-dialog.popup:visible');
            t.true(popup.length === 1, 'popup shown');
            reset(writer);
        }, 50)
    })
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
<rdf:Description rdf:about="http://localhost:8080/cwrcdev/editor/documents/null">
<cw:mode>0</cw:mode>
<cw:allowOverlap>false</cw:allowOverlap>
</rdf:Description>
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

