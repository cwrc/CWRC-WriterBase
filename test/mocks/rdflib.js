
module.exports = {
    sym: function(docId) {
        return {};
    },
    graph: function() {
        return {};
    },
    parse: function(str, kb, base, contentType, callback) {
        callback.call(this, null, kb);
    },
    serialize: function(doc, kb, base, contentType) {
        return '<rdf:RDF></rdf:RDF>'
    }
}
