'use strict';

var $ = require('jquery');
require('layout');
require('jquery-ui/ui/widgets/tabs');

var StructureTree = require('./modules/structureTree.js');
var EntitiesList = require('./modules/entitiesList.js')
var Validation = require('./modules/validation.js');
var Relations = require('./modules/relations.js');
var Selection = require('./modules/selection.js');
var ImageViewer = require('./modules/imageViewer.js');

/**
 * 
 * @param {Writer} writer
 * @param {Object} config
 * @param {Object} config.modules
 * @param {jQuery} config.container
 * @param {String} config.editorId
 * @param {String} config.name
 * @param {String} config.version
 * 
 * @returns
 */
function LayoutManager(writer, config) {
    this.w = writer;
    
    this.w.utilities.addCSS('css/cwrc12/jquery-ui.css');
    this.w.utilities.addCSS('css/layout-default-latest.css');
    
    var defaultModulesLayout = {
        west: ['structure','entities'],
        east: ['selection'],
        south: ['validation']
    }
    this.modulesLayout = config.modules || defaultModulesLayout;
    
    this.mode; // 'reader' or 'annotator'
    
    var container = config.container;
    
    var name = config.name;
    var editorId = config.editorId;
    
    var html = `
    <div class="cwrc cwrcLoadingMask"><div>Loading ${name}</div></div>
    
    <div class="cwrc cwrcWrapper">
        <div class="cwrc cwrcHeader ui-layout-north">
            <div class="headerParent ui-widget">
                <a class="titleLink" href="https://www.cwrc.ca" target="_blank">${name}</a>
                <div class="headerButtons"></div>
            </div>
        </div>`;
    
    html += addPanel(editorId, 'west', this.modulesLayout.west);
    
    html += `
        <div class="cwrc ui-layout-center">
            <div class="ui-layout-center ui-widget ui-widget-content">
                <textarea id="${editorId}" name="editor" class="tinymce"></textarea>
            </div>`;
    
    html += addPanel(editorId, 'south', this.modulesLayout.south);
    
    html += `
        </div>`;
    
    html += addPanel(editorId, 'east', this.modulesLayout.east);
    
    html += `
    </div>`;
    
    $(container).html(html);
    
    this.$wrapper = $(container).find('.cwrcWrapper').first();
    this.$loadingMask = $(container).find('.cwrcLoadingMask').first();
    this.$headerButtons = $(container).find('.headerButtons').first();
    
    var outerLayoutConfig = {
        defaults: {
            maskIframesOnResize: true,
            resizable: true,
            slidable: false,
            fxName: 'none'
        },
        north: {
            size: 35,
            spacing_open: 0,
            minSize: 35,
            maxSize: 60,
            closable: false
        }
    };
    
    if (this.modulesLayout.west !== undefined) {
        outerLayoutConfig.west = {
            size: 'auto',
            minSize: 325,
            onresize_end: function(region, pane, state, options) {
            }
        };
    }
    
    if (this.modulesLayout.east != undefined) {
        outerLayoutConfig.east = {
            size: 'auto',
            minSize: 325,
            initClosed: true,
            onresize_end: function(region, pane, state, options) {
            }
        };
    }
    
    this.$outerLayout = this.$wrapper.layout(outerLayoutConfig);
    
    var innerLayoutConfig = {
        defaults: {
            maskIframesOnResize: true,
            resizable: true,
            slidable: false,
            fxName: 'none'
        },
        center: {
            onresize_end: function(region, pane, state, options) {
                if (this.w.editor) {
                    var containerHeight = pane.height();
                    
                    var toolbars = pane[0].querySelectorAll('.mce-toolbar, .mce-statusbar, .mce-menubar');
                    var toolbarsLength = toolbars.length;
                    var barsHeight = 0;
                    for (var i = 0; i < toolbarsLength; i++) {
                        var toolbar = toolbars[i];
                        if (!toolbar.classList.contains('mce-sidebar-toolbar')) {
                            var barHeight = $(toolbar).height();
                            barsHeight += barHeight;
                        }
                    }
                    
                    var newHeight = containerHeight - barsHeight - 8;
                    this.w.editor.theme.resizeTo('100%', newHeight);
                }
            }.bind(this)
        }
    };
    
    if (this.modulesLayout.south !== undefined) {
        innerLayoutConfig.south = {
            size: 250,
            resizable: true,
            initClosed: true,
            activate: function(event, ui) {
                $.layout.callbacks.resizeTabLayout(event, ui);
            },
            onresize_end: function(region, pane, state, options) {
            }
        };
    }
    
    this.$innerLayout = this.$wrapper.find('.ui-layout-center').first().layout(innerLayoutConfig);
    
    for (var region in this.modulesLayout) {
        var modules = this.modulesLayout[region];
        if (Array.isArray(modules)) {
            modules.forEach(function(module) {
                initModule(editorId, this.w, module);
            }.bind(this));
            var $region = $(container).find('.ui-layout-'+region);
            $region.tabs({
                activate: function(event, ui) {
                    $.layout.callbacks.resizeTabLayout(event, ui);
                },
                create: function(event, ui) {
                    $region.parent().find('.ui-corner-all:not(button)').removeClass('ui-corner-all');
                }
            });
        } else {
            initModule(editorId, this.w, modules);
        }
    }
    
    
    var isLoading = false;
    var doneLayout = false;
    
    var onLoad = function() {
        isLoading = true;
        this.w.event('loadingDocument').unsubscribe(onLoad);
    }.bind(this);
    var onLoadDone = function() {
        isLoading = false;
        if (doneLayout) {
            this.$loadingMask.fadeOut();
            this.w.event('documentLoaded').unsubscribe(onLoadDone);
            doResize();
        }
    }.bind(this);
    var doResize = function() {
        this.$outerLayout.options.onresizeall_end = function() {
            doneLayout = true;
            if (isLoading === false) {
                this.$loadingMask.fadeOut();
                this.$outerLayout.options.onresizeall_end = null;
            }
        }.bind(this);
        this.$outerLayout.resizeAll(); // now that the editor is loaded, set proper sizing
    }.bind(this);
    
    this.w.event('loadingDocument').subscribe(onLoad);
    this.w.event('documentLoaded').subscribe(onLoadDone);
    this.w.event('writerInitialized').subscribe(doResize);
}

LayoutManager.prototype = {
    constructor: LayoutManager,
    
    showModule: function(moduleId) {
        for (var region in this.modulesLayout) {
            var modules = this.modulesLayout[region];
            if (Array.isArray(modules)) {
                for (var i = 0; i < modules.length; i++) {
                    if (modules[i] === moduleId) {
                        this.showRegion(region, i);
                        return;
                    }
                }
            } else {
                if (modules === moduleId) {
                    this.showRegion(region);
                    return;
                }
            }
        }
    },
    
    hideModule: function(moduleId) {
        for (var region in this.modulesLayout) {
            var modules = this.modulesLayout[region];
            if (Array.isArray(modules)) {
                for (var i = 0; i < modules.length; i++) {
                    if (modules[i] === moduleId) {
                        this.hideRegion(region);
                        return;
                    }
                }
            } else {
                if (modules === moduleId) {
                    this.hideRegion(region);
                    return;
                }
            }
        }
    },
    
    showRegion: function(region, tabIndex) {
        if (region === 'south') {
            this.$innerLayout.open('south');
            if (tabIndex !== undefined) {
                this.$innerLayout.panes[region].tabs('option', 'active', tabIndex);
            }
        } else {
            if (region === 'west') {
                this.$outerLayout.open('west');
            } else if (region === 'east') {
                this.$outerLayout.open('east');
            } else {
                return;
            }
            if (tabIndex !== undefined) {
                this.$outerLayout.panes[region].tabs('option', 'active', tabIndex);
            }
        }
    },
    
    hideRegion: function(region) {
        if (region === 'south') {
            this.$innerLayout.close('south');
        } else {
            if (region === 'west') {
                this.$outerLayout.close('west');
            } else if (region === 'east') {
                this.$outerLayout.close('east');
            } else {
                return;
            }
        }
    },
    
    showToolbar: function() {
        $('.mce-toolbar-grp', this.w.editor.getContainer()).first().show();
    },
    
    hideToolbar: function() {
        $('.mce-toolbar-grp', this.w.editor.getContainer()).first().hide();
    },
    
    resizeAll: function() {
        this.$outerLayout.resizeAll();
        this.$innerLayout.resizeAll();
    },

    getWrapper: function() {
        return this.$wrapper;
    },
    
    getHeaderButtonsParent: function() {
        return this.$headerButtons;
    }
}

function addPanel(idPrefix, panelRegion, panelConfig) {
    var html = '';
    if (panelConfig !== undefined) {
        if (Array.isArray(panelConfig)) {
            html += `
        <div class="cwrc tabs ui-layout-${panelRegion}">
            <ul>`;
            panelConfig.forEach(function(module) {
                var moduleTitle = module.charAt(0).toUpperCase()+module.substring(1);
                html += `
                <li><a href="#${idPrefix}-${module}">${moduleTitle}</a></li>`;
            });
            html += `
            </ul>
            <div class="ui-layout-content">`;
            panelConfig.forEach(function(module) {
                html += `
                <div id="${idPrefix}-${module}"></div>`;
            });
            html += `
            </div>
        </div>`;
        } else {
            var module = Array.isArray(panelConfig) ? panelConfig[0] : panelConfig;
            html += `
        <div id="${idPrefix}-${module}" class="cwrc ui-layout-${panelRegion}"></div>`;
        }
    }
    
    return html;
}

function initModule(idPrefix, writer, module) {
    var domId = idPrefix+'-'+module;
    
    switch(module) {
    case 'structure':
        return new StructureTree({writer: writer, parentId: domId});
        break;
    case 'entities':
        return new EntitiesList({writer: writer, parentId: domId});
        break;
    case 'relations':
        return new Relations({writer: writer, parentId: domId});
        break;
    case 'validation':
        return new Validation({writer: writer, parentId: domId});
        break;
    case 'selection':
        return new Selection({writer: writer, parentId: domId});
        break;
    case 'imageViewer':
        return new ImageViewer({writer: writer, parentId: domId});
        break;
    }
    
    return null;
}

module.exports = LayoutManager;
