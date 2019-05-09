'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/accordion');

function AttributeWidget(config) {
    this.w = config.writer;
    this.$el = config.$el; // the el to add the attribute widget to
    this.$parent = config.$parent; // the parent form (optional)
    
    this.showSchemaHelp = config.showSchemaHelp === true ? true : false;
    var schemaHelpEl = '';
    if (this.showSchemaHelp) {
        schemaHelpEl = '<div class="schemaHelp"></div>';
    }
    
    this.mode = AttributeWidget.ADD;
    
    this.isDirty = false;
    
    this.$el.addClass('attributeWidget');
    this.$el.append(''+
    '<div class="attributeSelector">'+
        '<h2>Attributes</h2>'+
        '<ul></ul>'+
    '</div>'+
    '<div class="attsContainer">'+
    '</div>'+
    schemaHelpEl);
    
    if (this.$parent !== undefined) {
        // add listeners for other form elements
        $('[data-mapping]', this.$parent).each($.proxy(function(index, el) {
            var formEl = $(el);
            var type = formEl.data('type');
            var mapping = formEl.data('mapping');
            var isCustom = mapping.indexOf('custom.') === 0;
            if (!isCustom) {
                var changeEl;
                if (type === 'radio') {
                    changeEl = $('input', formEl);
                } else if (type === 'textbox' || type === 'select') {
                    changeEl = formEl;
                }
                if (changeEl !== undefined) {
                    changeEl.change($.proxy(function(mapping, e) {
                        var dataObj = {};
                        dataObj[mapping] = $(e.target).val();
                        this.setData(dataObj);
                    }, this, mapping));
                }
            }
        }, this));
    }
}

AttributeWidget.ADD = 0;
AttributeWidget.EDIT = 1;

AttributeWidget.prototype = {
    constructor: AttributeWidget,
    
    buildWidget: function(atts, previousVals, tag) {
        previousVals = previousVals || {};
        
        $('.attributeSelector ul, .attsContainer, .schemaHelp', this.$el).empty();
        this.isDirty = false;
        
        if (this.showSchemaHelp && tag !== undefined) {
            var helpText = this.w.schemaManager.getDocumentationForTag(tag);
            if (helpText != '') {
                $('.schemaHelp', this.$el).html('<h3>'+tag+' Documentation</h3><p>'+helpText+'</p>');
            }
        }
        
        atts.sort(function(a, b) {
            if (a.name > b.name) {
                return 1;
            } else if (a.name < b.name) {
                return -1;
            }
            return 0;
        });

        var disallowedAttributes = this.w.converter.reservedAttributes;
        
        // build atts
        var attsString = '';
        var attributeSelector = '';
        var att, currAttString;
        var isRequired = false;
        for (var i = 0; i < atts.length; i++) {
            att = atts[i];
            currAttString = '';
            isRequired = att.required;
            
            if (disallowedAttributes[att.name] !== true) {
                var displayName = att.name;
                if (att.fullName !== '') {
                    displayName += ' ('+att.fullName+')';
                }
                var display = 'block';
                var requiredClass = isRequired ? ' required' : '';
                if (this.mode == AttributeWidget.EDIT && previousVals[att.name]) {
                    display = 'block';
                    attributeSelector += '<li data-name="'+att.name+'" class="selected'+requiredClass+'">'+displayName+'</li>';
                } else {
                    display = 'none';
                    attributeSelector += '<li data-name="'+att.name+'" class="'+requiredClass+'">'+displayName+'</li>';
                }
                currAttString += '<div data-name="form_'+att.name+'" style="display:'+display+';"><label>'+displayName+'</label>';
                if (att.documentation != '') {
                    currAttString += '<ins class="ui-icon ui-icon-help" title="'+att.documentation+'">&nbsp;</ins>';
                }
                currAttString += '<br/>';
                if (this.mode == AttributeWidget.EDIT) att.defaultValue = previousVals[att.name] || '';
                // TODO add list support
//                if ($('list', attDef).length > 0) {
//                    currAttString += '<input type="text" name="'+att.name+'" value="'+att.defaultValue+'"/>';
//                } else if ($('choice', attDef).length > 0) {
                if (att.choices && att.choices.length > 0) {
                    currAttString += '<select name="'+att.name+'">';
                    var attVal, selected;
                    for (var j = 0; j < att.choices.length; j++) {
                        attVal = att.choices[j];
                        selected = att.defaultValue == attVal ? ' selected="selected"' : '';
                        currAttString += '<option value="'+attVal+'"'+selected+'>'+attVal+'</option>';
                    }
                    currAttString += '</select>';
//                } else if ($('ref', attDef).length > 0) {
//                    currAttString += '<input type="text" name="'+att.name+'" value="'+att.defaultValue+'"/>';
                } else {
                    currAttString += '<input type="text" name="'+att.name+'" value="'+att.defaultValue+'"/>';
                }
                if (isRequired) currAttString += ' <span class="required">*</span>';
                currAttString += '</div>';
                
                attsString += currAttString;
            }
        }
        
        $('.attributeSelector ul', this.$el).html(attributeSelector);
        $('.attsContainer', this.$el).html(attsString);
        
        $('.attributeSelector li', this.$el).click(function() {
            var name = $(this).data('name').replace(/:/g, '\\:');
            var div = $('[data-name="form_'+name+'"]', this.$el);
            $(this).toggleClass('selected');
            if ($(this).hasClass('selected')) {
                div.show();
            } else {
                div.hide();
            }
        });
        
        $('ins', this.$el).tooltip({
            classes: {
                'ui-tooltip': 'cwrc-tooltip'
            }
        });
        
        $('input, select, option', this.$el).change(function(event) {
            this.isDirty = true;
        });
//        .keyup(function(event) {
//            if (event.keyCode == '13') {
//                event.preventDefault();
//                if (this.isDirty) t.result();
//                else t.cancel(); 
//            }
//        });
        
        $('select, option', this.$el).click(function(event) {
            this.isDirty = true;
        });
    },
    reset: function() {
        $('.attributeSelector li', this.$el).each(function(el, index) {
            $(this).removeClass('selected');
            var name = $(this).data('name').replace(/:/g, '\\:');
            var div = $('[data-name="form_'+name+'"]', this.$el);
            div.hide();
        });
        $('.attsContainer input, .attsContainer select', this.$el).val('');
    },
    setData: function(data) {
        var wasDataSet = false;
        
        for (var key in data) {
            var val = data[key];
            var li = $('.attributeSelector li[data-name="'+key+'"]', this.$el);
            if (li.length === 1) {
                li.addClass('selected');
                var div = $('[data-name="form_'+key+'"]', this.$el);
                $('input, select', div).val(val);
                div.show();
                wasDataSet = true;
            } else {
                console.warn('attributeWidget: no attribute for',key);
            }
        }
        
        return wasDataSet;
    },
    
    /**
     * Collects the data from the attribute widget and performs validation.
     * @returns {Object|undefined} Returns undefined if invalid
     */
    getData: function() {
        var attributes = {};
        $('.attsContainer > div:visible', this.$el).children('input[type!="hidden"], select').each(function(index, el) {
            var val = $(this).val();
            if (val !== '') { // ignore blank values
                attributes[$(this).attr('name')] = val;
            }
        });
        
        // validation
        var invalid = [];
        $('.attsContainer span.required', this.$el).parent().children('input[type!="hidden"], select').each(function(index, el) {
            var entry = attributes[$(this).attr('name')];
            if (entry === undefined || entry == '') {
                invalid.push($(this).attr('name'));
            }
        });
        if (invalid.length > 0) {
            for (var i = 0; i < invalid.length; i++) {
                var name = invalid[i];
                $('.attsContainer *[name="'+name+'"]', this.$el).css({borderColor: 'red'}).keyup(function(event) {
                    $(this).css({borderColor: '#ccc'});
                });
            }
            return attributes; // still return values even if invalid (for now)
        }
        
        return attributes;
    },
    
    expand: function() {
        this.$el.parent('[data-transform="accordion"]').accordion('option', 'active', 0);
    },
    collapse: function() {
        this.$el.parent('[data-transform="accordion"]').accordion('option', 'active', false);
    },
    destroy: function() {
        try {
            $('ins', this.$el).tooltip('destroy');
        } catch (e) {
            if (console) console.log('error destroying tooltip');
        }
    }
};

module.exports = AttributeWidget;