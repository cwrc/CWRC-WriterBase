var StructureTree = require('./modules/structureTree.js');
var EntitiesList = require('./modules/entitiesList.js')
var Validation = require('./modules/validation.js');
var Relations = require('./modules/relations.js');
var Selection = require('./modules/selection.js');

function addStructureTreePanel(writer, domId) {
    return new StructureTree({writer: writer, parentId: domId});
}
function addEntitiesListPanel(writer, domId) {
    return new EntitiesList({writer: writer, parentId: domId});
}
function addRelationsListPanel(writer, domId) {
    return new Relations({writer: writer, parentId: domId});
}
function addValidationPanel(writer, domId) {
    return new Validation({writer: writer, parentId: domId});
}
function addSelectionPanel(writer, domId) {
    return new Selection({writer: writer, parentId: domId});
}

module.exports = {
        addStructureTreePanel: addStructureTreePanel,
        addEntitiesListPanel:addEntitiesListPanel,
        addRelationsListPanel:addRelationsListPanel,
        addValidationPanel:addValidationPanel,
        addSelectionPanel:addSelectionPanel
};