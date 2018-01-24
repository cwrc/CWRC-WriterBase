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
config.layout = require('./layout-config')
config.storageDialogs = require('cwrc-git-dialogs');
config.entityLookupDialogs = require('cwrc-public-entity-dialogs');

Some of those come from the file system, and some from npm.

When testing, however, instead of requiring the actual dependencies (modules) from npm, we often set up mocks (fake objects) and use those instead.
    The mocks will generally return precanned replies for the methods we know
our (testable) code will make to the module.  Mocks allow us to:

 1.  control what's returned, and so isolate the specific code we want to test.
For example, if we are testing the constructor, we could mock everything that is passed in ( config, storageDialogs,
    entityLookupDialogs, and layout)
 2.  prevent activity like network access that could slow our tests, or introduce network errors.

Rather than make our own mocks we can also use a mocking library like sinon to mock our objects, or even just
specific methods on pre-existing objects.  Sinon provides some extra useful feature
like being able to count how many times one of our mocks was called, mock only calls with certain arguments, etc.
*/
const storageDialogs = require('./mocks/storage-dialogs-mock')
const entityDialogs = require('./mocks/entity-dialogs-mock');
const layout = require('./mocks/layout-config')

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
function reset() {
    document.write('<html><body><div id="cwrcWriterContainer" style="height:100%;width:100%"></div></body></html>')
    delete window.writer
}

// and call reset to set our initial DOM with the cwrcWriterContainer div
reset()

/* A common way to organize tests is with the three A's:
    ASSEMBLE - prepare everything we need for the test, e.g., setup mocks
    ACT - run whatever code we are testing
    ASSERT - verify that things turned out as we expected
 */

test('constructor', (assert=>{
    // tell tape how many assertions we'll make in this test
    // plan throws an error at the end of the test if the actual number of assertions made doesn't match the planned number
    assert.plan(3)
    // 'ASSEMBLE'
    let configForTestingConstructor = getConfigForTestingConstructor();
    // 'ACT'
    window.writer = new CWRCWriter(configForTestingConstructor)
    // 'ASSERT'
    let expected = 'some value in the writer maybe or elsewhere'
    let actual = 'some value in the writer maybe or elsewhere'
    assert.equal(actual, expected, 'did set the config XXXX value')  // there are also deepEquals methods to compare structure and nested values
    // assert.ok validates the truthiness of the first argument:
    let truthyValueOfThingWeAreChecking = typeof CWRCWriter == 'function';
    assert.ok(truthyValueOfThingWeAreChecking, 'the "require" loaded our constructor')  // ok aliases are assert.true() and assert.assert()
    assert.pass('some message')  // use this for cases not covered by the other test methods, e.g., if a callback was called.  See example below
    // YOU'D ADD IN HERE WHATEVER ELSE YOU WANT TO TEST THAT THE CONSTRUCTOR SHOULD AND SHOULDN'T HAVE DONE.
    reset()
}))


// This test doesn't test CWRC-WriterBase, it is just here to show that two generic methods on assert are 'pass' and 'fail' e.g.,
test('a timing call', (assert)=> {
    assert.plan(1)
    let cb = () => {
        assert.pass('was called')
    }
    try { setTimeout(cb, 10) } catch(err) {assert.fail('threw an exception')}
});

test('init', (assert)=> {
    assert.plan(1);
    // ASSEMBLE
    let configForTestingConstructor = getConfigForTestingConstructor()
    window.writer = new CWRCWriter(configForTestingConstructor)
    // ACT
  //  window.writer.init('cwrcWriterContainer')
    // ASSERT
    assert.ok(true, 'did something either in javascript or in the DOM');
    reset()
});

// I've included two different ways here to test that calling the showLoadDialog method actually does call the dialog we passed in
// (as a propery of the config) when we invoked the writer's constructor
// First, by replacing the 'load' method on our mock:
test('showLoadDialog', (assert)=> {
    assert.plan(2);
    // ASSEMBLE
    let configForTestingConstructor = getConfigForTestingConstructor()
    configForTestingConstructor.storageDialogs.load = function(writer){
        assert.pass('calls storageDialogs.load');
        assert.equal(writer, window.writer, 'with writer as an argument')
    }

    window.writer = new CWRCWriter(configForTestingConstructor)
   // window.writer.init('cwrcWriterContainer')
    // ACT
    writer.showLoadDialog()
    // ASSERT
   // we already stated our assertions above, even though they aren't actually made until after the showLoadDialog call.
});

// Second, using sinon:

test('showLoadDialog with sinon', (assert)=> {
    assert.plan(2);
    // ASSEMBLE
    let configForTestingConstructor = getConfigForTestingConstructor()
    var sinonSpy = sinon.spy();
    configForTestingConstructor.storageDialogs.load = sinonSpy;
    window.writer = new CWRCWriter(configForTestingConstructor)
   // window.writer.init('cwrcWriterContainer')
    // act
    writer.showLoadDialog()
    // assert
    assert.ok(sinonSpy.calledOnce, 'calls storageDialogs.load but only once');
    assert.ok(sinonSpy.calledWith(window.writer));
});

// it's tempting to test more deeply here, like that the storageDialogs.load method correctly sets the
// document in the writer, but that's a test of the storageDialogs module, and so
// that test should be done in the storageDialogs module.


function getConfigForTestingConstructor() {
    return {
        layout,
        storageDialogs: Object.assign({}, storageDialogs),
        entityLookupDialogs: Object.assign({}, entityDialogs),
        "validationUrl": "http://validator.services.cwrc.ca/validator/validate.html",
        "schemas": {
            "tei": {
                "name": "CWRC Basic TEI Schema",
                "url": "http://cwrc.ca/schemas/cwrc_tei_lite.rng",
                "cssUrl": "http://cwrc.ca/templates/css/tei.css",
                "schemaMappingsId": "tei",
                "entityTemplates": {
                    "note": "schema/tei/xml/note.xml",
                    "citation": "schema/tei/xml/citation.xml"
                }
            },
            "events": {
                "name": "Events Schema",
                "url": "http://cwrc.ca/schemas/orlando_event_v2.rng",
                "cssUrl": "http://cwrc.ca/templates/css/orlando_v2_cwrc-writer.css",
                "schemaMappingsId": "orlando",
                "entityTemplates": {
                    "note": "schema/orlando/xml/note_events.xml",
                    "citation": "schema/orlando/xml/citation_events.xml"
                }
            },
            "biography": {
                "name": "Biography Schema",
                "url": "http://cwrc.ca/schemas/orlando_biography_v2.rng",
                "cssUrl": "http://cwrc.ca/templates/css/orlando_v2_cwrc-writer.css",
                "schemaMappingsId": "orlando",
                "entityTemplates": {
                    "note": "schema/orlando/xml/note_biography.xml",
                    "citation": "schema/orlando/xml/citation_biography.xml"
                }
            },
            "writing": {
                "name": "Writing Schema",
                "url": "http://cwrc.ca/schemas/orlando_writing_v2.rng",
                "cssUrl": "http://cwrc.ca/templates/css/orlando_v2_cwrc-writer.css",
                "schemaMappingsId": "orlando",
                "entityTemplates": {
                    "note": "schema/orlando/xml/note_writing.xml",
                    "citation": "schema/orlando/xml/citation_writing.xml"
                }
            },
            "cwrcEntry": {
                "name": "CWRC Entry Schema",
                "url": "http://cwrc.ca/schemas/cwrc_entry.rng",
                "cssUrl": "http://cwrc.ca/templates/css/cwrc.css",
                "schemaMappingsId": "cwrcEntry",
                "entityTemplates": {
                    "note": "schema/cwrcEntry/xml/note.xml",
                    "citation": "schema/cwrcEntry/xml/citation.xml"
                }
            }
        },
        "defaultDocument": "templates/letter",
        "container":"cwrcWriterContainer"
    }
}
