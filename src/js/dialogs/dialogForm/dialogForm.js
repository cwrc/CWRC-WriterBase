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
            role: 'cancel',
            click: $.proxy(function() {
                this.$el.trigger('beforeCancel');
                this.$el.trigger('beforeClose');
                this.$el.dialog('close');
            }, this)
        },{
            text: 'Ok',
            role: 'ok',
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
    $('[data-type="attributes"]', this.$el).first().each(function(index, el) {
        this.attributesWidget = new AttributeWidget({writer: this.w, $parent: this.$el, $el: $(el)});
        this.attWidgetInit = false;
    }.bind(this));
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
                        data[dataKey][mapping] = val;
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

DialogForm.populateForm = function(dialogInstance) {
    var data = dialogInstance.currentData;
    $('[data-type]', dialogInstance.$el)
        .filter(function(index, el) {
            return $(el).parents('.cwrcWrapper').length === 1; // don't include form elements from note entity children
        })
        .each(function(index, el) {
            var formEl = $(this);
            var type = formEl.data('type');
            if (type === 'attributes') {
                var showWidget = dialogInstance.attributesWidget.setData(data.attributes);
                if (showWidget) {
                    dialogInstance.attributesWidget.expand();
                }
            } else {
                var mapping = formEl.data('mapping');
                if (mapping !== undefined) {
                    var value;
                    
                    var isCustom = mapping.indexOf('custom.') === 0;
                    var isProperty = mapping.indexOf('prop.') === 0;
                    if (isCustom) {
                        mapping = mapping.replace(/^custom\./, '');
                        value = data.customValues[mapping];
                    } else if (isProperty) {
                        mapping = mapping.replace(/^prop\./, '');
                        value = data.properties[mapping];
                    } else {
                        value = data.attributes[mapping];
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
                            case 'label':
                                formEl.html(value);
                                break;
                        }
                    }
                }
            }
        });
}

function initAttributeWidget(dialogInstance, config) {
    var tag;
    if (config.entry) {
        tag = config.entry.tag
    } else {
        tag = dialogInstance.w.schemaManager.mapper.getParentTag(dialogInstance.type);
    }
    var atts = dialogInstance.w.schemaManager.getAttributesForTag(tag);
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
                    formEl.find('input').prop('checked', false); // reset all
                    formEl.find('[data-default]').prop('checked', true); // set default if it exists
                    if (formEl.data('transform') === 'buttonset') {
                        $('input', formEl).button('refresh');
                    }
                    break;
                case 'textbox':
                case 'select':
                    formEl.val('');
                    if (formEl.data('transform') === 'selectmenu') {
                        formEl.selectmenu('refresh');
                    }
                    break;
                case 'label':
                    formEl.empty();
                    break;
                case 'hidden':
                    // do nothing for hidden
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

        var mappedProps = this.w.schemaManager.mapper.getMappedProperties(this.type);
        
        if (this.mode === DialogForm.ADD) {
            // copy properties over
            $.extend(this.currentData.properties, config.properties);
            // map property values to attributes
            mappedProps.forEach((propName) => {
                var propVal = this.currentData.properties[propName];
                var propMapping = this.w.schemaManager.mapper.getAttributeForProperty(this.type, propName);
                if (propVal !== undefined && propMapping !== undefined) {
                    this.currentData.attributes[propMapping] = propVal;
                }
            });
        } else if (this.mode === DialogForm.EDIT) {
            this.currentId = config.entry.getId();
            
            // clone attributes and custom values, then unescaping the values
            var attributes = Object.assign({}, config.entry.getAttributes());
            for (var key in attributes) {
                attributes[key] = this.w.utilities.unescapeHTMLString(attributes[key]);
            }
            var customValues = JSON.parse(JSON.stringify(config.entry.getCustomValues()));
            for (var key in customValues) {
                var val = customValues[key];
                if ($.isArray(val)) {
                    for (var i = 0; i < val.length; i++) {
                        customValues[key][i] = this.w.utilities.unescapeHTMLString(val[i]);
                    }
                } else if ($.isPlainObject(val)) {
                    for (var subkey in val) {
                        customValues[key][subkey] = this.w.utilities.unescapeHTMLString(val[subkey]);
                    }
                } else {
                    customValues[key] = this.w.utilities.unescapeHTMLString(val);
                }
            }
            
            this.currentData.attributes = attributes;
            this.currentData.customValues = customValues;
            this.currentData.properties = {
                tag: config.entry.tag
            }
            // copy mapped properties to currentData
            mappedProps.forEach((propName) => {
                this.currentData.properties[propName] = config.entry[propName];
            });
        }

        DialogForm.populateForm(this);
        
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

            // check to see if the control has been instantiated
            var uiInstance = Object.keys(formEl.data()).find((key) => {
                // instance stored in key that starts with "ui"
                return key.indexOf('ui') === 0;
            })

            if (uiInstance) {
                var transform = formEl.data('transform');
                switch (transform) {
                    case 'buttonset':
                        formEl.controlgroup('destroy');
                        break;
                    case 'accordion':
                        formEl.accordion('destroy');
                        break;
                    case 'selectmenu':
                        formEl.selectmenu('destroy');
                        break;
                }
            }
        });
        
        this.$el.remove();
    }
};

module.exports = DialogForm;
