'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/button');
    
/**
 * @class Validation
 * @param {Object} config
 * @param {Writer} config.writer
 * @param {String} config.parentId
 * @param {String} config.validationUrl
 */
function Validation(config) {
    
    var w = config.writer;

    var validationUrl = config.validationUrl;
    if (validationUrl === undefined) {
        console.error('Validation: no validationUrl specified!');
    }
    
    var id = w.getUniqueId('validation_');
    
    $('#'+config.parentId).append(`
    <div class="moduleParent">
        <div id="${id}" class="moduleContent">
            <ul class="validationList"></ul>
        </div>
        <div id="${id}_buttons" class="moduleFooter">
            <button type="button" role="validate">Validate</button>
            <button type="button" role="clear">Clear</button>
        </div>
    </div>
    `);
    
    w.event('documentLoaded').subscribe(function() {
        validation.clearResult();
    });
    
    w.event('validationRequested').subscribe(function() {
        var list = $('#'+id+' > ul');
        list.empty();
        list.append(''+
        '<li class="ui-state-default">'+
            '<span class="loading"></span> Validating...'+
        '</li>');
        w.layoutManager.showModule('validation');

        validation.validate();
    });
    
    w.event('documentValidated').subscribe(function(valid, resultDoc, docString) {
        $('#'+id+'_indicator').hide();
        validation.showValidationResult(resultDoc, docString);
    });
    
    /**
     * @lends Validation.prototype
     */
    var validation = {};
    
    validation.validate = function() {
        w.converter.getDocumentContent(false, (docText) => {
            // var schemaUrl = w.schemaManager.schemas[w.schemaManager.schemaId].url;

            const schemaEntry = w.schemaManager.schemas.find( schema => w.schemaManager.schemaId === schema.id);
            const schemaUrl = schemaEntry.url;

            $.ajax({
                url: validationUrl,
                type: 'POST',
                dataType: 'xml',
                data: {
                    sch: schemaUrl,
                    type: 'RNG_XML',
                    content: docText
                },
                success: function(data, status, xhr) {
                    var valid = $('status', data).text() == 'pass';
                    w.event('documentValidated').publish(valid, data, docText);
                },
                error: function() {
                    w.dialogManager.show('message', {
                        title: 'Error',
                        msg: 'An error occurred while trying to validate the document.',
                        type: 'error'
                    });
                    w.event('documentValidated').publish(null, '', '');
                }
            });
        });
    };

    /**
     * Processes a validation response from the server.
     * @param resultDoc The actual response
     * @param docString The doc string sent to the server for validation  
     */
    validation.showValidationResult = function(resultDoc, docString) {
        var list = $('#'+id+' > ul');
        list.empty();
        
        docString = docString.split('\n')[1]; // remove the xml header
        
        var status = $('status', resultDoc).text();
        
        if (status == 'pass') {
            list.append(''+
                '<li class="ui-state-default">'+
                    '<span class="ui-icon ui-icon-check" style="float: left; margin-right: 4px;"></span>Your document is valid!'+
                '</li>');
        }

        w.tagger.removeNoteWrappersForEntities();
        
        $('warning', resultDoc).each(function(index, el) {
            var id = null;
            
            var type = el.nodeName;
            var message = $(this).find('message').text();
            var path = $(this).find('path').text();
            var elementId = $(this).find('elementId').text();
            var column = parseInt($(this).find('column').text());
            
            if (elementId != '') {
                id = elementId;
            }
            if (id == null && path != '') {
                // convert xpath to jquery selector
                var editorPath = '';
                var tags = path.split('/');
                for (var i = 0; i < tags.length; i++) {
                    var tag = tags[i];
                    var tagName = tag.match(/^\w+(?=\[)?/);
                    if (tagName != null) {
                        var index = tag.match(/\[(\d+)\]/);
                        if (index === null) {
                            index = 0;
                        } else {
                            index = parseInt(index[1]);
                            index--; // xpath is 1-based and "eq()" is 0-based
                        }
                        editorPath += '*[_tag="'+tagName[0]+'"]:eq('+index+') > ';
                    }
                }
                editorPath = editorPath.substr(0, editorPath.length-3);
                var docEl = $(editorPath, w.editor.getBody());
                id = docEl.attr('id');
            }
            if (id == null && !isNaN(column)) {
                var docSubstring = docString.substring(0, column);
                var tags = docSubstring.match(/<.*?>/g);
                if (tags != null) {
                    var tag = tags[tags.length-1];
                    id = tag.match(/id="(.*?)"/i);
                    if (id == null) {
                        if (message.search('text not allowed here') != -1) {
                            // find the parent tag
                            var level = 0;
                            for (var i = tags.length-1; i > -1; i--) {
                                tag = tags[i];
                                if (tag.search('/') != -1) {
                                    level++; // closing tag, add a level
                                } else {
                                    level--; // opening tag, remove a level
                                }
                                if (level == -1) {
                                    var match = tag.match(/id="(.*?)"/i);
                                    if (match != null && match[1]) id = match[1];
                                    break;
                                }
                            }
                        } else {
                            var tagMatch = tag.match(/<\/(.*)>/);
                            if (tagMatch != null) {
                                // it's and end tag, so find the matching start tag
                                var tagName = tagMatch[1];
                                for (var i = tags.length-1; i > -1; i--) {
                                    tag = tags[i];
                                    var startTagName = tag.match(/<(.*?)\s/);
                                    if (startTagName != null && startTagName[1] == tagName) {
                                        id = tag.match(/id="(.*?)"/i)[1];
                                        break;
                                    }
                                }
                            } else {
                                // probably entity tag
                            }
                        }
                    } else {
                        id = id[1];
                    }
                } else {
                    // can't find any tags!
                }
            }
            
            if (id != null) {
                var messageParts;
                var messageDivLoc = message.indexOf(';');
                if (messageDivLoc != -1) {
                    messageParts = [message.slice(0, messageDivLoc+1), message.slice(messageDivLoc+2)];
                } else {
                    messageParts = [message];
                }
                
                var messageHtml = '<li class="'+(type=='warning'?'ui-state-error':'ui-state-highlight')+'">'+
                    '<span class="ui-icon '+(type=='warning'?'ui-icon-alert':'ui-icon-info')+'" style="float: left; margin-right: 4px;"></span>'+
                    'Path: '+path+'<br/>'+
                    'Message: '+messageParts[0];
                if (messageParts[1] !== undefined) {
                    messageHtml += ' <span class="message_more">more...</span><span style="display: none;">'+messageParts[1]+'</span>';
                }
                messageHtml += '</li>';
                
                var item = list.append(messageHtml).find('li:last');
                item.find('[class="message_more"]').click(function() {
                    $(this).next('span').show();
                    $(this).hide();
                });
                
                item.data('id', id);
            } else {
                console.warn("validation: couldn't find element for "+path);
            }
        });

        w.tagger.addNoteWrappersForEntities();
        
        list.find('li').click(function() {
            list.find('li').removeClass('selected');
            $(this).addClass('selected');
            
            var id = $(this).data('id');
            w.utilities.selectElementById(id);
        });
        
        w.layoutManager.showModule('validation');
    };
    
    validation.clearResult = function() {
        $('#'+id+'_indicator').hide();
        $('#'+id+' > ul').empty();
    };

    var $validateButton = $('#'+id+'_buttons button[role=validate]').button();
    $validateButton.click(function() {
        validation.validate();
    });
    var $clearButton = $('#'+id+'_buttons button[role=clear]').button();
    $clearButton.click(function() {
        validation.clearResult();
    });
    
    validation.destroy = function() {
        $validateButton.button('destroy');
        $clearButton.button('destroy');
    };
    
    // add to writer
    w.validation = validation;
    
    return validation;
};

module.exports = Validation;
