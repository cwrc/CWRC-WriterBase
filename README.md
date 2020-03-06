# CWRC-Writer-Base

================

![Picture](https://cwrc.ca/logos/CWRC_logos_2016_versions/CWRCLogo-Horz-FullColour.png)

[![Travis](https://img.shields.io/travis/cwrc/CWRC-WriterBase.svg)](https://travis-ci.org/cwrc/CWRC-WriterBase)
[![Codecov](https://img.shields.io/codecov/c/github/cwrc/CWRC-WriterBase.svg)](https://codecov.io/gh/cwrc/CWRC-WriterBase)
[![version](https://img.shields.io/npm/v/cwrc-writer-base.svg)](http://npm.im/cwrc-writer-base)
[![downloads](https://img.shields.io/npm/dm/cwrc-writer-base.svg)](http://npm-stat.com/charts.html?package=cwrc-writer-base&from=2015-08-01)
[![GPL-2.0](https://img.shields.io/npm/l/cwrc-writer-base.svg)](http://opensource.org/licenses/GPL-2.0)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

The [Canadian Writing Research Collaboratory (CWRC)](https://cwrc.ca/) has developed an in-browser text markup editor (CWRC-Writer) for use by individual scholars and collaborative scholarly editing projects that require a light-weight online editing environment. This package is the base code that builds on the TinyMCE editor, and is meant to be bundled together with two other packages that provide document storage and entity lookup. A default version of the CWRC-Writer that uses GitHub for storage is available for anyone's use at [https://cwrc-writer.cwrc.ca/](https://cwrc-writer.cwrc.ca/).

## Table of Contents

1. [Overview](#overview)
1. [Storage and Entity Lookup](#storage-and-entity-lookup)
1. [API](#api)
1. [Managers](#managers)
1. [Modules](#modules)
1. [Development](#development)

## Overview

CWRC-Writer is a WYSIWYG text editor for in-browser XML editing and stand-off RDF annotation.  
It is built around a heavily customized version of the [TinyMCE](https://www.tiny.cloud/) editor, and includes a CWRC-hosted XML validation service.

A CWRC-Writer installation is a bundling of the main CWRC-WriterBase (the code in this repository) with  
a few other NPM packages that handle interaction with server-side services for document storage and named entity lookup.

The default implementation of the CWRC-Writer is the [CWRC-GitWriter](https://github.com/cwrc/cwrc-gitwriter). It uses
GitHub to store documents via the [cwrc-git-dialogs](https://github.com/cwrc/cwrc-git-dialogs) package. Entity lookups for [VIAF](https://viaf.org), [WikiData](https://www.wikidata.org), [DBpedia](http://wiki.dbpedia.org),
[Getty](http://vocab.getty.edu) and [GeoNames](https://www.geonames.org/) are provided via [CWRC-PublicEntityDialogs](https://github.com/cwrc/CWRC-PublicEntityDialogs) and related [lookup packages](https://github.com/cwrc?q=entity-lookup).

## Storage and Entity Lookup

If you choose not to use either the default GitHub storage or named entity lookups, then most of the
work in setting up CWRC-Writer for your project will be in implementing the dialogs to interact with your backend storage
and/or named entity lookups. We have split these pieces off into their own packages in large part to make it easier to
substitute your own dialogs and supporting services.

A good example to follow when creating a new CWRC-Writer project is our public implementation
[CWRC-GitWriter](https://github.com/cwrc/CWRC-GitWriter). You might also choose to use either the
[GitHub storage dialogs](https://github.com/cwrc/cwrc-git-dialogs) or the [named entity lookups](https://github.com/cwrc/CWRC-PublicEntityDialogs), both of which are used by the CWRC-GitWriter,
and replace just one of the two. To help understand how we've developed the CWRC-Writer, you could also
look at our [development docs](https://github.com/cwrc/CWRC-Writer-Dev-Docs).

To replace either of the storage and entity dialogs, you'll need to create modules with the following APIs:

### Storage Object API

To see the methods that need to be provided by your own storage implementation, you can view the [cwrc-git-dialogs API](https://github.com/cwrc/cwrc-git-dialogs#methods-used-by-cwrc-writerbase).

Note that because the `load(writer)` and `save(writer)` methods are passed an instance of the CWRC-WriterBase, all of the methods defined below in the [API](#writer-object) are available, in order to allow getting and setting of XML in the editor.

#### Entity Lookup API

You have at least two choices here:

1. You can entirely implement your own dialog for entity lookup, following the model in
   [CWRC-PublicEntityDialogs](https://github.com/cwrc/CWRC-PublicEntityDialogs)

2. You can use [CWRC-PublicEntityDialogs](https://github.com/cwrc/CWRC-PublicEntityDialogs) and configure it with different
   sources. We provide five sources: VIAF, Wikidata, Getty, DBpedia, and GeoNames.

You can use any of these sources, and supplement them with your own sources. [CWRC-PublicEntityDialogs](https://github.com/cwrc/CWRC-PublicEntityDialogs) fully explains how to add your own sources.

## API

### Constructor

The CWRC-WriterBase exports a single constructor function that takes one argument, a configuration object.

See [CWRC-GitWriter/src/js/config.js](https://github.com/cwrc/CWRC-GitWriter/blob/master/src/js/config.js) for an example of a base configuration file, and  
[CWRC-GitWriter/src/js/app.js](https://github.com/cwrc/CWRC-GitWriter/blob/master/src/js/app.js) to see the configuration file loaded, extended, and passed into the constructor.

### Configuration Object

Options that can be set on the configuration object:

#### Required Options

- `config.container`: String. The ID of the element that should contain the CWRC-Writer.
- `config.storageDialogs`: Object. Storage dialogs, see [cwrc-git-dialogs](https://github.com/cwrc/cwrc-git-dialogs) for example and API definition.
- `config.entityLookupDialogs`: Object. Entity lookup, see [cwrc-public-entity-dialogs](https://github.com/cwrc/CWRC-PublicEntityDialogs) for example and API definition.

##### Other Options

- `config.cwrcRootUrl`: String. An absolute URL that should point to the root of the CWRC-Writer directory. If blank, the browser URL will be used.
- `config.modules`: Object. The internal CWRC-WriterBase [modules](#modules) to load, grouped by their locations relative to the CWRC-Writer. A module ID must be provided. An optional display title can be specified. Certain modules require additional configuration.

  For example:

  ```js
  config.modules = {
    west: [
      {id: 'structure', title: 'Markup'},
      {id: 'entities'}
    ],
    east: [
      {id: 'selection'}
    ],
    south: [
      {id: 'validation', config: {'validationUrl': 'https://validator.services.cwrc.ca/validator/validate.html'}}
    ]
  }
  ```

- `config.annotator`: Boolean. If true, the user may only add annotations to the document.
- `config.readonly`: Boolean. If true, the user may not edit nor annotate the document.
- `config.mode`: String. The mode in which to start the CWRC-Writer: `xml` or `xmlrdf`.
- `config.allowOverlap`: Boolean. Should overlapping entities be allowed initially?
- `config.schemas`: Object. A map of schema objects that can be used in the CWRC-Writer. Each entry should contain the following:
  - `name`: String. The schema title.
  - `url`: String. An URL that links to the schema (RELAX NG) file.
  - `cssUrl`: String. An URL that links to the CSS associated with this schema.
  - `schemaMappingsId`: String. The directory name in the [schema directory](src/js/schema) from which to load mapping and dialogs files for the schema.
  - `altUrl`: String. Optional. An alternative URL that links to the schema file. This can be used in the rare case that you want to match against a particular schema URL, but load the schema from another location (e.g. to avoid CORS errors).
- `config.buttons1`, `config.buttons2`, `config.buttons3`: String. A comma separated list of buttons to display in the CWRC-Writer toolbars. Possible values: `schematags, addperson, addplace, adddate, addorg, addcitation, addnote, addtitle, addcorrection, addkeyword, addlink, editTag, removeTag, addtriple, toggletags, viewmarkup, editsource, validate, savebutton, loadbutton, logoutbutton, fullscreen`.

### Writer object

The object returned by the constructor is defined here: [writer.js](src/js/writer.js). The typical properties and methods you'd want to use when implementing your own storage and/or entity dialogs are:

#### Properties

##### isInitialized

boolean  
 _Has the editor been initialized._

##### isDocLoaded

boolean  
 _Is there a document loaded in the editor._

##### isReadOnly

boolean  
 _Is the editor in `readonly` mode._

##### isAnnotator

boolean  
_Is the editor in annotate (entities) only mode._

#### Methods

##### loadDocumentURL(docUrl)

_Loads an XML document from a URL into the editor._

##### loadDocumentXML(docXml)

_Loads an XML document (either a [XML Document](https://developer.mozilla.org/en-US/docs/Web/API/XMLDocument) or a stringified version of such) into the editor._

##### setDocument(docUrl|docXml)

_A convenience method which calls either `loadDocumentURL` or `loadDocumentXML` based on the parameter provided._

##### getDocument(asString)

_Returns the parsed XML document from the editor. If `asString` is true, then a stringified version of the document is returned._

##### getDocRawContent()

_Returns the raw, un-parsed HTML content from the editor._

##### showLoadDialog()

_Convenience method to call the `load` method of the object set in the `storageDialogs` property of the config object passed to the writer._

##### showSaveDialog()

_Convenience method to call the `save` method of the object set in the `storageDialogs` property of the config object passed to the writer._

##### validate(callback)

_Validates the current document_

callback(w, valid): function where w is the writer and valid is true/false.
Fires a `documentValidated` event if validation is successful.

## Managers

Tasks within CWRC-Writer are handled by specific managers.

### [AnnotationsManager](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/entities/annotationsManager.js)

Handles conversion of entities to annotations and vice-versa.

### [SchemaManager](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/schema/schemaManager.js)

Handles schema loading and schema CSS processing. Stores the list of available schemas, as well as the current schema. Handles the creation of schema-appropriate entities, via the [Mapper](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/schema/mapper.js).

### [EntitiesManager](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/entities/entitiesManager.js)

Handles the creation and modification of [entities](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/entities/entity.js). Stores the list of entities in the current document.

### [EventManager](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/eventManager.js)

Handles the dissemination of events through the CWRC-Writer using a publication-subscribe pattern. See the [code](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/eventManager.js) for the full list of events.

### [LayoutManager](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/layout/layoutManager.js)

Handles the initialization and display of the modules specified in the `modules` property of the config object. Also handles browser resizing and fullscreen functionality.

### [DialogManager](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/dialogManager.js)

Handles the initialization and display of dialogs.

## Modules

Modules are self-contained components that add extra functionality to CWRC-Writer. These can be specified in the configuration object using the proper module ID.

### [StructureTree](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/layout/modules/structureTree/structureTree.js)

Module ID: `structure`

Displays the markup of the current document in a tree format. Useful for navigating and modifying the document.

### [EntitiesList](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/layout/modules/entitiesList/entitiesList.js)

Module ID: `entities`

Displays the list of entities in the current document. Allows for modifying, copying, scraping, and deleting of entities.

### [Selection](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/layout/modules/selection/selection.js)

Module ID: `selection`

Displays the markup of the text that's selected in the current document.

### [Validation](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/layout/modules/validation/validation.js)

Module ID: `validation`

Configuration:

- `validationUrl`: The URL for the validation service endpoint. The CWRC-hosted service is at [https://validator.services.cwrc.ca/validator/validate.html)](https://validator.services.cwrc.ca/validator/validate.html).

Requests and displays the results of document validation. See [validate](#validate-callback).

### [NERVE](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/layout/modules/nerve/nerve.js)

Module ID: `nerve`

Configuration:

- `nerveUrl`: The URL for the NERVE service endpoint. The CWRC-hosted service is at [https://nerve.services.cwrc.ca/ner](https://nerve.services.cwrc.ca/ner).

Sends the document for named entity recognition and adds the results as entities to the document.

### [ImageViewer](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/layout/modules/imageViewer/imageViewer.js)

Module ID: `imageViewer`

Displays images linked from within the current document. Useful for OCR'd documents.

### [Relations](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/layout/modules/relations/relations.js)

Module ID: `relations`

Displays the list of entity relationships (i.e. RDF triples) in the current document. Uses [triple](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/dialogs/triple.js) to add new relationships.

## Development

[CWRC-Writer-Dev-Docs](https://github.com/cwrc/CWRC-Writer-Dev-Docs) explains how to work with CWRC-Writer GitHub repositories, including this one.
