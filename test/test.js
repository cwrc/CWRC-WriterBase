'use strict';

// load up the test 'harness' and add support for promises
// We use tape as the test harness:  https://github.com/substack/tape
const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape) // decorate tape so we can test promises
// load up the sinon mocking library
const sinon = require('sinon');
// sometimes helpful to use a logger, this one outputs log messages in popups.
//const log = require('log4javascript').getDefaultLogger();
// you'd use it like so:  log.info(someObject)  or log.debug('some message')
// See log4javascript.org
// Alternatively, run this test script in the browser and set breakpoints.
// I've included a development.html file that loads the browserified script, and a browserify-test npm script
// that browserifies the script.  There is also a browserify-watch command that does the same as browserify-test
// but (not surprisingly) 'watches' for changes to files and runs browserify again if it finds any.


/*
the configs and modules that we normally require for the CWRC-Writer:

var config = require('./config')
config.storageDialogs = require('cwrc-git-dialogs');
config.entityLookupDialogs = require('cwrc-public-entity-dialogs');

Some of those come from the file system, and some from npm.

When testing, however, instead of requiring the actual dependencies (modules) from npm, we often set up mocks (fake objects) and use those instead.
    The mocks will generally return precanned replies for the methods we know
our (testable) code will make to the module.  Mocks allow us to:

 1.  control what's returned, and so isolate the specific code we want to test.
For example, if we are testing the constructor, we could mock everything that is passed in ( config, storageDialogs,
    entityLookupDialogs)
 2.  prevent activity like network access that could slow our tests, or introduce network errors.

Rather than make our own mocks we can also use a mocking library like sinon to mock our objects, or even just
specific methods on pre-existing objects.  Sinon provides some extra useful feature
like being able to count how many times one of our mocks was called, mock only calls with certain arguments, etc.
*/
const storageDialogs = require('./mocks/storage-dialogs-mock')
const entityDialogs = require('./mocks/entity-dialogs-mock');
const config = require('./mocks/config.json')

// babel-plugin-istanbul adds instrumentation to the browserified/babelified bundle, during babelification.
// When the tests are run on the browserified/babelified bundle, the instrumentation records test coverage and puts it in
// the global scope (which in the browser is 'window'.)  So when the tests finish, we get the test coverage output
// from window.__coverage__ , prepend '# coverage', and then append all of it to the TAPE console output (which also has the tape test results).
// We prepend '# coverage' to the coverage information, so we can easily find it later
// when we extract the coverage in the node test/extract-coverage.js command, used in the test scripts in package.json
test.onFinish(()=>{
    console.log('# coverage:', JSON.stringify(window.__coverage__))
    window.close()
});

if (!window.$) {
    window.jQuery = window.$ = require('jquery')
}

// load the code we are testing
// which in this case is the constructor from which we get our writer object
const CWRCWriter = require('../src/js/writer.js')


// a function to reset the html document and the writer after each test
function reset(writer) {
    if (writer != null) {
        writer.layoutManager.destroy();
    }
    document.write('<html><body><div id="cwrcWriterContainer" style="height:100%;width:100%"></div></body></html>')
}

// and call reset to set our initial DOM with the cwrcWriterContainer div
reset(null);

/* A common way to organize tests is with the three A's:
    ASSEMBLE - prepare everything we need for the test, e.g., setup mocks
    ACT - run whatever code we are testing
    ASSERT - verify that things turned out as we expected
 */

test('writer constructor', (t)=>{
    t.plan(1)
    
    let configForTestingConstructor = getConfigForTestingConstructor();
    let writer = new CWRCWriter(configForTestingConstructor)
    
    var handler = function(writer) {
        t.true(writer.isInitialized, 'writerInitialized');
        reset(writer);
    }
    
    writer.event('writerInitialized').subscribe(handler);
})


test('writer.loadDocumentXML', (t)=> {
    t.plan(1);
    
    let configForTestingConstructor = getConfigForTestingConstructor();
    let writer = new CWRCWriter(configForTestingConstructor)
    
    writer.event('documentLoaded').subscribe(function(success, body) {
        t.true(body.textContent.indexOf('Sample letter content') !== -1, 'documentLoaded');
        reset(writer);
    })
    
    loadTEIDoc(writer);
});

test('writer.getDocument', (t)=> {
    t.plan(1);
    
    let configForTestingConstructor = getConfigForTestingConstructor();
    let writer = new CWRCWriter(configForTestingConstructor)
    
    writer.event('documentLoaded').subscribe(function() {
        var doc = writer.getDocument();
        t.true(doc.firstElementChild.textContent.indexOf('Sample letter content') !== -1, 'getDocument');
        reset(writer);
    });
    
    loadTEIDoc(writer);
});

test('writer.validate', (t)=> {
    t.plan(2);
    
    let configForTestingConstructor = getConfigForTestingConstructor();
    let writer = new CWRCWriter(configForTestingConstructor)
    
    writer.event('documentLoaded').subscribe(function() {
        writer.event('validationInitiated').subscribe(function() {
            t.pass('validationInitiated');
        });
        
        writer.event('documentValidated').subscribe(function(valid, data) {
            if (valid) {
                t.pass('documentValidated');
            } else {
                t.pass('documentValidated not valid');
            }
            reset(writer);
        });
        
        writer.validate();
    });
    
    loadTEIDoc(writer);
});

test('writer.selectElementById', (t)=> {
    t.plan(1);
    
    let configForTestingConstructor = getConfigForTestingConstructor();
    let writer = new CWRCWriter(configForTestingConstructor)
    
    writer.event('documentLoaded').subscribe(function(success, body) {
        
        var structTagId = writer.editor.getBody().querySelector('[_tag="div"]').id;
        writer.event('tagSelected').subscribe(function() {
            var node = writer.editor.selection.getNode();
            t.true(node.id === structTagId, 'node selected');
            reset(writer);
        });
                
        writer.utilities.selectElementById(structTagId);
    })
    
    loadTEIDoc(writer);
});

test('tinymce plugin contextmenu', (t)=> {
    t.plan(1);
    
    let configForTestingConstructor = getConfigForTestingConstructor();
    let writer = new CWRCWriter(configForTestingConstructor)
    
    writer.event('documentLoaded').subscribe(function(success, body) {
        var $okButton = window.$('.ui-dialog-buttonset .ui-button:visible');
        $okButton.click();
        
        var tag = writer.editor.getBody().querySelector('[_tag="div"]');
        writer.editor.fire('contextmenu', {target: tag});
        
        var visible = window.$('.mce-floatpanel:visible');
        t.true(visible.length === 1, 'context menu shown');
        reset(writer);
    })
    
    loadTEIDoc(writer);
});

test('tinymce plugin schematags', (t)=> {
    t.plan(1);
    
    let configForTestingConstructor = getConfigForTestingConstructor();
    let writer = new CWRCWriter(configForTestingConstructor)
    
    writer.event('documentLoaded').subscribe(function(success, body) {
        var $okButton = window.$('.ui-dialog-buttonset .ui-button:visible');
        $okButton.click();
        
        var $tagsButton = window.$('.mce-toolbar-grp button:eq(0)');
        $tagsButton.click();
        
        var visible = window.$('.mce-floatpanel:visible');
        t.true(visible.length === 2, 'schematags menu shown');
        reset(writer);
    })
    
    loadTEIDoc(writer);
});

test('writer.tagger.editStructureTag', (t)=> {
    t.plan(1);
    
    let configForTestingConstructor = getConfigForTestingConstructor();
    let writer = new CWRCWriter(configForTestingConstructor)
    
    writer.event('documentLoaded').subscribe(function(success, body) {
        writer.event('tagEdited').subscribe(function(tagEl) {
            t.pass('tag edited');
            reset(writer);
        });
        
        var structTagId = writer.editor.getBody().querySelector('[_tag="div"]').id;
        writer.tagger.editStructureTag(window.$('#'+structTagId, writer.editor.getBody()), {
            style: 'good'
        });
    })
    
    loadTEIDoc(writer);
});

test('writer.tagger.addEntity.Note', (t)=> {
    t.plan(1);
    
    let configForTestingConstructor = getConfigForTestingConstructor();
    let writer = new CWRCWriter(configForTestingConstructor)
    
    writer.event('documentLoaded').subscribe(function(success, body) {
        var $okButton = window.$('.ui-dialog-buttonset .ui-button:visible');
        $okButton.click();
        
        var ents = writer.entitiesManager.getEntities();
        var cnt1 = 0;
        for (var key in ents) {
            cnt1++;
        }
        
        writer.event('tagSelected').subscribe(function(tagId) {
//            writer.editor.currentBookmark = writer.editor.selection.getBookmark(1);
//            writer.dialogManager.show('note', {type: 'note'});
            writer.tagger.addEntity('note');
            setTimeout(function() {
                var $saveButton = window.$('.ui-dialog-buttonset .ui-button:visible:eq(1)');
                $saveButton.click();
                
                var ents = writer.entitiesManager.getEntities();
                var cnt2 = 0;
                for (var key in ents) {
                    cnt2++;
                }
                t.true(cnt2 == cnt1+1, 'entity added');
                reset(writer);
            }, 250);
        });
        
        var structTagId = writer.editor.getBody().querySelector('[_tag="title"]').id;
        writer.utilities.selectElementById(structTagId);
    })
    
    loadTEIDoc(writer);
});

test('schemaTags addSchemaTag', (t)=> {
    t.plan(1);
    
    let configForTestingConstructor = getConfigForTestingConstructor();
    let writer = new CWRCWriter(configForTestingConstructor)
    
    writer.event('documentLoaded').subscribe(function(success, body) {
        var $okButton = window.$('.ui-dialog-buttonset .ui-button:visible');
        $okButton.click();
        
        writer.event('tagSelected').subscribe(function(tagId) {
            var d = writer.dialogManager.getDialog('schemaTags');
            d.addSchemaTag({key: 'unclear'});
            setTimeout(function() {
                writer.event('tagAdded').subscribe(function(tagEl) {
                    t.pass('schema tag added');
                    reset(writer);
                });
                
                var $saveButton = window.$('.ui-dialog-buttonset .ui-button:visible:eq(1)');
                $saveButton.click();
            }, 250);
        });
        
        var structTagId = writer.editor.getBody().querySelector('[_tag="title"]').id;
        writer.utilities.selectElementById(structTagId);
    })
    
    loadTEIDoc(writer);
});

test('settings showTags', (t)=> {
    t.plan(1);
    
    let configForTestingConstructor = getConfigForTestingConstructor();
    let writer = new CWRCWriter(configForTestingConstructor)
    
    writer.event('documentLoaded').subscribe(function(success, body) {
        var $okButton = window.$('.ui-dialog-buttonset .ui-button:visible');
        $okButton.click();
        
        var $settingsButton = window.$('.headerButtons div:eq(0)');
        $settingsButton.click();
        
        var $checkbox = window.$('.ui-dialog .showtags');
        $checkbox.click();
        
        var $applyButton = window.$('.ui-dialog-buttonset .ui-button:visible:eq(2)');
        $applyButton.click();
        
        var bodyClasses = writer.editor.getBody().className;
        t.true(bodyClasses.indexOf('showTags') !== -1, 'tags showing');
        reset(writer);
    })
    
    loadTEIDoc(writer);
});

test('structureTree contextMenu', (t)=> {
    t.plan(1);
    
    let configForTestingConstructor = getConfigForTestingConstructor();
    let writer = new CWRCWriter(configForTestingConstructor)
    
    writer.event('documentLoaded').subscribe(function(success, body) {
        var $okButton = window.$('.ui-dialog-buttonset .ui-button:visible');
        $okButton.click();
        
        var $anchor = window.$('.jstree-anchor:eq(2)');
        
        $anchor.contextmenu();
        
        var visible = window.$('.jstree-contextmenu:visible');
        t.true(visible.length === 1, 'context menu shown');
        reset(writer);
    })
    
    loadTEIDoc(writer);
});

test('relations', (t)=> {
    t.plan(1);
    
    let configForTestingConstructor = getConfigForTestingConstructor();
    configForTestingConstructor.modules = {
        west: ['relations','structure','entities'],
        east: ['selection'],
        south: ['validation']
    }
    let writer = new CWRCWriter(configForTestingConstructor)
    
    writer.event('documentLoaded').subscribe(function(success, body) {
        var $okButton = window.$('.ui-dialog-buttonset .ui-button:visible');
        $okButton.click();
        
        var $addButton = window.$('.ui-layout-pane-west .ui-tabs-panel:eq(0) button[role="add"]');
        $addButton.click();
        
        var visible = window.$('.triplesDialog:visible')
        t.true(visible.length === 1, 'triples dialog shown');
        reset(writer);
    })
    
    loadTEIDoc(writer);
});

test('imageViewer', (t)=> {
    t.plan(1);
    
    let configForTestingConstructor = getConfigForTestingConstructor();
    configForTestingConstructor.modules = {
        west: ['relations','structure','entities'],
        east: ['imageViewer'],
        south: ['validation']
    }
    let writer = new CWRCWriter(configForTestingConstructor)
    
    writer.event('documentLoaded').subscribe(function(success, body) {
        var $okButton = window.$('.ui-dialog-buttonset .ui-button:visible');
        $okButton.click();
        
        t.pass();
        reset(writer);
    })
    
    loadTEIDoc(writer);
});

function loadTEIDoc(writer) {
    var teiDoc = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="https://cwrc.ca/schemas/cwrc_tei_lite.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>
<?xml-stylesheet type="text/css" href="https://cwrc.ca/templates/css/tei.css"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:cw="http://cwrc.ca/ns/cw#" xmlns:w="http://cwrctc.artsrn.ualberta.ca/#"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:cw="http://cwrc.ca/ns/cw#" xmlns:oa="http://www.w3.org/ns/oa#" xmlns:foaf="http://xmlns.com/foaf/0.1/">
<rdf:Description rdf:about="https://dev-cwrc-writer.cwrc.ca//editor/documents/null">
    <cw:mode>0</cw:mode>
    <cw:allowOverlap>false</cw:allowOverlap>
</rdf:Description>
<rdf:Description xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" rdf:about="http://id.cwrc.ca/annotation/33c377f1-21fa-4594-9b1f-93d7e387fc8a">
    <oa:hasTarget xmlns:oa="http://www.w3.org/ns/oa#" rdf:resource="http://id.cwrc.ca/target/168ba39d-2bb9-464d-b33a-013fa630d2c1"/>
    <oa:hasBody xmlns:oa="http://www.w3.org/ns/oa#" rdf:resource="http://cwrc-dev-01.srv.ualberta.ca/islandora/object/73c334d3-2629-4f63-835b-23fc0a706d7c"/>
    <oa:annotatedBy xmlns:oa="http://www.w3.org/ns/oa#" rdf:resource=""/>
    <oa:annotatedAt xmlns:oa="http://www.w3.org/ns/oa#">2018-03-27T20:11:15.715Z</oa:annotatedAt>
    <oa:serializedBy xmlns:oa="http://www.w3.org/ns/oa#" rdf:resource=""/>
    <oa:serializedAt xmlns:oa="http://www.w3.org/ns/oa#">2018-03-27T20:11:15.715Z</oa:serializedAt>
    <rdf:type rdf:resource="http://www.w3.org/ns/oa#Annotation"/>
    <oa:motivatedBy xmlns:oa="http://www.w3.org/ns/oa#" rdf:resource="http://www.w3.org/ns/oa#tagging"/>
    <oa:motivatedBy xmlns:oa="http://www.w3.org/ns/oa#" rdf:resource="http://www.w3.org/ns/oa#identifying"/>
    <cw:hasCertainty xmlns:cw="http://cwrc.ca/ns/cw#" rdf:resource="http://cwrc.ca/ns/cw#definite"/>
    <cw:cwrcInfo xmlns:cw="http://cwrc.ca/ns/cw#">{"id":"http://viaf.org/viaf/39569752","name":"Brown, Miquel","repository":"viaf"}</cw:cwrcInfo>
    <cw:cwrcAttributes xmlns:cw="http://cwrc.ca/ns/cw#">{"cert":"definite","type":"real","ref":"http://viaf.org/viaf/39569752"}</cw:cwrcAttributes>
</rdf:Description>
<rdf:Description xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" rdf:about="http://cwrc-dev-01.srv.ualberta.ca/islandora/object/73c334d3-2629-4f63-835b-23fc0a706d7c">
    <rdf:type rdf:resource="http://www.w3.org/ns/oa#SemanticTag"/>
    <rdf:type rdf:resource="http://xmlns.com/foaf/0.1/Person"/>
</rdf:Description>
<rdf:Description xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" rdf:about="http://id.cwrc.ca/target/168ba39d-2bb9-464d-b33a-013fa630d2c1">
    <oa:hasSource xmlns:oa="http://www.w3.org/ns/oa#" rdf:resource="http://id.cwrc.ca/doc/9a813236-4b4e-4f31-b418-7a183a285b5e"/>
    <rdf:type rdf:resource="http://www.w3.org/ns/oa#SpecificResource"/>
    <oa:hasSelector xmlns:oa="http://www.w3.org/ns/oa#" rdf:resource="http://id.cwrc.ca/selector/6b4bbd1a-b887-498b-b5f7-be401bfcd6d9"/>
</rdf:Description>
<rdf:Description xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" rdf:about="http://id.cwrc.ca/selector/6b4bbd1a-b887-498b-b5f7-be401bfcd6d9">
    <rdf:value>xpointer(/TEI/text/body/div/opener/salute/persName)</rdf:value>
    <rdf:type rdf:resource="http://www.w3.org/ns/oa#FragmentSelector"/>
</rdf:Description>
</rdf:RDF>
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
    writer.loadDocumentXML(teiDoc, false);
}


function getConfigForTestingConstructor() {
    config.storageDialogs = storageDialogs;
    config.entityLookupDialogs = entityDialogs;
    return config;
}
