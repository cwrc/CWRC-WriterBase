![Picture](http://www.cwrc.ca/wp-content/uploads/2010/12/CWRC_Dec-2-10_smaller.png)

[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

CWRC-Writer-Base
================

The [Canadian Writing Research Collaboratory (CWRC)](http://www.cwrc.ca/projects/infrastructure-projects/technical-projects/cwrc-writer/) is developing an in-browser text markup editor (CWRC-Writer) for use by collaborative scholarly editing projects.  This package is the base code that builds on the TinyMCE javascript editor, and is meant to be packaged together, using Browserify, with a few other packages that communicate with a server that provides document storage and entity (people, places) lookup.

## Table of Contents

1. [Overview](#overview)
1. [Storage and entity lookup](#storage-and-entity-lookup)
1. [Layout](#layout)
1. [Configuration](#overview)
1. [API](#api)
1. [Demo](#demo)

## Overview

CWRCWriter is a WYSIWYG text editor for in-browser XML editing and stand-off RDF annotation.  The editor is a customization of the [TinyMCE](http://www.tinymce.com) editor.

A 'CWRCWriter' installation is a bundling of the main CWRC-WriterBase (the code in this repository) with two other NPM packages that handle interaction (dialogs for user input, and calls to the server) with server-side services for:

* document storage
* named entity lookup (and optionally /add/edit)

The default implementation of the CWRC-Writer is the [CWRC-GitWriter](https://github.com/jchartrand/cwrc-gitwriter) which uses GitHub to store documents, and uses [VIAF](https://viaf.org) for named entity (people, places) lookup.  The code with dialogs to interact with GitHub and VIAF is in two NPM packages: [cwrc-git-dialogs](https://github.com/jchartrand/cwrc-git-dialogs) and [cwrc-public-entity-dialogs](https://github.com/jchartrand/cwrc-public-entity-dialogs). You may substitute your own packages with dialogs that interact with your own backend storage and/or entity lookup.

The CWRCWriterBase itself also provides built in interaction with default server-side services for:

* XML Validation
* XML Schemas
* documentation and help

CWRC provides a default XML validation HTTP end point that the CWRC-WriterBase is preconfigured to use.  You may substitute your own, but the CWRC-WriterBase expects validation and error messages in a specific format.  Similarly you can substitute your own documentation and help files.

## Storage and entity lookup

If you choose not to use the default CWRC GitHub storage and VIAF named entity lookup then most of the work in setting up CWRCWriter for your project will be implementing the dialogs to interact with your backend storage and named entity lookup (which is a significant part of the reason why we split these pieces off into their own packages.)  

A good example to follow when creating a new CWRC-Writer project is our default implementation:

[CWRC-GitWriter](https://github.com/jchartrand/CWRC-GitWriter)

and also look at our [development docs](https://github.com/jchartrand/CWRC-Writer-Dev-Docs])


## Layout 

See [https://github.com/jchartrand/CWRC-GitWriter/blob/master/src/js/layout-config.js] for an example of module initialization and layout. [https://github.com/jchartrand/CWRC-GitWriter/blob/master/src/js/app.js] shows how to pass the layout config file into the CWRC-WriterBase.  The following API section talks more about configuration.


## API

### Constructor

The CWRC-WriterBase exports a single constructor function that takes one argument, a configuration object.  An example showing invocation of the constructor is available [here](https://github.com/jchartrand/CWRC-GitWriter/blob/master/src/js/app.js).   

See [https://github.com/jchartrand/CWRC-GitWriter/blob/master/src/js/config.js] for an example of a configuration file. [https://github.com/jchartrand/CWRC-GitWriter/blob/master/src/js/app.js] shows how to pass the config file into the CWRC-WriterBase, and what to set on the configuration object.

### Configuration Object

Options that can be set on the configuration object:

##### Required Options

* `config.cwrcRootUrl`: String. An absolute URL that should point to the root of the CWRC-Writer directory. <b>Required</b>.
* `config.storageDialogs`: Object.  Object. Storage dialogs, see [cwrc-gi-dialogs](https://github.com/jchartrand/cwrc-git-dialogs) for example and API definition.
* `config.layout`: Object.  Layout object as described above [Layout](#layout), see [layout-cofing.js]([https://github.com/jchartrand/CWRC-GitWriter/blob/master/src/js/layout-config.js]) for example.
* `config.entityLookupDialogs`: Object. Entity lookup, see [cwrc-public-entity-dialogs](https://github.com/jchartrand/CWRC-PublicEntityDialogs) for example and API definition.

##### Optional Options (haha)

* `config.mode`: String. The mode in which to start the CWRC-Writer.  `xml` or `xmlrdf`.
* `config.allowOverlap`: Boolean. Should overlapping entities be allowed initially?.
* `config.schemas`: Object. A map of schema objects that can be used in the CWRC-Writer. Each entry should contain the following:
  * `name`: String. The schema title.
  * `url`: String. A url that links to the schema (RELAX NG) file.
  * `cssUrl`: String. A url that links to the CSS associated with this schema.
  * `schemaMappingsId`: String. The directory name in the schema directory: https://github.com/cwrc/CWRC-Writer/tree/development/src/js/schema from which to load mapping and dialogs files for the schema.
* `config.cwrcDialogs`: Object. Lists urls for use by the [CWRC-Dialogs](https://github.com/cwrc/CWRC-Dialogs). 
* `config.buttons1`, `config.buttons2`, `config.buttons3`: String. A comma separated list of plugins to set in the CWRC-Writer toolbars. Possible values: `addperson, addplace, adddate, addorg, addcitation, addnote, addtitle, addcorrection, addkeyword, addlink, editTag, removeTag, addtriple, viewsource, editsource, validate, savebutton, loadbutton`.

#### Configuration within documents

Configuration information can be included in the documents themselves, to override project settings:

`XML/RDF mode`  

You can set the mode for the given document with a cw:mode setting in the RDF:

```
<rdf:Description rdf:about="http://localhost:8080/editor/documents/null">
    <cw:mode>0</cw:mode>
</rdf:Description>
```

where allowable values for `cw:mode` are:

0 = XML & RDF  (default - XML & RDF with no overlap)  
1 = XML  
2 = RDF

### Writer object

The object returned from instantiation has properties and methods as follows.

##### Properties

 `isInitialized`  (<sub><sup>boolean</sup></sub>)   
 *Has the editor been initialized.* 

`isReadOnly` (boolean)   
 *Is the editor in readonly mode.*  
  
`isAnnotator`
###### boolean
*Is the editor in annotate (entities) only mode.*

##### Methods



## Demo

A running deployment of the [CWRC-GitWriter](https://github.com/jchartrand/CWRC-GitWriter) is available for anyone's use at:

[http://208.75.74.217](http://208.75.74.217)  




