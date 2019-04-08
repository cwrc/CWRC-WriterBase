'use strict';

// load up the test 'harness' and add support for promises
// We use tape as the test harness:  https://github.com/substack/tape
const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape) // decorate tape so we can test promises

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

const CWRCWriter = require('../src/js/writer.js')


// a function to reset the html document and the writer after each test
function reset(writer) {
    if (writer != null) {
        writer.destroy();
    }
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.write('<html><body><div id="cwrcWriterContainer" style="height:100%;width:100%"></div></body></html>')
}

// and call reset to set our initial DOM with the cwrcWriterContainer div
reset(null);

test('writer constructor', (t) => {
    t.plan(1)
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    var handler = function(writer) {
        t.true(writer.isInitialized, 'writer initialized');
        reset(writer);
    }
    
    writer.event('writerInitialized').subscribe(handler);
});

test('writer.setDocument writer.getDocument', (t)=> {
    t.plan(1);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    writer.event('documentLoaded').subscribe(function(success, body) {
        var doc = writer.getDocument();
        t.true(doc.firstElementChild.textContent.indexOf('Sample letter content') !== -1, 'document set & got');
        reset(writer);
    })
    
    writer.setDocument(teiDoc, false);
});

test('writer.setDocument convertEntities', (t)=> {
    t.plan(1);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    writer.event('processingDocument').subscribe(() => {
        setTimeout(() => {
            dialogClickYes();
        }, 50);
    })

    writer.event('documentLoaded').subscribe(function(success, body) {
        t.true(window.$('[_entity]', writer.editor.getBody()).length > 0, 'document set, entities converted');
        reset(writer);
    })
    
    writer.setDocument(teiDoc, true);
});

test('writer.validate', (t)=> {
    t.plan(2);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    writer.event('documentLoaded').subscribe(() => {
        writer.event('validationInitiated').subscribe(() => {
            t.pass('validation initiated');
        });
        
        writer.event('documentValidated').subscribe(function(valid, data) {
            if (valid) {
                t.pass('document validated');
            } else {
                t.pass('document validated: not valid');
            }
            reset(writer);
        });
        
        writer.validate();
    });
    
    writer.loadDocumentXML(teiDoc, false);
});

// test('tagger.getCurrentTag', (t) => {
//     t.plan(1);
    
//     let writer = new CWRCWriter(getConfigForTestingConstructor())
    
//     writer.event('documentLoaded').subscribe(() => {
//         let tag = writer.tagger.getCurrentTag('dom_'+(tinymce.DOM.counter-1));
//         t.true(tag.length === 1, 'current tag got')
//         reset(writer);
//     });
    
//     writer.loadDocumentXML(teiDoc, false);
// });

// test('tagger.getAttributesForTag', (t) => {
//     t.plan(1);
    
//     let writer = new CWRCWriter(getConfigForTestingConstructor())
    
//     writer.event('documentLoaded').subscribe(() => {
//         let tag = window.$('[_tag="div"]', writer.editor.getBody())[0];
//         let attributes = writer.tagger.getAttributesForTag(tag);
//         t.true(attributes.type && attributes.type === 'letter', 'attributes for tag got');
//         reset(writer);
//     });
    
//     writer.loadDocumentXML(teiDoc, false);
// });

// test('tagger.setAttributesForTag', (t) => {
//     t.plan(1);
    
//     let writer = new CWRCWriter(getConfigForTestingConstructor())
    
//     writer.event('documentLoaded').subscribe(() => {
//         let tag = window.$('[_tag="div"]', writer.editor.getBody())[0];
//         var attributes = {test: true};
//         writer.tagger.setAttributesForTag(tag, attributes);
//         t.true(tag.getAttribute('test') === 'true' && tag.getAttribute('type') === null, 'attributes for tag set');
//         reset(writer);
//     });
    
//     writer.loadDocumentXML(teiDoc, false);
// });

// test('tagger.addAttributesToTag', (t) => {
//     t.plan(1);
    
//     let writer = new CWRCWriter(getConfigForTestingConstructor())
    
//     writer.event('documentLoaded').subscribe(() => {
//         let tag = window.$('[_tag="div"]', writer.editor.getBody())[0];
//         var attributes = {test: true};
//         writer.tagger.addAttributesToTag(tag, attributes);
//         t.true(tag.getAttribute('test') === 'true' && tag.getAttribute('type') === 'letter', 'attributes added to tag');
//         reset(writer);
//     });
    
//     writer.loadDocumentXML(teiDoc, false);
// });

test('tagger.addTagDialog tagger.addStructureTag tagger.removeStructureTag', (t) => {
    t.plan(2);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    const tagToAdd = 'label';

    writer.event('documentLoaded').subscribe(() => {
        dialogClickOk();
        writer.utilities.selectElementById('dom_'+(tinymce.DOM.counter-1), true);
        writer.tagger.addTagDialog(tagToAdd, 'add');
        setTimeout(dialogClickOk, 250);
    });

    writer.event('tagAdded').subscribe(function(tag) {
        t.true(tag.getAttribute('_tag') === tagToAdd, 'tag added');
        writer.tagger.removeStructureTag(tag.getAttribute('id'))
    });

    writer.event('tagRemoved').subscribe(function(tagId) {
        t.true(window.$('#'+tagId, writer.editor.getBody()).length === 0, 'tag removed');
        reset(writer);
    });
    
    writer.loadDocumentXML(teiDoc, false);
});

test('tagger.editTagDialog tagger.editStructureTag', (t) => {
    t.plan(1);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    let attributeName;
    const attributeValue = 'test';

    writer.event('documentLoaded').subscribe(() => {
        dialogClickOk();
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
    });

    writer.event('tagEdited').subscribe(function(tag) {
        t.true(tag.getAttribute(attributeName) === attributeValue, 'tag edited');
        reset(writer);
    });
    
    writer.loadDocumentXML(teiDoc, false);
});

test('tagger.editEntity', (t) => {
    t.plan(1);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    let attributeName;
    const attributeValue = 'test';

    writer.event('processingDocument').subscribe(() => {
        setTimeout(() => {
            dialogClickYes();
        }, 50);
    })

    writer.event('documentLoaded').subscribe(() => {
        dialogClickOk();
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
    });

    writer.event('entityEdited').subscribe(function(entityId) {
        let entry = writer.entitiesManager.getEntity(entityId);
        t.true(entry.getAttribute(attributeName) === attributeValue, 'entity edited');
        reset(writer);
    });
    
    writer.loadDocumentXML(teiDoc, true);
});

test('tagger.changeTagDialog', (t) => {
    t.plan(1);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())
    
    const tagName = 'name';

    writer.event('documentLoaded').subscribe(() => {
        dialogClickOk();
        writer.utilities.selectElementById('dom_'+(tinymce.DOM.counter-1), true);
        writer.tagger.changeTagDialog(tagName);
        setTimeout(() => {
            dialogClickOk();
        }, 250);
    });

    writer.event('tagEdited').subscribe(function(tag) {
        t.true(tag.getAttribute('_tag') === tagName, 'tag changed');
        reset(writer);
    });
    
    writer.loadDocumentXML(teiDoc, false);
});

test('tagger.addEntityDialog tagger.removeEntity', (t) => {
    t.plan(2);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())

    const entityType = 'link';

    writer.event('documentLoaded').subscribe(() => {
        dialogClickOk();
        writer.utilities.selectElementById('dom_'+(tinymce.DOM.counter-1), true);
        writer.tagger.addEntityDialog(entityType);
        setTimeout(() => {
            dialogClickOk();
        }, 250);
    });

    writer.event('entityAdded').subscribe(function(entityId) {
        t.true(window.$('#'+entityId, writer.editor.getBody()).attr('_type') === entityType, 'entity added');
        writer.tagger.removeEntity(entityId);
    });

    writer.event('entityRemoved').subscribe(function(entityId) {
        t.true(window.$('#'+entityId, writer.editor.getBody()).length === 0, 'entity removed');
        reset(writer);
    });
    
    writer.loadDocumentXML(teiDoc, false);
});

test('tagger.copyTag tagger.pasteTag', (t) => {
    t.plan(2);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())

    const entityType = 'link';

    writer.event('documentLoaded').subscribe(() => {
        dialogClickOk();
        let tagId = 'dom_'+(tinymce.DOM.counter-1);
        let tagType = $('#'+tagId, writer.editor.getBody()).attr('_tag');
        let tagTypeCount = $('[_tag="'+tagType+'"]', writer.editor.getBody()).length;
        writer.tagger.copyTag(tagId);
        t.true(writer.editor.copiedElement.element !== null, 'tag copied');

        writer.tagger.pasteTag();
        t.true($('[_tag="'+tagType+'"]', writer.editor.getBody()).length === tagTypeCount+1, 'tag pasted');

        reset(writer);
    });
    
    writer.loadDocumentXML(teiDoc, false);
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

    writer.event('documentLoaded').subscribe(() => {
        dialogClickOk();

        pTagCount = window.$('[_tag="body"] [_tag="p"]', writer.editor.getBody()).length;
        textNode = window.$('[_tag="body"] [_tag="p"]', writer.editor.getBody())[0].firstChild;

        writer.event('contentChanged').subscribe(splitHandler);
        
        let range = writer.editor.selection.getRng(1);
        range.setStart(textNode, 3);
        range.setEnd(textNode, 3);
        writer.editor.selection.setRng(range);
        writer.tagger.splitTag();
    });
    
    writer.loadDocumentXML(teiDoc, false);
});

test('tagger.convertTagToEntity', (t) => {
    t.plan(1);
    
    let writer = new CWRCWriter(getConfigForTestingConstructor())

    writer.event('documentLoaded').subscribe(() => {
        dialogClickOk();
        
        writer.event('entityAdded').subscribe((entityId) => {
            let tag = window.$('#'+entityId, writer.editor.getBody());
            t.true(tag.attr('_type') === 'person', 'tag converted');
            reset(writer);
        });

        let persTag = window.$('[_tag="persName"]', writer.editor.getBody()).first();
        writer.tagger.convertTagToEntity(persTag);
    });
    
    writer.loadDocumentXML(teiDoc, false);
});

let dialogClickOk = () => {
    let ok = window.$('.cwrcDialogWrapper .ui-dialog:visible .ui-dialog-buttonset .ui-button[role="ok"]');
    ok.click();
}

let dialogClickCancel = () => {
    let cancel = window.$('.cwrcDialogWrapper .ui-dialog:visible .ui-dialog-buttonset .ui-button[role="cancel"]');
    cancel.click();
}

let dialogClickYes = () => {
    let yes = window.$('.cwrcDialogWrapper .ui-dialog:visible .ui-dialog-buttonset .ui-button[role="yes"]');
    yes.click();
}

let dialogClickNo = () => {
    let no = window.$('.cwrcDialogWrapper .ui-dialog:visible .ui-dialog-buttonset .ui-button[role="no"]');
    no.click();
}

const teiDoc = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="https://cwrc.ca/schemas/cwrc_tei_lite.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>
<?xml-stylesheet type="text/css" href="https://cwrc.ca/templates/css/tei.css"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
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
    </teiHeader>
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
                <p>Sample letter content</p>
                <closer>
                    <salute>Some closing salutation, e.g. "With love..."</salute>
                    <signed>Sender name and/or signature.</signed>
                </closer>
            </div>
        </body>
    </text>
</TEI>`;

function getConfigForTestingConstructor() {
    config.storageDialogs = storageDialogs;
    config.entityLookupDialogs = entityDialogs;
    return config;
}
