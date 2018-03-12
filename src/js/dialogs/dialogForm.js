'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/dialog');
require('jquery-ui/ui/widgets/accordion');
require('jquery-ui/ui/widgets/button');
require('jquery-ui/ui/widgets/controlgroup');

var AttributeWidget = require('./attributeWidget.js');
function DialogForm(config) {
    this.w = config.writer;
    this.$el = config.$el;
    
    var title = config.title;
    var height = config.height || 650;
    var width = config.width || 575;
    
    this.showConfig; // the config object sent to the dialog's "show" method
    
    this.cwrcWriter; // reference to the cwrcWriter if this is a note form
    this.cwrcWriterConfig = config.cwrcWriterConfig; // the config to use for the cwrcWriter
    
    // set to false to cancel saving
    this.isValid = true;
    
    this.type = config.type;
    this.mode = null; // ADD or EDIT
    this.currentData = {
        attributes: {},
        properties: {},
        customValues: {},
        noteContent: {}
    };;
    this.currentId = null; // entity ID

    this.$el.dialog({
        title: title,
        modal: true,
        resizable: true,
        dialogClass: 'splitButtons',
        closeOnEscape: false,
        open: $.proxy(function(event, ui) {
            this.$el.parent().find('.ui-dialog-titlebar-close').hide();
        }, this),
        height: height,
        width: width,
        position: { my: "center", at: "center", of: this.w.layoutManager.getWrapper() },
        autoOpen: false,
        buttons: [{
            text: 'Cancel',
            click: $.proxy(function() {
                this.$el.trigger('beforeCancel');
                
                if (this.showConfig.convertedEntity === true) {
                    var $tag = $('#'+this.showConfig.entry.id, this.w.editor.getBody());
                    $tag.removeAttr('_entity _type class name');
                    this.w.entitiesManager.removeEntity(this.showConfig.entry.id);
                    var attributes = {};
                    $.each($($tag[0].attributes), function(index, att) {
                        attributes[att.name] = att.value;
                    });
                    this.w.tagger.editStructureTag($tag, attributes);
                }
                
                this.$el.trigger('beforeClose');
                this.$el.dialog('close');
            }, this)
        },{
            text: 'Save',
            click: $.proxy(function() {
                this.save();
            }, this)
        }]
    });
    
    $('[data-transform]', this.$el).each(function(index, el) {
        var formEl = $(this);
        var transform = formEl.data('transform');
        switch (transform) {
            case 'buttonset':
                formEl.controlgroup();
                break;
            case 'accordion':
                formEl.accordion({
                    heightStyle: 'content',
                    animate: false,
                    collapsible: true,
                    active: false
                });
                break;
        }
    });
    $('[data-type="attributes"]', this.$el).first().each($.proxy(function(index, el) {
        this.attributesWidget = new AttributeWidget({writer: this.w, $parent: this.$el, $el: $(el)});
        this.attWidgetInit = false;
    }, this));
}

DialogForm.ADD = 0;
DialogForm.EDIT = 1;

DialogForm.processForm = function(dialogInstance) {
    var data = dialogInstance.currentData;
    
    // process attributes first, since other form elements should override them if there's a discrepancy
    if ($('[data-type="attributes"]', dialogInstance.$el).length === 1) {
        var atts = dialogInstance.attributesWidget.getData();
        $.extend(data.attributes, atts);
    }
    
    $('[data-type]', dialogInstance.$el).not('[data-type="attributes"]').each(function(index, el) {
        var formEl = $(this);
        var type = formEl.data('type');
        var mapping = formEl.data('mapping');
        if (mapping !== undefined) {
            var dataKey = 'attributes';
            var isCustom = mapping.indexOf('custom.') === 0;
            var isProperty = mapping.indexOf('prop.') === 0;
            if (isCustom) {
                mapping = mapping.replace(/^custom\./, '');
                dataKey = 'customValues';
            } else if (isProperty) {
                mapping = mapping.replace(/^prop\./, '');
                dataKey = 'properties';
            }
            switch (type) {
                case 'radio':
                    var val = formEl.find('input:checked').val();
                    data[dataKey][mapping] = val;
                    break;
                case 'textbox':
                case 'hidden':
                case 'select':
                    var val = formEl.val();
                    data[dataKey][mapping] = val;
                    break;
            }
        }
    });
    
    for (var key in data.attributes) {
        if (data.attributes[key] === undefined || data.attributes[key] === '') {
            delete data.attributes[key];
        }
    }
};

function initAttributeWidget(dialogInstance, config) {
    var tag;
    if (config.entry) {
        tag = config.entry.tag
    } else {
        tag = dialogInstance.w.schemaManager.mapper.getParentTag(dialogInstance.type);
    }
    var atts = dialogInstance.w.utilities.getChildrenForTag({tag: tag, type: 'attribute', returnType: 'array'});
    dialogInstance.attributesWidget.buildWidget(atts);
    dialogInstance.attWidgetInit = true;
};

function initWriter(el) {
    var me = this;
    
    var config = me.cwrcWriterConfig;
    if (config === undefined) {
        // defaults
        var config = $.extend({}, me.w.initialConfig);
        config.modules = {
            west: ['structure','entities']
        }
        config.embedded = true;
        config.mode = 'xml';
        config.allowOverlap = false;
        config.buttons1 = 'schematags,editTag,removeTag,|,addperson,addplace,adddate,addorg,addcitation,addtitle,addcorrection,addkeyword,addlink';
    }
    
    if (el.getAttribute('id') == null || config.container === undefined) {
        var id = me.w.getUniqueId('miniWriter_');
        config.container = id;
        el.setAttribute('id', id);
    }
    
    if (me.cwrcWriterConfig === undefined) {
        // store defaults
        me.cwrcWriterConfig = config;
    }
    
    me.cwrcWriter = new me.w._getClass()(config);
    
    me.$el.one('beforeClose', function() {
        me.cwrcWriter.destroy();
    });
    
    me.$el.one('beforeSave', function() {
        var content = me.cwrcWriter.converter.getDocumentContent();
        me.currentData.noteContent = content;
    });
    if (me.cwrcWriter.isReadOnly) {
        me.$el.dialog('option', 'buttons', [{
            text: 'Close',
            click: function() {
                me.$el.trigger('beforeCancel');
                me.$el.trigger('beforeClose');
                me.$el.dialog('close');
            }
        }]);
    }
    
    if (me.cwrcWriter.isInitialized) {
        postSetup();
    } else {
        me.cwrcWriter.event('writerInitialized').subscribe(postSetup);
    }
    
    function postSetup() {
        me.cwrcWriter.settings.hideAdvanced();
        
        me.cwrcWriter.event('documentLoaded').subscribe(function() {
            // TODO remove forced XML/no overlap
            me.cwrcWriter.mode = me.cwrcWriter.XML;
            me.cwrcWriter.allowOverlap = false;
            
            me.cwrcWriter.editor.focus();
            /*
            var parentTag = me.cwrcWriter.schemaManager.mapper.getParentTag(me.showConfig.type);
            var nodeEl = me.cwrcWriter.editor.dom.$('[_tag='+parentTag+']');
            var nodeChildren = nodeEl.children();
            while (nodeChildren.length) {
                nodeEl = nodeChildren;
                nodeChildren = nodeEl.children();
            }
            nodeEl = nodeEl[0];
            var rng = me.cwrcWriter.editor.dom.createRng();
            rng.selectNodeContents(nodeEl);
            var sel = me.cwrcWriter.editor.selection;
            sel.setRng(rng);
            sel.collapse(true);
            */
        });
        
        // in case document is loaded before tree
        me.cwrcWriter.event('structureTreeInitialized').subscribe(function(tree) {
            setTimeout(tree.update, 50); // need slight delay to get indents working for some reason
        });
        me.cwrcWriter.event('entitiesListInitialized').subscribe(function(el) {
            setTimeout(el.update, 50);
        });
        
        var noteUrl = me.w.schemaManager.getCurrentSchema().entityTemplates[me.type];
        if (me.mode === DialogForm.ADD) {
            me.cwrcWriter.fileManager.loadDocumentFromUrl(noteUrl);
        } else {
            $.ajax({
                url: noteUrl,
                type: 'GET',
                dataType: 'xml',
                success: function(doc, status, xhr) {
                    var parent = me.showConfig.entry.getTag();
                    var noteDoc = $.parseXML(me.showConfig.entry.getNoteContent());
                    var annotation = $(parent, noteDoc).first();
                    annotation.removeAttr('annotationId');
                    var xmlDoc = $(doc).find(parent).replaceWith(annotation).end()[0];
                    me.cwrcWriter.fileManager.loadDocumentFromXml(xmlDoc);
                }
            });
        }
    }
}

DialogForm.prototype = {

    constructor: DialogForm,
    
    show: function(config) {
        this.showConfig = config;
        
        this.mode = config.entry ? DialogForm.EDIT : DialogForm.ADD;
        
        if (this.attributesWidget != null) {
            if (this.attWidgetInit === false) {
                initAttributeWidget(this, config);
            }
            this.attributesWidget.reset();
        }
        
        // reset the form
        $('[data-type]', this.$el).each(function(index, el) {
            var formEl = $(this);
            var type = formEl.data('type');
            switch (type) {
                case 'radio':
                    formEl.find('[data-default]').prop('checked', true);
                    if (formEl.data('transform') === 'buttonset') {
                        $('input', formEl).button('refresh');
                    }
                    break;
                case 'textbox':
                case 'hidden':
                case 'select':
                    formEl.val('');
                    break;
                case 'tagAs':
                    formEl.empty();
                    break;
            }
        });
        $('[data-transform="writer"]', this.$el).each(function(index, el) {
            this.$el.one('dialogopen', function(e, ui) {
                initWriter.call(this, el);
            }.bind(this));
        }.bind(this));
        $('[data-transform="accordion"]', this.$el).each(function(index, el) {
            $(this).accordion('option', 'active', false);
        });
        
        this.$el.one('beforeClose', function(event) {
            // if we have an entity dialog inside a note entity, we need to stop the parent note entity from also receiving beforeClose
            event.stopPropagation();
        });
        
        this.currentData = {
            attributes: {},
            properties: {},
            customValues: {},
            noteContent: {}
        };
        
        if (this.mode === DialogForm.ADD) {
            if (config.cwrcInfo != null) {
                $('[data-type="tagAs"]', this.$el).html(config.cwrcInfo.name);
                this.currentData.cwrcInfo = config.cwrcInfo;
            }
        } else if (this.mode === DialogForm.EDIT) {
            this.currentId = config.entry.getId();
            
            var data = config.entry.getAttributes();
            
            var cwrcInfo = config.entry.getLookupInfo();
            
            var customValues = config.entry.getCustomValues();
            
            if (cwrcInfo != null) {
                this.currentData.cwrcInfo = cwrcInfo;
                $('[data-type="tagAs"]', this.$el).html(cwrcInfo.name);
            }
            
            this.currentData.customValues = customValues;
            this.currentData.properties = {
                tag: config.entry.tag
            }
            
            // populate form
            var that = this;
            $('[data-type]', this.$el)
                .filter(function(index, el) {
                    return $(el).parents('.cwrcWrapper').length === 1; // don't include form elements from note entity children
                })
                .each(function(index, el) {
                    var formEl = $(this);
                    var type = formEl.data('type');
                    if (type === 'attributes') {
                        var showWidget = that.attributesWidget.setData(data);
                        if (showWidget) {
                            that.attributesWidget.expand();
                        }
                    } else {
                        var mapping = formEl.data('mapping');
                        if (mapping !== undefined) {
                            var value;
                            
                            var isCustom = mapping.indexOf('custom.') === 0;
                            var isProperty = mapping.indexOf('prop.') === 0;
                            if (isCustom) {
                                mapping = mapping.replace(/^custom\./, '');
                                value = customValues[mapping];
                            } else if (isProperty) {
                                mapping = mapping.replace(/^prop\./, '');
                                value = config.entry[mapping];
                            } else {
                                value = data[mapping];
                            }
                            
                            if (value !== undefined) {
                                switch (type) {
                                    case 'select':
                                        formEl.val(value);
                                        formEl.parents('[data-transform="accordion"]').accordion('option', 'active', 0);
                                        break;
                                    case 'radio':
                                        $('input[value="'+value+'"]', formEl).prop('checked', true);
                                        if (formEl.data('transform') === 'buttonset') {
                                            $('input', formEl).button('refresh');
                                        }
                                        break;
                                    case 'textbox':
                                        formEl.val(value);
                                        break;
                                }
                            }
                        }
                    }
                });
        }
        
        this.$el.trigger('beforeShow', [config, this]);
        
        this.$el.dialog('open');
    },
    
    save: function() {
        DialogForm.processForm(this);
        
        this.$el.trigger('beforeSave', [this]);
        if (this.isValid === true) {
            this.$el.trigger('beforeClose');
            this.$el.dialog('close');
            
            if (this.mode === DialogForm.EDIT && this.currentData != null) {
                this.w.tagger.editEntity(this.currentId, this.currentData);
            } else {
                this.w.tagger.finalizeEntity(this.type, this.currentData);
            }
        }
    },
    
    destroy: function() {
        if (this.attributesWidget != null) {
            this.attributesWidget.destroy();
        }
        
        $('[data-transform]', this.$el).each(function(index, el) {
            var formEl = $(el);
            var transform = formEl.data('transform');
            switch (transform) {
                case 'buttonset':
                    formEl.controlgroup('destroy');
                    break;
                case 'accordion':
                    formEl.accordion('destroy');
                    break;
            }
        });
        
        this.$el.empty();
    }
};

module.exports = DialogForm;
