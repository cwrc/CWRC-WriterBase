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

// private properties
var w;
var mode; // 'reader' or 'annotator'
var $outerLayout;
var $innerLayout;
var modulesLayout;

function LayoutManager(writer, config) {
    w = writer;
    
    // INIT
    w.utilities.addCSS('css/cwrc12/jquery-ui.css');
    w.utilities.addCSS('css/layout-default-latest.css');
    
    var defaultModulesLayout = {
        west: ['structure','entities'],
        east: ['selection'],
        south: ['validation']
    }
    
    modulesLayout = config.modules || defaultModulesLayout;
    
    var container = config.container;
    
    var name = config.name;
    var version = config.version;
    var editorId = config.editorId;
    
    var html = `
    <div id="cwrc_loadingMask" class="cwrc"><div>Loading ${name}</div></div>
    <div id="cwrc_wrapper" class="cwrc">
        <div id="cwrc_header" class="cwrc ui-layout-north">
            <div id="headerParent" class="ui-widget">
                <a id="titleLink" href="https://www.cwrc.ca" target="_blank">${name} v.${version}</a>
                <div id="headerButtons"></div>
            </div>
        </div>`;
    
    html += addPanel(editorId, 'west', modulesLayout.west);
    
    html += `
        <div id="cwrc_main" class="cwrc ui-layout-center">
            <div class="ui-layout-center ui-widget ui-widget-content">
                <textarea id="${editorId}" name="editor" class="tinymce"></textarea>
            </div>`;
    
    html += addPanel(editorId, 'south', modulesLayout.south);
    
    html += `
        </div>`;
    
    html += addPanel(editorId, 'east', modulesLayout.east);
    
    html += `
    </div>`;
    
    $(container).html(html);
    
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
    
    if (modulesLayout.west !== undefined) {
        outerLayoutConfig.west = {
            size: 'auto',
            minSize: 325,
            onresize_end: function(region, pane, state, options) {
            }
        };
    }
    
    if (modulesLayout.east != undefined) {
        outerLayoutConfig.east = {
            size: 'auto',
            minSize: 325,
            onresize_end: function(region, pane, state, options) {
            }
        };
    }
    
    $outerLayout = $('#cwrc_wrapper').layout(outerLayoutConfig);
    
    var innerLayoutConfig = {
        defaults: {
            maskIframesOnResize: true,
            resizable: true,
            slidable: false,
            fxName: 'none'
        },
        center: {
            onresize_end: function(region, pane, state, options) {
                if (w.editor) {
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
                    w.editor.theme.resizeTo('100%', newHeight);
                }
            }
        }
    };
    
    if (modulesLayout.south !== undefined) {
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
    
    $innerLayout = $('#cwrc_main').layout(innerLayoutConfig);
    
    for (var region in modulesLayout) {
        var modules = modulesLayout[region];
        if (Array.isArray(modules)) {
            modules.forEach(function(module) {
                initModule(editorId, w, module);
            });
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
            initModule(editorId, w, modules);
        }
    }
    
    
    var isLoading = false;
    var doneLayout = false;
    
    var onLoad = function() {
        isLoading = true;
        w.event('loadingDocument').unsubscribe(onLoad);
    };
    var onLoadDone = function() {
        isLoading = false;
        if (doneLayout) {
            $('#cwrc_loadingMask').fadeOut();
            w.event('documentLoaded').unsubscribe(onLoadDone);
            doResize();
        }
    };
    var doResize = function() {
        $outerLayout.options.onresizeall_end = function() {
            doneLayout = true;
            if (isLoading === false) {
                $('#cwrc_loadingMask').fadeOut();
                $outerLayout.options.onresizeall_end = null;
            }
            if (w.isReadOnly) {
                if ($('#annotateLink').length === 0) {
                    $('#headerLink').hide();
                    $('#headerButtons').append('<div id="annotateLink"><h2>Annotate</h2></div>');
                    
                    $('#annotateLink').click(function(e) {
                        if (mode === 'reader') {
                            // TODO check credentials
                            this.activateAnnotator();
                            $('h2', e.currentTarget).text('Read');
                        } else {
                            this.activateReader();
                            $('h2', e.currentTarget).text('Annotate');
                        }
                    }.bind(this));
                    
                    w.settings.hideAdvanced();
                    
                    this.activateReader();
                }
            }
        }.bind(this);
        $outerLayout.resizeAll(); // now that the editor is loaded, set proper sizing
    }.bind(this);
    
    w.event('loadingDocument').subscribe(onLoad);
    w.event('documentLoaded').subscribe(onLoadDone);
    w.event('writerInitialized').subscribe(doResize);
}

LayoutManager.prototype = {
    constructor: LayoutManager,
    
    showModule: function(moduleId) {
        for (var region in modulesLayout) {
            var modules = modulesLayout[region];
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
    
    showRegion: function(region, tabIndex) {
        if (region === 'south') {
            $innerLayout.open('south');
            if (tabIndex !== undefined) {
                $innerLayout.panes[region].tabs('option', 'active', tabIndex);
            }
        } else {
            if (region === 'west') {
                $outerLayout.open('west');
            } else if (region === 'east') {
                $outerLayout.open('east');
            } else {
                return;
            }
            if (tabIndex !== undefined) {
                $outerLayout.panes[region].tabs('option', 'active', tabIndex);
            }
        }
    },
    
    resizeAll: function() {
        $outerLayout.resizeAll();
        $innerLayout.resizeAll();
    },
    
    activateReader: function() {
        w.isAnnotator = false;
        $('.mce-toolbar-grp', w.editor.getContainer()).first().hide();
        
        w.editor.plugins.cwrc_contextmenu.disabled = true;
        
        mode = 'reader';
        
        this.resizeAll();
    },
    
    activateAnnotator: function() {
        w.isAnnotator = true;
        $('.mce-toolbar-grp', w.editor.getContainer()).first().show();
        
        w.editor.plugins.cwrc_contextmenu.disabled = false;
        w.editor.plugins.cwrc_contextmenu.entityTagsOnly = true;
        
        mode = 'annotator';
        
        this.resizeAll();
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
