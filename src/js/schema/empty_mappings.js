var $ = require('jquery');
var Mapper = require('./mapper.js');

module.exports = {

// The namespace for documents using this schema
namespace: '',
// The name of the ID attribute
id: '',
// The XPath selector for the parent of the RDF data, e.g. /TEI/teiHeader/fileDesc/following-sibling::xenoData
// Currently there's only support for single separators (/ not //), and an axis on the last element
rdfParentSelector: '',
// The name(s) of the root tag(s)
root: [],
// The name of the header tag
header: '',
// Additional block level elements that should be added to TinyMCE
blockElements: [],
// Attributes that should be treated as URLs by the various CWRC-Writer modules
urlAttributes: [],
// Attributes that should be shown in a popup in the editor
popupAttributes: [],

listeners: {
    // Listeners to CWRC-Writer events can go here and will subscribe upon mappings load
    // e.g. tagAdded: function() {}
},

/**
 * The entries for each entity. Each entity entry needs the following members:
 * parentTag {String|Array}: the XML tag(s) that encapsulates the entity, also used to determine if an XML tag is associated with an entity
 * annotation {Function}: a function which accepts the AnnotationsManager, an Entity, and a format string (either 'xml' or 'json'). It should return an annotation in the specified format (see AnnotationsManager.commonAnnotation)
 * 
 * Optional members:
 * mappingFunction {Function}: a function which accepts an Entity and returns an array of start and end XML strings to display in the Writer (see Mapper.getDefaultMapping)
 * mapping {Object}: a map of Entity config properties to XPaths
 * isNote {Boolean}: boolean indicating the entity is a "note type" (default is false)
 * textTag {String|Array}: used to specify the tag that contains the text content of the entity, mainly used by notes but also by more complex entity mappings
 * xpathSelector {String}: if the entity can have several different parentTags or if several entities share the same parentTag, this selector can help differentiate
 * requiresSelection {Boolean}: boolean indicating is a text selection is required to add the entity (as opposed to a point in the text) (default is true)
 * requiredAttributes {Object}: a map of attribute names and values that will be added to every instance of this entity type
 */

entities: {

rs: {
    parentTag: '',
    mappingFunction: function(entity) {
    },
    mapping: {},
    annotation: function(entity, format) {
    }
},
    
person: {
    parentTag: '',
    mappingFunction: function(entity) {
    },
    mapping: {},
    annotation: function(entity, format) {
    }
},

org: {
    parentTag: '',
    mappingFunction: function(entity) {
    },
    mapping: {},
    annotation: function(entity, format) {
    }
},

place: {
    parentTag: '',
    mappingFunction: function(entity) {
    },
    mapping: {},
    annotation: function(entity, format) {
    }
},

title: {
    parentTag: '',
    mappingFunction: function(entity) {
    },
    mapping: {},
    annotation: function(entity, format) {
    }
},

correction: {
    parentTag: '',
    mappingFunction: function(entity) {
    },
    mapping: {},
    annotation: function(entity, format) {
    }
},

link: {
    parentTag: '',
    mappingFunction: function(entity) {
    },
    mapping: {},
    annotation: function(entity, format) {
    }
},

date: {
    parentTag: '',
    mappingFunction: function(entity) {
    },
    mapping: {},
    annotation: function(entity, format) {
    }
},

note: {
    parentTag: '',
    textTag: '',
    isNote: true,
    mappingFunction: function(entity) {
    },
    mapping: {},
    annotation: function(entity, format) {
    }
},

citation: {
    parentTag: '',
    textTag: '',
    mappingFunction: function(entity) {
    },
    mapping: {},
    annotation: function(entity, format) {
    }
},

keyword: {
    parentTag: '',
    textTag: '',
    mappingFunction: function(entity) {
    },
    mapping: {},
    annotation: function(entity, format) {
    }
}

}

};