'use strict';

var $ = require('jquery');
var ObjTree = require('objtree');

/**
 * @class Utilities
 * @param {Writer} writer
 */
function Utilities(writer) {
    var w = writer;
    
    // created in and used by convertTextForExport
    var $entitiesConverter;
    
    /**
     * @lends Utilities
     */
    var u = {};
    
    u.xmlToString = function(xmlData) {
        var xmlString = '';
        try {
            xmlString = (new XMLSerializer()).serializeToString(xmlData);
        } catch (e) {
            console.warn(e);
        }
        return xmlString;
    };
    
    u.stringToXML = function(string) {
        var doc = (new DOMParser()).parseFromString(string, "text/xml");
        var parsererror = doc.querySelector('parsererror');
        if (parsererror !== null) {
            console.error('utilities.stringToXML parse error:',parsererror.innerText);
            return null;
        }
        return doc;
    };
    
    u.xmlToJSON = function(xml) {
        if ($.type(xml) == 'string') {
            xml = u.stringToXML(xml);
            if (xml === null) {
                return null;
            }
        }
        var xotree = new ObjTree();
        xotree.attr_prefix = '@';
        var json = xotree.parseDOM(xml);
        return json;
    };

    /**
     * Converts HTML entities to unicode, while preserving those that must be escaped as entities.
     * @param {String} text The text to convert
     * @param {Boolean} [isAttributeValue] Is this an attribute value? Defaults to false
     * @returns {String} The converted text
     */
    u.convertTextForExport = function(text, isAttributeValue) {
        isAttributeValue = isAttributeValue === undefined ? false : isAttributeValue;

        if ($entitiesConverter === undefined) {
            $entitiesConverter = $('<div style="display: none;"></div>').appendTo(w.layoutManager.getContainer());
        }

        var newText = text;
        if (newText != null) {
            if (newText.match(/&.+?;/gim)) { // match all entities
                $entitiesConverter[0].innerHTML = newText;
                newText = $entitiesConverter[0].innerText || $entitiesConverter[0].firstChild.nodeValue;
            }
            // the following characters must be escaped
            newText = newText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            if (isAttributeValue) {
                newText = newText.replace(/"/g, '&quot;');
            }
        }

        return newText;
    }
    
    u.addCSS = function(cssHref) {
        var fullHref = w.cwrcRootUrl+cssHref;
        if (document.querySelector('link[rel=stylesheet][href="'+fullHref+'"]')) {
            return;
        }
        $(document.head).append('<link type="text/css" rel="stylesheet" href="'+fullHref+'" />');
    }
    
    /**
     * @param content
     * @returns {String}
     */
    u.getTitleFromContent = function(content) {
        content = content.trim();
        if (content.length <= 34) return content;
        var title = content.substring(0, 34) + '&#8230;';
        return title;
    };
    
    u.getCamelCase = function(str) {
        return str.replace(/(?:^|\s)\w/g, function(match) {
            return match.toUpperCase();
        });
    };
    
    u.escapeHTMLString = function(value) {
        if (typeof value == 'string') {
            return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        } else {
            return value;
        }
    };
    
    u.unescapeHTMLString = function(value) {
        if (typeof value == 'string') {
            return value.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        } else {
            return value;
        }
    };
    
    u.getPreviousTextNode = function(node, skipWhitespace) {
        skipWhitespace = skipWhitespace === undefined ? false : skipWhitespace;
        var walker = node.ownerDocument.createTreeWalker(node.ownerDocument, NodeFilter.SHOW_TEXT, {
            acceptNode: function(node) {
                // whitespace match does not include \uFEFF since we use that to prevent empty tags
                if (skipWhitespace === false || skipWhitespace && node.textContent.match(/^[\f\n\r\t\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/) === null) {
                    return NodeFilter.FILTER_ACCEPT;
                } else {
                    return NodeFilter.FILTER_SKIP;
                }
            }
        });
        walker.currentNode = node;
        var prevTextNode = walker.previousNode();

        return prevTextNode;
    };
    
    u.getNextTextNode = function(node, skipWhitespace) {
        skipWhitespace = skipWhitespace === undefined ? false : skipWhitespace;
        var walker = node.ownerDocument.createTreeWalker(node.ownerDocument, NodeFilter.SHOW_TEXT, {
            acceptNode: function(node) {
                // whitespace match does not include \uFEFF since we use that to prevent empty tags
                if (skipWhitespace === false || skipWhitespace && node.textContent.match(/^[\f\n\r\t\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/) === null) {
                    return NodeFilter.FILTER_ACCEPT;
                } else {
                    return NodeFilter.FILTER_SKIP;
                }
            }
        });
        walker.currentNode = node;
        var nextTextNode = walker.nextNode();
        
        return nextTextNode;
    };
    
    /**
     * Selects an element in the editor
     * @param id The id of the element to select
     * @param selectContentsOnly Whether to select only the contents of the element (defaults to false)
     */
    u.selectElementById = function(id, selectContentsOnly) {
        selectContentsOnly = selectContentsOnly == null ? false : selectContentsOnly;

        w.entitiesManager.removeHighlights();

        if ($.isArray(id)) {
            // TODO add handling for multiple ids
            id = id[id.length - 1];
        }

        var node = $('#' + id, w.editor.getBody());
        var nodeEl = node[0];
        if (nodeEl != null) {
            // show the element if it's inside a note
            node.parents('.noteWrapper').removeClass('hide');

            var rng = w.editor.dom.createRng();
            if (selectContentsOnly) {
                if (tinymce.isWebKit) {
                    if (nodeEl.firstChild == null) {
                        node.append('\uFEFF');
                    }
                    rng.selectNodeContents(nodeEl);
                } else {
                    rng.selectNodeContents(nodeEl);
                }
            } else {
                $('[data-mce-bogus]', node.parent()).remove();
                rng.selectNode(nodeEl);
            }

            w.editor.selection.setRng(rng);

            w.editor.currentBookmark = w.editor.selection.getBookmark(1);

            // scroll node into view
            var nodeTop = 0;
            if (node.is(':hidden')) {
                node.show();
                nodeTop = node.position().top;
                node.hide();
            } else {
                nodeTop = node.position().top;
            }
            var newScrollTop = nodeTop - $(w.editor.getContentAreaContainer()).height() * 0.25;
            $(w.editor.getDoc()).scrollTop(newScrollTop);

            // using setRng triggers nodeChange event so no need to call it manually
            //            _fireNodeChange(nodeEl);

            // need focus to happen after timeout, otherwise it doesn't always work (in FF)
            window.setTimeout(function() {
                w.editor.focus();
                w.event('tagSelected').publish(id, selectContentsOnly);
            }, 0);
        }
    };
    
    u.getRootTag = function() {
        return $('[_tag]:first', w.editor.getBody());
    };
    
    /**
     * Get the XPath for an element, using the nodeName or cwrc _tag attribute as appropriate.
     * Adapted from the firebug source.
     * @param {Element} element The (cwrc) element to get the XPath for
     * @param {String} [tagAttribute] The name of the attribute to use as the tag
     * @returns {String|null}
     */
    u.getElementXPath = function(element, tagAttribute) {
        if (element == null) {
            return null;
        }
        var tagAtt = undefined;
        if (tagAttribute !== undefined) {
            tagAtt = tagAttribute;
        } else if (element.getAttribute('_tag') !== null) {
            tagAtt = '_tag'; // cwrc-writer format
        }
        var paths = [];
        
        // Use nodeName (instead of localName) so namespace prefix is included (if any).
        for (; element && element.nodeType == 1; element = element.parentNode)
        {
            var index = 0;
            for (var sibling = element.previousSibling; sibling; sibling = sibling.previousSibling)
            {
                // Ignore document type declaration.
                if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE)
                    continue;

                if (tagAtt !== undefined && sibling.getAttribute !== undefined) {
                    if (sibling.getAttribute(tagAtt) == element.getAttribute(tagAtt)) {
                        ++index;
                    }
                } else {
                    if (sibling.nodeName == element.nodeName) {
                        ++index;
                    }
                }
            }

            var tagName = null;
            if (tagAtt !== undefined) {
                tagName = element.getAttribute(tagAtt);
            } else {
                tagName = element.nodeName;
            }
            if (tagName != null) {
                var pathIndex = (index ? "[" + (index+1) + "]" : "");
                paths.splice(0, 0, tagName + pathIndex);
            }
        }

        return paths.length ? paths.join("/") : null;
    };

    /**
     * Returns the result of the specified xpath on the specified context node.
     * Can detect and convert an XML xpath for use with the cwrc-writer format.
     * Adds support for default namespace.
     * @param {Document|Element} contextNode
     * @param {String} xpath
     * @returns {XPathResult|null} The result or null
     */
    u.evaluateXPath = function(contextNode, xpath) {
        let doc = contextNode.ownerDocument;
        if (doc === null) doc = contextNode; // then the contextNode is a doc
           
        const isCWRC = doc === w.editor.getDoc();

        // grouped matches: 1 separator, 2 axis, 3 namespace, 4 element name or attribute name or function, 5 predicate
        const regex = /(\/{0,2})([\w-]+::|@)?(\w+?:)?([\w-(\.\*)]+)(\[.+?\])?/g;

        let nsResolver = null;
        const defaultNamespace = doc.documentElement.getAttribute('xmlns');
        // TODO should doc.documentElement.namespaceURI also be checked? it will return http://www.w3.org/1999/xhtml for the editor doc
        if (!isCWRC) {
            const nsr = doc.createNSResolver(doc.documentElement);
            nsResolver = (prefix) => nsr.lookupNamespaceURI(prefix) || defaultNamespace;

            // default namespace hack (http://stackoverflow.com/questions/9621679/javascript-xpath-and-default-namespaces)
            if (defaultNamespace !== null) {
                // add foo namespace to the element name
                xpath = xpath.replace(regex, (match, p1, p2, p3, p4, p5) => {
                    if (p3 !== undefined) {
                        // already has a namespace
                        return match;
                    } else {
                        if (
                            // it's an attribute and therefore doesn't need a default namespace
                            (p2 !== undefined && (p2.indexOf('attribute') === 0 || p2.indexOf('@') === 0))
                            ||
                            // it's a function not an element name
                            p4.match(/\(.*?\)/) !== null
                        ) {
                            return [p1,p2,p3,p4,p5].join('');
                        } else {
                            return [p1,p2,'foo:',p4,p5].join('');
                        }
                    }
                });
            }
        }

        if (defaultNamespace === null) {
            // remove all namespaces from the xpath
            xpath = xpath.replace(regex, (match, p1, p2, p3, p4, p5) => {
                return [p1,p2,p4,p5].join('');
            });
        }

        if (isCWRC) {
            if (doc === contextNode) contextNode = doc.documentElement;
            // if the context node is the schema root then we need to make sure the xpath starts with "//"
            if (contextNode.getAttribute('_tag') === w.schemaManager.getRoot() && xpath.charAt(0) !== '@') {
                if (xpath.charAt(1) !== '/') {
                    xpath = `/${xpath}`;
                    if (xpath.charAt(1) !== '/') {
                        xpath = `/${xpath}`;
                    }
                }
            }

            xpath = xpath.replace(regex, (match, p1, p2, p3, p4, p5) => {
                if (
                    // it's an attribute and therefore doesn't need a default namespace
                    (p2 !== undefined && (p2.indexOf('attribute') === 0 || p2.indexOf('@') === 0))
                    ||
                    // it's a function not an element name
                    p4.indexOf(/\(.*?\)/) !== -1
                    // p4.match(/\(.*?\)/) !== null
                ) {
                    return [p1,p2,p3,p4,p5].join('');
                } else {
                    return [p1,p2,p3,'*[@_tag="'+p4+'"]',p5].join('');
                }
            });
        }
        
        let evalResult;
        try {
            evalResult = doc.evaluate(xpath, contextNode, nsResolver, XPathResult.ANY_TYPE, null);
        } catch (e) {
            console.warn('utilities.evaluateXPath: there was an error evaluating the xpath', e)
            return null;
        }

        let result;
        switch (evalResult.resultType) {
            case XPathResult.NUMBER_TYPE:
                result = evalResult.numberValue;
                break;
            case XPathResult.STRING_TYPE:
                result = evalResult.stringValue;
                break;
            case XPathResult.BOOLEAN_TYPE:
                result = evalResult.booleanValue;
                break;
            case XPathResult.UNORDERED_NODE_ITERATOR_TYPE:
            case XPathResult.ORDERED_NODE_ITERATOR_TYPE:
                result = evalResult.iterateNext();
                break;
            case XPathResult.ANY_UNORDERED_NODE_TYPE:
            case XPathResult.FIRST_ORDERED_NODE_TYPE:
                result = evalResult.singleNodeValue;
                break;
        }

        return result;
    };

    /**
     * Used to processes a large array incrementally, in order to not freeze the browser.
     * @param {Array} array An array of values
     * @param {Function} processFunc The function that accepts a value from the array
     * @param {Number} [refreshRate]  How often to break (in milliseconds). Default is 250.
     * @returns {Promise} A jQuery promise
     */
    u.processArray = function(array, processFunc, refreshRate) {
        refreshRate = refreshRate === undefined ? 250 : refreshRate;

        var dfd = new $.Deferred();

        var li = w.dialogManager.getDialog('loadingindicator');

        var startingLength = array.length;
        var time1 = new Date().getTime();

        var parentFunc = function() {
            while (array.length > 0) {
                var entry = array.shift();

                processFunc.call(this, entry);

                var time2 = new Date().getTime();
                if (time2 - time1 > refreshRate) {
                    break;
                }
            }

            var percent = Math.abs(array.length-startingLength) / startingLength * 100;
            li.setValue(percent);

            if (array.length > 0) {
                time1 = new Date().getTime();
                setTimeout(parentFunc, 10);
            } else {
                dfd.resolve();
            }
        }

        parentFunc();

        return dfd.promise();
    };
    
    u.createGuid = function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    };
    
    /**
     * Get the offset position of an element, relative to the parent (default is cwrc-writer container).
     * @param {Element} el The element
     * @param {Element} [parent] The offset parent. Default is the cwrc-writer container.
     * @returns {Object} position An object container top and left properties
     */
    u.getOffsetPosition = function(el, parent) {
        parent = parent === undefined ? w.layoutManager.getContainer() : $(parent);

        var $el = $(el);
        var position = $el.position();
        
        var offP = $el.offsetParent();
        while(parent.find(offP).length == 1) {
            var pos = offP.position();
            position.top += pos.top;
            position.left += pos.left;
            
            offP = offP.offsetParent();
        }
        
        return position;
    };
    
    /**
     * Constrain a value. Useful when positioning an element within another element.
     * @param {Number} value The x or y value of the element
     * @param {Number} max The max to constrain within
     * @param {Number} size The size of the element
     * @returns {Number} value The constrained value
     */
    u.constrain = function(value, max, size) {
        if (value < 0) {
            return 0;
        }

        if (value + size > max) {
            value = max - size;
            return value < 0 ? 0 : value;
        }

        return value;
    }

    u.destroy = function() {
        if ($entitiesConverter !== undefined) {
            $entitiesConverter.remove();
        }
    };
    
    return u;
};

module.exports = Utilities;