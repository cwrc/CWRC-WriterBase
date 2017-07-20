![Picture](http://cwrc.ca/logos/CWRC_logos_2016_versions/CWRCLogo-Horz-FullColour.png)

[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

CWRC-Writer-Base
================

The [Canadian Writing Research Collaboratory (CWRC)](http://www.cwrc.ca/projects/infrastructure-projects/technical-projects/cwrc-writer/) is developing an in-browser text markup editor (CWRC-Writer) for use by collaborative scholarly editing projects.  This package is the base code that builds on the TinyMCE javascript editor, and is meant to be packaged together (using Browserify) with two other packages that communicate with a server that provides document storage and entity (people, places) lookup.  A default version of the CWRC-Writer that uses GitHub for storage and VIAF for entity lookup is available for anyone's use:  

[http://208.75.74.217](http://208.75.74.217)  

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

The default implementation of the CWRC-Writer is the [CWRC-GitWriter](https://github.com/cwrc/cwrc-gitwriter) which uses GitHub to store documents, and uses [VIAF](https://viaf.org) for named entity (people, places) lookup.  The dialogs to interact with GitHub and VIAF are in the NPM packages [cwrc-git-dialogs](https://github.com/cwrc/cwrc-git-dialogs) and [cwrc-public-entity-dialogs](https://github.com/cwrc/cwrc-public-entity-dialogs). The CWRC-GitWriter therefore bundles (using browserify) those two NPM packages with the CWRC-WriterBase package. You may substitute your own packages with dialogs that interact with your own backend storage and/or entity lookup.

The CWRCWriterBase itself also provides built in interaction with default server-side services for:

* XML Validation
* XML Schemas
* documentation and help

CWRC provides a default XML validation HTTP end point that the CWRC-WriterBase is preconfigured to use.  You may substitute your own, but the CWRC-WriterBase expects validation and error messages in a specific format.  Similarly you can substitute your own documentation and help files.

## Storage and entity lookup

If you choose not to use either the default CWRC GitHub storage or VIAF named entity lookup then most of the work in setting up CWRCWriter for your project will be implementing the dialogs to interact with your backend storage or named entity lookup. We have split these pieces off into their own packages in large part to make it easier to substitue your own dialogs for one or both.  

A good example to follow when creating a new CWRC-Writer project is our default implementation [CWRC-GitWriter](https://github.com/cwrc/CWRC-GitWriter).  You might also choose to use either the CWRC GitHub storage dialogs or the CWRC public entity lookup, both of which are used by the CWRC-GitWriter, and replace just one of the two.  To help understand how we've developed the CWRC-Writer, you could also look at our [development docs](https://github.com/cwrc/CWRC-Writer-Dev-Docs]).

To replace one or the other, or both, of the storage and entity dialogs, you'll need to create objects with the following APIs:

#### Storage object API

load(writer)

save(writer)

where 'writer' is the writer object (i.e., the object defined in the [API](#writer-object) section.

The storage object for GitHub is implemented here:  [cwrc-git-dialogs](https://github.com/cwrc/cwrc-git-dialogs)

Each method spawns a diaglog (bootstrap in our case) that prompts the user to load or save.  Because load(writer) and save(writer) are passed an instance of the CWRC writer object, all of the methods defined below in [API](#writer-object) are available, to allow get and set of the XML in the writer.

We also define an authenticate method on our cwrc-git-dialogs object to handle the Oauth authentication of GitHub.  You may implement your authentication however you like.  If you want to follow our approach you can see it here: [https://github.com/cwrc/CWRC-GitWriter/blob/master/src/js/app.js] where we authenticate before instantiating the CWRC-WriterBase.  

#### Entity Lookup API

Defined and implemented here:  [https://github.com/cwrc/CWRC-PublicEntityDialogs]

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
* `config.layout`: Object.  Layout object as described above [Layout](#layout), see [layout-cofing.js]([https://github.com/cwrc/CWRC-GitWriter/blob/master/src/js/layout-config.js]) for example.
* `config.entityLookupDialogs`: Object. Entity lookup, see [cwrc-public-entity-dialogs](https://github.com/cwrc/CWRC-PublicEntityDialogs) for example and API definition.

##### Other Options

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

### Events

The full list of events used by the CWRC-Writer is defined in [eventManager.js](https://github.com/cwrc/CWRC-WriterBase/blob/master/src/js/eventManager.js).  

## Demo

A running deployment of the [CWRC-GitWriter](https://github.com/cwrc/CWRC-GitWriter), our default implementation, is available for anyone's use at:

[http://208.75.74.217](http://208.75.74.217)  

This demo may well be all that you need as it allows loading and saving to arbitrary GitHub repositories.


