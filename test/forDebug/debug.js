if (!window.$) {
    window.jQuery = window.$ = require('jquery');
}

window.CWRCWriterStorageDialogs = require('cwrc-git-dialogs');

// only continue loading the cwrcWriter if the user has authenticated with github
if (window.CWRCWriterStorageDialogs.authenticate()) {

    window.CWRCWriterLayout = require('./layout-config.js');
    let viaf = require('viaf-entity-lookup')
    let dbpedia = require('dbpedia-entity-lookup');
    let wikidata = require('wikidata-entity-lookup');
    let getty = require('getty-entity-lookup');
    window.CWRCWriterDialogs = require('cwrc-public-entity-dialogs');

    window.CWRCWriterDialogs.registerEntitySources({
        people: (new Map()).set('viaf', viaf).set('dbpedia', viaf).set('wikidata', wikidata).set('getty', getty).set('dbpedia', dbpedia),
        places: (new Map()).set('viaf', viaf).set('dbpedia', viaf).set('wikidata', wikidata).set('geocode', viaf).set('dbpedia', dbpedia),
        organizations: (new Map()).set('viaf', viaf).set('dbpedia', viaf).set('wikidata', wikidata).set('dbpedia', dbpedia),
        titles: (new Map()).set('viaf', viaf).set('dbpedia', viaf).set('wikidata', wikidata).set('dbpedia', dbpedia),
    })
    //window.CWRCWriterStorageDialogs = require('./storage-dialogs.js');
    window.CWRCWriterConfig = require('./config.js');
    window.CWRCWriter = require('../../src/js/writer.js');
}