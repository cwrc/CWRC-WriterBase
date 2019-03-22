'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/dialog');
require('jquery-ui/ui/widgets/accordion');
require('jquery-ui/ui/widgets/button');
require('jquery-ui/ui/widgets/controlgroup');
require('jquery-ui/ui/widgets/selectmenu');

var AttributeWidget = require('../attributeWidget/attributeWidget.js');
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
        customValues: {}
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
        position: { my: "center", at: "center", of: this.w.layoutManager.getContainer() },
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
        var formEl = $(el);
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
            case 'selectmenu':
                formEl.selectmenu({
                    appendTo: this.w.layoutManager.getContainer()
                });
        }
    }.bind(this));
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
        if (formEl.parents('.cwrcDialogWrapper').length === 1) { // ignore child forms inserted by note mini-writers
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
                        // only override if the value isn't blank
                        if (val !== '') {
                            data[dataKey][mapping] = val;
                        }
                        break;
                }
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
        $('[data-transform="accordion"]', this.$el).each(function(index, el) {
            $(this).accordion('option', 'active', false);
        });
        
        // if we have an entity dialog inside a note entity, we need to stop the parent note entity from also receiving close and save events
        this.$el.one('beforeClose', function(event) {
            event.stopPropagation();
        });
        this.$el.one('beforeSave', function(event) {
            event.stopPropagation();
        });
        
        this.currentData = {
            attributes: {},
            properties: {},
            customValues: {}
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
                                        if (formEl.data('transform') === 'selectmenu') {
                                            formEl.selectmenu('refresh');
                                        }
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

            this.$el.trigger('save', [this]);
        }
    },
    
    destroy: function() {
        if (this.attributesWidget != null) {
            this.attributesWidget.destroy();
        }
        
        if (this.cwrcWriter != null) {
            this.cwrcWriter.destroy();
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
        
        this.$el.remove();
    }
};

module.exports = DialogForm;
