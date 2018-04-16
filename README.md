![Picture](http://cwrc.ca/logos/CWRC_logos_2016_versions/CWRCLogo-Horz-FullColour.png)

[![Travis](https://img.shields.io/travis/cwrc/CWRC-WriterBase.svg)](https://travis-ci.org/cwrc/CWRC-WriterBase)
[![Codecov](https://img.shields.io/codecov/c/github/cwrc/CWRC-WriterBase.svg)](https://codecov.io/gh/cwrc/CWRC-WriterBase)
[![version](https://img.shields.io/npm/v/cwrc-writer-base.svg)](http://npm.im/cwrc-writer-base)
[![downloads](https://img.shields.io/npm/dm/cwrc-writer-base.svg)](http://npm-stat.com/charts.html?package=cwrc-writer-base&from=2015-08-01)
[![GPL-2.0](https://img.shields.io/npm/l/cwrc-writer-base.svg)](http://opensource.org/licenses/GPL-2.0)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

CWRC-Writer-Base
================

The [Canadian Writing Research Collaboratory (CWRC)](http://www.cwrc.ca/) is developing an in-browser text markup editor (CWRC-Writer) for use by collaborative scholarly editing projects.  This package is the base code that builds on the TinyMCE javascript editor, and is meant to be packaged together (using Browserify) with two other packages that communicate with a server that provides document storage and entity (people, places) lookup.  A default version of the CWRC-Writer that uses GitHub for storage and VIAF for entity lookup is available for anyone's use:  

[http://208.75.74.217](http://208.75.74.217)  

## Table of Contents

1. [Overview](#overview)
1. [Storage and entity lookup](#storage-and-entity-lookup)
1. [Layout](#layout)
1. [Configuration](#overview)
1. [API](#api)
1. [Managers](#managers)
1. [Modules](#modules)
1. [Demo](#demo)
1. [Development](#development)

## Overview

CWRCWriter is a WYSIWYG text editor for in-browser XML editing and stand-off RDF annotation.  
The editor is a customization of the [TinyMCE](http://www.tinymce.com) editor.

A 'CWRCWriter' installation is a bundling of the main CWRC-WriterBase (the code in this repository) with  
a few other NPM packages that handle interaction (calls to the server from dialogs for user input) with server-side services for:

* document storage
* named entity lookup 

The default implementation of the CWRC-Writer is the [CWRC-GitWriter](https://github.com/cwrc/cwrc-gitwriter) which uses 
GitHub to store documents, and uses [VIAF](https://viaf.org), [WikiData](https://www.wikidata.org), [DBpedia](http://wiki.dbpedia.org), 
[Getty](http://vocab.getty.edu) for named entity (people, places) lookup.  

The dialogs to interact with GitHub, VIAF,  are in the NPM packages:
 
* [cwrc-git-dialogs](https://github.com/cwrc/cwrc-git-dialogs)
* [cwrc-public-entity-dialogs](https://github.com/cwrc/CWRC-PublicEntityDialogs)

The CWRC-PublicEntityDialogs package in turn uses:

* [getty-entity-lookup](https://github.com/cwrc/getty-entity-lookup)
* [wikidata-entity-lookup](https://github.com/cwrc/wikidata-entity-lookup)
* [dbpedia-entity-lookup](https://github.com/cwrc/dbpedia-entity-lookup)
* [viaf-entity-lookup](https://github.com/cwrc/viaf-entity-lookup)

The CWRC-GitWriter (the default CWRC-Writer) therefore bundles (using browserify) those NPM packages together with the CWRC-WriterBase package. 
You may substitute your own packages with dialogs that interact with your own backend storage and/or entity lookup.

The CWRCWriterBase itself also provides built in interaction with default server-side services for:

* XML Validation
* XML Schemas
* documentation and help

CWRC provides a default XML validation HTTP end point that the CWRC-WriterBase is preconfigured to use.  
You may substitute your own, but the CWRC-WriterBase expects validation and error messages in a specific format.  
Similarly you can substitute your own documentation and help files.

## Storage and entity lookup

If you choose not to use either the default CWRC GitHub storage or the CWRC named entity lookups then most of the 
work in setting up CWRCWriter for your project will be in implementing the dialogs to interact with your backend storage 
and/or named entity lookups. We have split these pieces off into their own packages in large part to make it easier to 
substitute your own dialogs and supporting services.  

A good example to follow when creating a new CWRC-Writer project is our pubic implementation 
[CWRC-GitWriter](https://github.com/cwrc/CWRC-GitWriter).  You might also choose to use either the 
CWRC GitHub storage dialogs or the CWRC public entity lookups, both of which are used by the CWRC-GitWriter, 
and replace just one of the two.  To help understand how we've developed the CWRC-Writer, you could also 
look at our [development docs](https://github.com/cwrc/CWRC-Writer-Dev-Docs]).

To replace either of the storage and entity dialogs, you'll need to create objects with the following APIs:

#### Storage object API

load(writer)

save(writer)

where 'writer' is the writer object (i.e., the object defined in the [API](#writer-object) section.

The storage object for GitHub is implemented here:  [cwrc-git-dialogs](https://github.com/cwrc/cwrc-git-dialogs)

Each method is invoked by the CWRC-WriterBase whenever the end user clicks the 'save' or 'load' button in the editor.

Each method spawns a dialog that prompts the user to load or save.  Because load(writer) and save(writer) are passed an instance of the CWRC writer object, all of the methods defined below in [API](#writer-object) are available, to allow get and set of the XML in the writer.

We also define an authenticate method on our cwrc-git-dialogs object to handle the Oauth authentication of GitHub.  You may implement your authentication however you like.  If you want to follow our approach you can see it here: [https://github.com/cwrc/CWRC-GitWriter/blob/master/src/js/app.js] where we authenticate before instantiating the CWRC-WriterBase.  

#### Entity Lookup API

You have at least two choices here:

1. You can entirely implement your own dialog for lookup, following the model in 
[CRWCPublicEntityDialogs](https://github.com/cwrc/CWRC-PublicEntityDialogs)

2. You can use [CRWCPublicEntityDialogs](https://github.com/cwrc/CWRC-PublicEntityDialogs) and configure it with different 
sources.  We provide four sources (viaf, wikidata, getty, DBpedia).  

* [getty-entity-lookup](https://github.com/cwrc/getty-entity-lookup)
* [wikidata-entity-lookup](https://github.com/cwrc/wikidata-entity-lookup)
* [dbpedia-entity-lookup](https://github.com/cwrc/dbpedia-entity-lookup)
* [viaf-entity-lookup](https://github.com/cwrc/viaf-entity-lookup)

You can use any of these sources, and supplement them with your own sources.  [CRWCPublicEntityDialogs](https://github.com/cwrc/CWRC-PublicEntityDialogs) fully 
explains how to add your own sources.

## Layout 

The layout of the CWRC-Writer can be modified from a configuration file.
See [https://github.com/cwrc/CWRC-GitWriter/blob/master/src/js/layout-config.js] for an example of initialization and layout. [https://github.com/cwrc/CWRC-GitWriter/blob/master/src/js/app.js] shows how to pass the layout config file into the CWRC-WriterBase.  The following API section talks more about configuration.

## API

### Constructor

The CWRC-WriterBase exports a single constructor function that takes one argument, a configuration object.

See [https://github.com/cwrc/CWRC-GitWriter/blob/master/src/js/config.js] for an example of a base configuration file, and  
[https://github.com/cwrc/CWRC-GitWriter/blob/master/src/js/app.js] to see the configuration file loaded, extended, and passed into the constructor.

### Configuration Object

Options that can be set on the configuration object:

##### Required Options

* `config.cwrcRootUrl`: String. An absolute URL that should point to the root of the CWRC-Writer directory. <b>Required</b>.
* `config.storageDialogs`: Object.  Object. Storage dialogs, see [cwrc-gi-dialogs](https://github.com/cwrc/cwrc-git-dialogs) for example and API definition.
* `config.layout`: Object.  Layout object as described above [Layout](#layout), see [layout-config.js](https://github.com/cwrc/CWRC-GitWriter/blob/master/src/js/layout-config.js) for example.
* `config.entityLookupDialogs`: Object. Entity lookup, see [cwrc-public-entity-dialogs](https://github.com/cwrc/CWRC-PublicEntityDialogs) for example and API definition.

##### Other Options

* `config.mode`: String. The mode in which to start the CWRC-Writer.  `xml` or `xmlrdf`.
* `config.allowOverlap`: Boolean. Should overlapping entities be allowed initially?.
* `config.schemas`: Object. A map of schema objects that can be used in the CWRC-Writer. Each entry should contain the following:
  * `name`: String. The schema title.
  * `url`: String. A url that links to the schema (RELAX NG) file.
  * `cssUrl`: String. A url that links to the CSS associated with this schema.
  * `schemaMappingsId`: String. The directory name in the schema directory: https://github.com/cwrc/CWRC-Writer/tree/development/src/js/schema from which to load mapping and dialogs files for the schema.
  * `entityTemplates`: Object. Lists urls for use by citation and note entity dialogs.
* `config.cwrcDialogs`: Object. Lists urls for use by the [CWRC-Dialogs](https://github.com/cwrc/CWRC-Dialogs). 
* `config.buttons1`, `config.buttons2`, `config.buttons3`: String. A comma separated list of plugins to set in the CWRC-Writer toolbars. Possible values: `addperson, addplace, adddate, addorg, addcitation, addnote, addtitle, addcorrection, addkeyword, addlink, editTag, removeTag, addtriple, viewsource, editsource, validate, savebutton, loadbutton`.

#### Configuration within documents

Configuration information can be included in the XML documents themselves, to override project settings:

`XML/RDF mode`  

Set the mode with a cw:mode setting in the RDF section:

```
<rdf:Description rdf:about="http://localhost:8080/editor/documents/null">
    <cw:mode>0</cw:mode>
</rdf:Description>
```

where allowable values for `cw:mode` are:

0 = XML & RDF  (default - XML & RDF with no overlap)  
1 = XML  
2 = RDF

`Annotation Overlap`

Overlapping annotations, those that cross XML tags, are disallowed by default. Enable them with:

```
<rdf:Description rdf:about="http://localhost:8080/editor/documents/null">
    <cw:allowOverlap>true</cw:allowOverlap>
</rdf:Description>
```

### Writer object

The object returned by the constructor is defined here: [writer.js](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/writer.js).  The typical properties and methods you'd want to use when implementing your own storage and/or entity dialogs are:

#### Properties

###### isInitialized
boolean    
 *Has the editor been initialized.* 

###### isReadOnly  
boolean     
 *Is the editor in readonly mode.*  
  
###### isAnnotator
boolean  
*Is the editor in annotate (entities) only mode.*

#### Methods

###### loadDocument(xmlDoc)
*Loads a parsed XML document into the editor*

###### getDocument()
*Returns the parsed XML document from the editor*

###### getDocRawContent()
*Returns the raw textual content from the editor, including xml tags*

###### showLoadDialog()
*Convenience method to call the load() method of the object set in the storageDialogs property of the config object passed to the writer.*

###### validate (callback)
*Validates the current document*
callback(w, valid): function where w is the writer and valid is true/false.
Fires a `documentValidated` event if validation is successful.

## Managers

Tasks within CWRC-Writer are handled by specific managers.

### Annotations

[AnnotationsManager](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/annotationsManager.js)

Handles conversion of entities to annotations and vice-versa.

### Dialogs

[DialogManager](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/dialogManager.js)

Handles the initialization and display of dialogs.

### Entities

[EntitiesManager](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/entitiesManager.js)

Handles the creation and modification of [entities](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/entity.js). Stores the list of entities in the current document.

### Events

[EventManager](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/eventManager.js)

Handles the dissemination of events through the CWRC-Writer using a publication-subscribe pattern. See the [code](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/eventManager.js) for the full list of events.

### Schema

[SchemaManager](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/schema/schemaManager.js)

Handles schema loading and schema CSS processing. Stores the list of available schemas, as well as the current schema. Handles the creation of schema-appropriate entities, via the [Mapper](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/schema/mapper.js).

## Modules

Modules are self-contained components that add extra functionality to CWRC-Writer. These are added to the Base through the [Layout](#layout).

### EntitiesList

[EntitiesList](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/layout/modules/entitiesList.js)

Displays the list of entities in the current document. Allows for modifying, copying, and deleting of entities.

### ImageViewer

[ImageViewer](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/layout/modules/imageViewer.js)

Displays images linked from within the current document. Useful for OCR'd documents.

### Relations

[Relations](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/layout/modules/relations.js)

Displays the list of entity relationships (i.e. RDF triples) in the current document. Uses [triple](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/dialogs/triple.js) to add new relationships.

### Selection

[Selection](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/layout/modules/selection.js)

Displays the markup of the text that's selected in the current document.

### StructureTree

[StructureTree](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/layout/modules/structureTree.js)

Displays the markup of the current document in a tree/outline. Useful for navigating and modifying the document.

### Validation

[Validation](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/layout/modules/validation.js)

Requests and displays the results of document validation. See [validate](#validate-callback).

## Demo

A running deployment of the [CWRC-GitWriter](https://github.com/cwrc/CWRC-GitWriter), our default implementation, is available for anyone's use at:

[http://208.75.74.217](http://208.75.74.217)  

This demo may well be all that you need as it allows loading and saving to arbitrary GitHub repositories.

## Development

[CWRC-Writer-Dev-Docs](https://github.com/jchartrand/CWRC-Writer-Dev-Docs) describes general development practices for CWRC-Writer GitHub repositories, including this one.

#### Testing

The code in this repository is intended to run in the browser, and so we use [browser-run](https://github.com/juliangruber/browser-run) to run [browserified](http://browserify.org) [tape](https://github.com/substack/tape) tests directly in the browser. 

We [decorate](https://en.wikipedia.org/wiki/Decorator_pattern) [tape](https://github.com/substack/tape) with [tape-promise](https://github.com/jprichardson/tape-promise) to allow testing with promises and async methods.  

#### Mocking

We use [sinon](http://sinonjs.org)

#### Code Coverage  

We generate code coverage by instrumenting our code with [istanbul](https://github.com/gotwarlost/istanbul) before [browser-run](https://github.com/juliangruber/browser-run) runs the tests, 
then extract the coverage (which [istanbul](https://github.com/gotwarlost/istanbul) writes to the global object, i.e., the window in the browser), format it with [istanbul](https://github.com/gotwarlost/istanbul), and finally report (Travis actually does this for us) to [codecov.io](codecov.io)

#### Transpilation

We use [babelify](https://github.com/babel/babelify) and [babel-plugin-istanbul](https://github.com/istanbuljs/babel-plugin-istanbul) to compile our code, tests, and code coverage with [babel](https://github.com/babel/babel)  

#### Continuous Integration

We use [Travis](https://travis-ci.org).

Note that to allow our tests to run in Electron on Travis, the following has been added to .travis.yml:

```
addons:
  apt:
    packages:
      - xvfb
install:
  - export DISPLAY=':99.0'
  - Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
  - npm install
```

#### Release

We follow [SemVer](http://semver.org), which [Semantic Release](https://github.com/semantic-release/semantic-release) makes easy.  
Semantic Release also writes our commit messages, sets the version number, publishes to NPM, and finally generates a changelog and a release (including a git tag) on GitHub.

