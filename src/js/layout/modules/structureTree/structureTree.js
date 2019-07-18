'use strict';

var $ = require('jquery');
require('jstree');

/**
 * @class StructureTree
 * @fires Writer#structureTreeInitialized
 * @param {Object} config
 * @param {Writer} config.writer
 * @param {String} config.parentId
 */
function StructureTree(config) {
    var w = config.writer;
    
    var id = w.getUniqueId('tree_');
    
    /**
     * @lends StructureTree.prototype
     */
    var tree = {
        currentlySelectedNodes: [], // ids of the currently selected nodes
        selectionType: null, // is the node or the just the contents of the node selected?
        NODE_SELECTED: 0,
        CONTENTS_SELECTED: 1,
        tagFilter: ['head','heading'] // array of tag names to filter tree by
    };
    
    // 2 uses, 1) we want to highlight a node in the tree without selecting it's counterpart in the editor
    // 2) a tree node has been clicked and we want to avoid re-running the selectNode function triggered by the editor's onNodeChange handler
    var ignoreSelect = false;
    
    var $tree; // tree reference
    var initialized = false; // has $tree been initialized
    var updatePending = false;

    var enabled = true; // enabled means we update based on events
    
    /**
     * Updates the tree to reflect the document structure.
     */
    tree.update = function() {
        if (initialized && enabled) {
            var treeRef = $.jstree.reference('#'+id);
            // store open nodes to re-open after updating
            var openNodes = [];
            $('#cwrc_tree_root', $tree).find('li.jstree-open').each(function () {
                var id = $(this).attr('name');
                openNodes.push(id);
            });
            
            tree.clear();
            
            var rootNode = $('[_tag="'+w.schemaManager.getRoot()+'"]', w.editor.getBody());
            if (rootNode.length === 0) {
                // fallback if schema/root has changed
                rootNode = $('[_tag]', w.editor.getBody()).first();
            }
            var rootData = _processNode(rootNode, 0);
            if (rootData != null) {
                rootData.li_attr.id = 'cwrc_tree_root';
                _doUpdate(rootNode.children(), rootData, 0, rootData);
                treeRef.create_node(null, rootData);
    //            treeRef._themeroller();
                _onNodeLoad($('#cwrc_tree_root', $tree).first());
                
                $.each(openNodes, function (i, val) {
                    treeRef.open_node($('li[name='+val+']', $tree), null, false); 
                });
            }
        } else {
            updatePending = true;
        }
    };
    
    tree.clear = function() {
        var treeRef = $.jstree.reference('#'+id);
        treeRef.delete_node('#cwrc_tree_root');
    };

    tree.enable = function(forceUpdate) {
        enabled = true;
        if (forceUpdate || updatePending) {
            tree.update();
            updatePending = false;
        }
    }
    tree.disable = function() {
        enabled = false;
    }
    
    tree.destroy = function() {
        $(document).off('dnd_start.vakata', handleDnDStart);
        $(document).off('dnd_move.vakata', handleDnDMove);
        
        $.jstree.reference('#'+id).destroy();
    };
    
    /**
     * Expands the parents of a particular node
     * @param {element} node A node that exists in the editor
     */
    function _expandParentsForNode(node) {
        // get the actual parent nodes in the editor
        var parents = [];
        $(node).parentsUntil('#tinymce').each(function(index, el) {
            parents.push(el.id);
        });
        parents.reverse();
        
        // TODO handling for readonly mode where only headings are in the tree
        
        // expand the corresponding nodes in the tree
        for (var i = 0; i < parents.length; i++) {
            var parentId = parents[i];
            var parentNode = $('[name="'+parentId+'"]', $tree);
            var isOpen = $tree.jstree('is_open', parentNode);
            if (!isOpen) {
                $tree.jstree('open_node', parentNode, null, false);
            }
        }
    }
    
    /**
     * Displays (if collapsed) and highlights a node in the tree based on a node in the editor
     * @param {element} node A node that exists in the editor
     */
    tree.highlightNode = function(node) {
        if (node) {
            var id = node.id;
            if (id) { // TODO handling of entity name attribute
                if (tree.currentlySelectedNodes.indexOf(id) === -1) {
                    ignoreSelect = true;
                    var treeNode = $('[name="'+id+'"]', $tree);
                    if (treeNode.length === 0) {
                        _expandParentsForNode(node);
                        treeNode = $('[name="'+id+'"]', $tree);
                    }
                    $tree.jstree('deselect_all');
                    _onNodeDeselect(); // manually trigger deselect behaviour, primarily to clear currentlySelectedNodes
                    var result = $tree.jstree('select_node', treeNode);
                    //if (result === false || result.attr('id') == 'tree') {
                        ignoreSelect = false;
                    //}
    
                    _scrollIntoView(treeNode);
                } else {
                    // if highlighting already highlighted node
                    // the user has probably clicked inside a selected tag so we should clear all selections
                    _onNodeDeselect();
                }
            }
        } else {
            _onNodeDeselect();
        }
    };
    
    function _scrollIntoView($node) {
        if ($node.length === 1) {
            var o = $node.offset().top - $tree.offset().top;
            var t = o + $tree.scrollTop();
            var b = t + $node.outerHeight();
            var ch = $tree.innerHeight();
            var halfCH = ch*0.5;
            var ct = parseInt($tree.scrollTop(), 10);
            var cb = ct + ch;
            
            if ($node.outerHeight() > ch || t < ct) {
                // scroll up
                $tree.scrollTop(t - halfCH);
            } else if (b > cb) {
                // scroll down
                $tree.scrollTop(b - halfCH);
            }
        }
    }
    
    /**
     * Selects a node in the tree based on a node in the editor
     * @param {String} id The id of the node
     * @param {Boolean} selectContents True to select contents
     */
    tree.selectNode = function(id, selectContents) {
        if (id) {
            var treeNode = $('[name="'+id+'"]', $tree);
            if (treeNode.length === 0) {
                _expandParentsForNode($('#'+id, w.editor.getBody()));
                treeNode = $('[name="'+id+'"]', $tree);
            }
            
            selectNode(treeNode, selectContents, false, true);
        }
    };
    
    /**
     * Performs actual selection of a tree node
     * @param {Element} $node A jquery node (LI) in the tree
     * @param {Boolean} selectContents True to select contents
     * @param {Boolean} multiselect True if ctrl or select was held when selecting
     * @param {Boolean} external True if selectNode came from outside structureTree, i.e. tree.selectNode
     */
    function selectNode($node, selectContents, multiselect, external) {
        var id = $node.attr('name');
        
        _removeCustomClasses();
        
        // clear other selections if not multiselect
        if (!multiselect) {
            if (tree.currentlySelectedNodes.indexOf(id) !== -1) {
                tree.currentlySelectedNodes = [id];
            } else {
                tree.currentlySelectedNodes = [];
            }
        }
        
        if (id) {
            var aChildren = $node.children('a');
            
            if (tree.currentlySelectedNodes.indexOf(id) !== -1 && !external) {
                // already selected node, do nothing
            } else {
                tree.currentlySelectedNodes.push(id);
            }
            
            if (selectContents) {
                aChildren.addClass('contentsSelected').removeClass('nodeSelected');
                tree.selectionType = tree.CONTENTS_SELECTED;
            } else {
                aChildren.addClass('nodeSelected').removeClass('contentsSelected');
                tree.selectionType = tree.NODE_SELECTED;
            }

            if (!external) {
                var $editorNode = $('#'+id, w.editor.getBody());
                var isEntity = $editorNode.attr('_entity') === 'true';
                if (!isEntity && $editorNode.attr('_tag') === w.schemaManager.getHeader()) {
                    w.dialogManager.show('header');
                } else {
                    ignoreSelect = true; // set to true so tree.highlightNode code isn't run by editor's onNodeChange handler
                    w.utilities.selectElementById(tree.currentlySelectedNodes, selectContents);
                }
            }
        }
    }
    
    /**
     * Processes an element in the editor and returns relevant data for the tree
     * @param node A jQuery object
     * @param level The current tree depth
     */
    function _processNode(node, level) {
        var nodeData = null;
        
        var tag = node.attr('_tag');
        if (tag == null) {
            return null;
        }

        // entity tag
        if (w.isReadOnly === false && node.attr('_entity')) {
            var id = node.attr('name');
            if (id === undefined) {
                console.warn('structureTree: no id for',tag);
                return null;
            }
            
            nodeData = {
                text: tag,
                li_attr: {name: id}, // 'class': type}
                state: {opened: level < 3},
                level: level
            };
        // structure tag
        } else {
            if (w.isReadOnly === false || (w.isReadOnly && (tag === w.schemaManager.getRoot() || tree.tagFilter.indexOf(tag.toLowerCase()) !== -1))) {
                var id = node.attr('id');
                if (id === undefined) {
                    console.warn('structureTree: no id for',tag);
                    return null;
                }

                if (w.isReadOnly) {
                    if (tag !== w.schemaManager.getRoot()) {
                        tag = w.utilities.getTitleFromContent(node.text());
                    }
                }
                nodeData = {
                    text: tag,
                    li_attr: {name: id},
                    state: {opened: level < 3},
                    level: level
                };
            }
        }
        
        if (w.schemaManager.schemaId === 'cwrcEntry') {
            // FIXME we really shouldn't have this hardcoded here
            // manually set the level for CWRC schema to have proper sorting in readOnly mode
            var subtype = node.attr('subtype');
            if (subtype !== undefined) {
                nodeData.level = parseInt(subtype);
            }
        }
        
        return nodeData;
    }
    
    /**
     * Recursively work through all elements in the editor and create the data for the tree.
     */
    function _doUpdate(children, nodeParent, level, lastEntry) {
        children.each(function(index, el) {
            var node = $(this);
            var newNodeParent = nodeParent;
            
            var nodeData = _processNode(node, level);
            if (nodeData) {
                if (w.isReadOnly && lastEntry != null) {
                    while (lastEntry.level >= nodeData.level) {
                        lastEntry = lastEntry.parent;
                    }
                    if (lastEntry.children == null) {
                        lastEntry.children = [];
                    }
                    nodeData.parent = lastEntry;
                    lastEntry.children.push(nodeData);
                } else {
                    if (nodeParent.children == null) {
                        nodeParent.children = [];
                    }
                    nodeParent.children.push(nodeData);
                    newNodeParent = nodeParent.children[nodeParent.children.length-1];
                }
                lastEntry = nodeData;
            }
            
            if (node.attr('_tag') != w.schemaManager.getHeader()) {
                _doUpdate(node.children(), newNodeParent, level+1, lastEntry);
            }
        });
    }
    
    function _onNodeLoad(context) {
        $('li', context).each(function(index, el) {
            var li = $(this);
            var indent = (li.parents('ul').length - 1) * 16;
            li.prepend("<span class='jstree-indent' style='width: "+indent+"px;'/>");
        });
    }
    
    function _doConditionalSelect($tree, node, event) {
        if ((tinymce.isMac ? event.metaKey : event.ctrlKey) || event.shiftKey) {
            // only allow multiselect for siblings
            var selected = $tree.jstree('get_selected');
            if (selected.length == 0) {
                return true;
            } else {
                var liId = selected[0];
                if (liId == node.id) {
                    return true;
                }
                var isSibling = $('#'+liId).siblings('#'+node.id).length == 1;
                return isSibling;
            }
        }
        return true;
    }
    
    function _onNodeSelect(event, data) {
        if (!ignoreSelect) {
            var $target = $(data.event.currentTarget);
            
            var selectContents;
            if ($target.hasClass('contentsSelected')) {
                selectContents = false;
            } else if ($target.hasClass('nodeSelected')) {
                selectContents = true;
            } else {
                selectContents = true;
            }
            
            var multiselect = (tinymce.isMac ? data.event.metaKey : data.event.ctrlKey) || data.event.shiftKey;
            
            selectNode($target.parent(), selectContents, multiselect, false) 
        }
    }
    
    function _onNodeDeselect(event, data) {
        if (data !== undefined) {
            var $target = $(data.event.currentTarget);
            $target.removeClass('nodeSelected contentsSelected');
            var id = data.node.li_attr.name;
            var index = tree.currentlySelectedNodes.indexOf(id);
            if (index !== -1) {
                tree.currentlySelectedNodes.splice(index, 1);
            }
        } else {
            // clear everything
            _removeCustomClasses();
            tree.currentlySelectedNodes = [];
        }
        tree.selectionType = null;
    }
    
    function _onDragDrop(data, isCopy) {
        var dragNode = data.node;
        var dropNode = $tree.jstree('get_node', data.parent);
        
        var dragNodeEditor = $('#'+dragNode.li_attr.name, w.editor.getBody());
        var dropNodeEditor = $('#'+dropNode.li_attr.name, w.editor.getBody());
        
        if (dragNodeEditor.parents('.noteWrapper').length > 0) {
            dragNodeEditor = dragNodeEditor.parents('.noteWrapper').first();
        }

        if (isCopy) {
            dragNodeEditor = dragNodeEditor.clone();
        }
        
        if (data.position === 0) {
            dropNodeEditor.prepend(dragNodeEditor);
        } else {
            var prevSiblingId = dropNode.children[data.position - 1];
            var prevSibling = $tree.jstree('get_node', prevSiblingId);
            dropNodeEditor = $('#'+prevSibling.li_attr.name, w.editor.getBody());
            dropNodeEditor.after(dragNodeEditor);
        }

        $tree.jstree('open_node', dropNode, null, false);
        
        if (isCopy) {
            w.tagger.processNewContent(dragNodeEditor[0]);
        }

        w.editor.undoManager.add();
        w.event('contentChanged').publish();
    }
    
    function _removeCustomClasses() {
        var nodes = $('a[class*=Selected]', '#'+id);
        nodes.removeClass('nodeSelected contentsSelected');
    }
    
    function _showPopup(content) {
        $('#tree_popup').html(content).show();
    }
    
    function _hidePopup() {
        $('#tree_popup').hide();
    }
    
    $('#'+config.parentId).append('<div class="moduleParent">'+
        '<div id="'+id+'" class="moduleContent"></div>'+
    '</div>');
    
    $tree = $('#'+id);
    
    // w.utilities.addCSS('css/jstree/style.css');
    
    var plugins = ['wholerow','conditionalselect'];
    if (w.isReadOnly !== true) {
        plugins.push('dnd');
    }
    
    $tree.jstree({
        plugins: plugins,
        core: {
            worker: false, // transpiler messing up web worker so set this false, see: https://github.com/vakata/jstree/issues/1717
            check_callback: true, // enable tree modifications
            animation: false,
            themes: {
                icons: false,
                url: false,
                responsive: false
            },
            data: {
                text: 'Tags',
                li_attr: {id: 'cwrc_tree_root'},
                state: {opened: true}
            }
        },
        multiple: true,
        conditionalselect: _doConditionalSelect.bind(this, $tree),
        dnd: {
            large_drag_target: true,
            large_drop_target: true
        }
    });

    $tree.on('contextmenu', function(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        
        var li = $(event.target).parents('li.jstree-node').first();
        if (li.length === 1) {
            var selectedIds = tree.currentlySelectedNodes; // store selected nodes before highlighting

            var tagId = li.attr('name');
            tree.highlightNode($('#'+tagId, w.editor.getBody())[0]);
            
            if (selectedIds.indexOf(tagId) !== -1 && selectedIds.length > 1) {
                tagId = selectedIds;
            }

            // use setTimeout to make sure that highlight happens first
            setTimeout(function() {
                w.tagMenu.show(event, tagId, false);
            },0);
        }
    })
    
    $tree.on('select_node.jstree', _onNodeSelect);
    $tree.on('deselect_node.jstree', _onNodeDeselect);
    
    function handleDnDStart(e, data) {
        // TODO fullscreen support
        data.helper.addClass('cwrc');
        if (w.layoutManager.isFullScreen()) {
            $.vakata.dnd.stop(e);
        }
        data.helper.appendTo(w.layoutManager.getContainer());
    }
    $(document).on('dnd_start.vakata', handleDnDStart);
    
    function handleDnDMove(e, data) {
        // TODO fullscreen support
       var marker = $('#jstree-marker');
       if (marker.parent() !== w.layoutManager.getContainer()) {
           marker.appendTo(w.layoutManager.getContainer());
       }
//        var o = marker.offset();
//        marker.offset({top: o.top-6, left: o.left-2});
    }
    $(document).on('dnd_move.vakata', handleDnDMove);
    
    $tree.on('copy_node.jstree', function(e, data) {
        _onDragDrop(data, true);
    });
    $tree.on('move_node.jstree', function(e, data) {
        _onDragDrop(data, false);
    });
    $tree.on('load_node.jstree', function(event, data) {
        _onNodeLoad(data.node);
    });
    $tree.on('keydown.jstree', function(e) {
        //console.log(e.which);
    });
    $tree.on('ready.jstree', function(e, data) {
        initialized = true;
        if (updatePending) {
            tree.update();
            updatePending = false;
        }
        w.event('structureTreeInitialized').publish(tree);
    });
    
    w.event('loadingDocument').subscribe(function() {
        tree.clear();
        tree.disable();
    });
    w.event('documentLoaded').subscribe(function() {
        tree.enable(true);
    });
    w.event('nodeChanged').subscribe(function(currentNode) {
        if (!ignoreSelect) {
            tree.highlightNode(currentNode);
        }
    });
    w.event('contentChanged').subscribe(function() {
        tree.update();
    });
    w.event('contentCopied').subscribe(function() {
        if (tree.currentlySelectedNodes.length > 0) {
            var clone = $('#'+tree.currentlySelectedNodes[0], w.editor.getBody()).clone();
            w.editor.copiedElement.element = clone.wrapAll('<div />').parent()[0];
            w.editor.copiedElement.selectionType = tree.selectionType;
        }
    });
    w.event('contentPasted').subscribe(function() {
        tree.update();
    });
    w.event('writerKeydown').subscribe(function(evt) {
        if (tree.currentlySelectedNodes.length > 0) {
            var nodeId = tree.currentlySelectedNodes[0];
            
            // browsers have trouble deleting divs, so use the tree and jquery as a workaround
            if (evt.which == 8 || evt.which == 46) {
                    // cancel keyboard delete
                    // TODO doesn't cancel quickly enough
                    tinymce.dom.Event.cancel(evt);
                    if (tree.selectionType == tree.NODE_SELECTED) {
                        w.tagger.removeStructureTag(nodeId, true);
                    } else {
                        w.tagger.removeStructureTagContents(nodeId);
                        w.utilities.selectElementById(nodeId, true);
                    }
            } else if (evt.ctrlKey == false && evt.metaKey == false && evt.which >= 48 && evt.which <= 90) {
                // handle alphanumeric characters when whole tree node is selected
                // remove the selected node and set the focus to the closest node
                if (tree.selectionType == tree.NODE_SELECTED) {
                    var currNode = $('#'+nodeId, w.editor.getBody());
                    var collapseToStart = true;
                    var newCurrentNode = currNode.nextAll('[_tag]')[0];
                    if (newCurrentNode == null) {
                        newCurrentNode = currNode.parent().nextAll('[_tag]')[0];
                        if (newCurrentNode == null) {
                            collapseToStart = false;
                            newCurrentNode = currNode.prevAll('[_tag]')[0];
                        }
                    }
                    w.tagger.removeStructureTag(nodeId, true);
                    if (newCurrentNode != null) {
                        var rng = w.editor.selection.getRng(true);
                        rng.selectNodeContents(newCurrentNode);
                        rng.collapse(collapseToStart);
                        w.editor.selection.setRng(rng);
                    }
                }
            }
        }
    });
    w.event('writerKeyup').subscribe(function(evt) {
        // if the user's typing we don't want the currentlySelectedNodes to be set
        // calling highlightNode will clear currentlySelectedNodes
//        if (tree.currentlySelectedNodes.length > 0) {
//            var currNode = $('#'+tree.currentlySelectedNodes[0], w.editor.getBody())[0];
//            tree.highlightNode(currNode);
//        }
    });
    
    w.event('entityAdded').subscribe(function(entityId) {
        tree.update();
    });
    w.event('entityRemoved').subscribe(function(entityId) {
        tree.update();
    });
    w.event('entityFocused').subscribe(function(entityId) {
//        if (!ignoreSelect) {
//            var entityNode = $('[name="'+entityId+'"]', w.editor.getBody())[0];
//            tree.highlightNode(entityNode);
//        }
//        ignoreSelect = false;
    });
    w.event('entityPasted').subscribe(function(entityId) {
        tree.update();
    });
    w.event('tagAdded').subscribe(function(tag) {
        tree.update();
    });
    w.event('tagEdited').subscribe(function(tag) {
        tree.update();
    });
    w.event('tagRemoved').subscribe(function(tagId) {
        tree.update();
    });
    w.event('tagContentsRemoved').subscribe(function(tagId) {
        tree.update();
    });
    w.event('tagSelected').subscribe(function(tagId) {
//        tree.currentlySelectedNodes = [tagId];
//        tree.selectNode(tagId, false);
        if (!ignoreSelect) {
            tree.selectNode(tagId, false);
        }
        ignoreSelect = false;
    });
    
    // add to writer
    w.tree = tree;
    
    return tree;
};

module.exports = StructureTree;
