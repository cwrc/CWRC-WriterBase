![Picture](http://www.cwrc.ca/wp-content/uploads/2010/12/CWRC_Dec-2-10_smaller.png)

[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

CWRC-Writer-Base
================

The Canadian Writing Research Collaboratory (CWRC) is developing an in-browser text markup editor (CWRC-Writer) for use by collaborative scholarly editing projects.  [Project Site](http://www.cwrc.ca/projects/infrastructure-projects/technical-projects/cwrc-writer/).  This package is the base code that builds on the TinyMCE javascript editor, meant to be packaged together, using Browserify, with a CWRC Delegator to communicate with a running instance of a CWRC Server that provides document and entity management.


## Table of Contents

1. [Overview](#overview)
1. [Setup](#setup)
1. [Configuration](#overview)
1. [Usage](#usage)
1. [Customization](#customization)
1. [Demo](#demo)
1. [Contributing](#contributing)
1. [FAQ](#faq)
1. [License](#license)


## Overview

CWRCWriter is a wysiwyg text editor for in-browser XML editing and stand-off RDF annotation.  The editor is a [JQuery](https://jquery.com) customization of the [TinyMCE](http://www.tinymce.com) editor.  CWRCWriter requires several (not provided) supporting services: 

  * document store, to list/retrieve/save/delete/update XML documents
  * annotation store, to list/retrieve/save/delete/update RDF annotations
  * XML validation service
  * authentication/authorization, as needed
  * entity management service, to lookup/add/edit entities (people,places,events)
  * XML schemas 
  * template service, to provide predefined XML templates 
  * documentation service, to provide help for various functions

The services are configured through a 'delegator' class to which the CWRCWriter makes predefined calls without any knowledge of the underlying implementation, allowing easier substitution of your own document store, etc.  If you have existing server-side services, you'll create a delegator to call out to your services.  You may alternatively create a delegator that implements some or all services in-browser.
Most of the work in setting up CWRCWriter for your project will be implementing a delegator, and the corresponding services if you don't already have them.  

![Picture](docs/images/Typical_Setup.png)

A good example to follow when creating a new CWRC-Writer project is our default implementation:

[https://github.com/jchartrand/CWRC-GitWriter]

and also look at our development docs:

[https://github.com/jchartrand/CWRC-Writer-Dev-Docs]

**[Back to top](#table-of-contents)**

## Setup

### Customize Layout

See [https://github.com/jchartrand/CWRC-GitWriter/blob/master/src/js/layout-config.js] for an example of module initialization and layout. [https://github.com/jchartrand/CWRC-GitWriter/blob/master/src/js/app.js] shows how to pass the layout config file into the CWRC-WriterBase.

### Delegate to your services

The bulk of the work in setting up the CWRCWriter is in the delegator.  The following UML diagram shows how the default CWRCWriter delegates for the CWRC project.  The methods that must be implemented for a new project are those in the 'delegator' class.

![Picture](docs/images/Delegator_UML.png)

**[Back to top](#table-of-contents)**

## Configuration

### Writer Config options

* `config.cwrcRootUrl`: String. An absolute URL that should point to the root of the CWRC-Writer directory. <b>Required</b>.
* `config.mode`: String. The mode to start the CWRC-Writer in. Can be either `xml` or `xmlrdf`.
* `config.allowOverlap`: Boolean. Should overlapping entities be allowed initially?.
* `config.project`: String. Denotes the current project. Not currently used.
* `config.schemas`: Object. A map of schema objects that can be used in the CWRC-Writer. Each entry should contain the following:
  * `name`: The schema title.
  * `url`: An url that links to the actual schema (RELAX NG) file.
  * `cssUrl`: An url that links to the CSS associated with this schema.
  * `schemaMappingsId`: The directory name associated with this schema. This is used to load appropriate mapping and dialogs files from the schema directory: https://github.com/cwrc/CWRC-Writer/tree/development/src/js/schema
* `config.cwrcDialogs`: Object. Contains various urls for use by the [CWRC-Dialogs](https://github.com/cwrc/CWRC-Dialogs). 
* `config.buttons1`, `config.buttons2`, `config.buttons3`: String. A comma separated list of plugins that will be set in the toolbars in the CWRC-Writer. Some possible values are: `addperson, addplace, adddate, addorg, addcitation, addnote, addtitle, addcorrection, addkeyword, addlink, editTag, removeTag, addtriple, viewsource, editsource, validate, savebutton, loadbutton`.

See [https://github.com/jchartrand/CWRC-GitWriter/blob/master/src/js/config.js] for an example of a configuration file. [https://github.com/jchartrand/CWRC-GitWriter/blob/master/src/js/app.js] shows how to pass the config file into the CWRC-WriterBase.


### Configuration within documents

The CWRCWriter can be configured for individual documents by including configuration information in the documents themselves:  

1.  XML/RDF mode.  The default mode isXML & RDF with no overlap.

This can be overridden by a cw:mode setting in the RDF:

```
<rdf:Description rdf:about="http://localhost:8080/editor/documents/null">
    <cw:mode>0</cw:mode>
</rdf:Description>
```

where allowable values for `cw:mode` are:

0 = XML & RDF  
1 = XML  
2 = RDF

**[Back to top](#table-of-contents)**

## Usage


**[Back to top](#table-of-contents)**




