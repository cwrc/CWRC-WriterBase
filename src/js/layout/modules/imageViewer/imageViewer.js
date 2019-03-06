'use strict';

var $ = require('jquery');
require('jquery-ui');
var OpenSeaDragon = require('openseadragon');

function ImageViewer(config) {
    var w = config.writer;
    var id = config.parentId+'_imageViewer';
    var tagName = config.tag || 'pb'; // page break element name
    var attrName = config.attribute || 'facs'; // attribute that stores the image URL
    
    var osd; // openseadragon instance
    
    $('#'+config.parentId).append(''+
        '<div id="'+id+'" class="imageViewer">'+
            '<div class="toolbar">'+
                '<div class="navigation">'+
                    '<span id="'+id+'_prev" class="button prev" />'+
                    '<span id="'+id+'_next" class="button next" />'+
                    '<span class="pageInfo"><input type="text" class="currPage" /> / <span class="totalPages" /></span>'+
                '</div>'+
                '<div class="zoom">'+
                    '<span id="'+id+'_zoomIn" class="button zoomIn" />'+
                    '<span id="'+id+'_zoomOut" class="button zoomOut" />'+
                    '<span id="'+id+'_home" class="button home" />'+
                '</div>'+
            '</div>'+
            '<div id="'+id+'_osd" class="image"></div>'+
        '</div>');
    $('#'+config.parentId).css('overflow', 'hidden');
    
    var $parent = $('#'+id);
    
    var $pageBreaks;
    var currentIndex = -1;
    
    var ignoreScroll = false;
    
    w.event('loadingDocument').subscribe(function() {
        iv.reset();
    });
    // ensure page break tags are display block
    var cssHack = function() {
        var rules = $(w.editor.getDoc()).find('#schemaRules')[0];
        if (rules == undefined) {
            setTimeout(cssHack, 50);
        } else {
            rules.sheet.insertRule('*[_tag="'+tagName+'"] { display: block; }', 0);
        }
    }
    w.event('documentLoaded').subscribe(function(success, body) {
        if (success) {
            processDocument(body, true);
            setTimeout(cssHack, 50);
        }
    });
    w.event('contentChanged').subscribe(function() {
        processDocument(w.editor.getDoc(), false);
    });
    w.event('writerInitialized').subscribe(function() {
        $(w.editor.getDoc()).scroll(handleScroll);
    });
    
    /**
     * @lends ImageViewer.prototype
     */
    var iv = {};
    
    iv.reset = function() {
        $pageBreaks = null;
        currentIndex = -1;
        
        osdReset();
    };
    
    iv.destroy = function() {
        osd.destroy();
        osd = null;
    };
    
    function osdReset() {
        osd.drawer.clear();
        osd.close();
        osd.tileSources = []; // hack to remove any previously added images
    }
    
    function processDocument(doc, docLoaded) {
        setMessage('');
        
        $pageBreaks = $(doc).find('*[_tag='+tagName+']');
        
        if ($pageBreaks.length === 0) {
            hideViewer();
        } else {
            $pageBreaks.each(function(i, el) {
                if (i == 0) $(el).hide();
                else $(el).show();
            });
            
            var bogusUrls = 0;
            var tileSources = [];
            $pageBreaks.each(function(index, el) {
                var url = $(el).attr(attrName);
                if (url === undefined || url === '') {
                    bogusUrls++;
                }
                tileSources.push({
                    type: 'image',
                    url: url
                });
            });
            
            var needUpdate = docLoaded || tileSources.length !== osd.tileSources.length;
            if (!needUpdate) {
                for (var i = 0; i < tileSources.length; i++) {
                    if (tileSources[i].url !== osd.tileSources[i].url) {
                        needUpdate = true;
                        break;
                    }
                }
            }
            
            if (needUpdate) {
                osd.open(tileSources);
                
                if (bogusUrls === tileSources.length) {
                    w.layoutManager.hideModule('imageViewer');
                } else {
                    w.layoutManager.showModule('imageViewer');
                }
                                
                $parent.find('.totalPages').html($pageBreaks.length);
                currentIndex = -1;
                handleScroll();
            }
        }
    }
    
    function loadPage(index, doScroll) {
        if (index >= 0 && index < $pageBreaks.length) {
            currentIndex = index;
            $parent.find('.currPage').val(currentIndex+1);
            
            if (!ignoreScroll && doScroll) {
                ignoreScroll = true;
                var pb = $pageBreaks.get(currentIndex);
                if (currentIndex === 0) $(pb).show();
                pb.scrollIntoView();
                if (currentIndex === 0) $(pb).hide();
            }
        }
    }
    
    function handleScroll() {
        if (!ignoreScroll) {
            var ifr = $('iframe', w.editor.getContainer());
            var scrollHeight = ifr.height();
            var el = w.editor.getDoc().scrollingElement;
            var scrollTop = el.scrollTop;
            var scrollBottom = scrollTop+scrollHeight;

            var index = -1;
            $pageBreaks.each(function(i, el) {
                var y = $(el).offset().top;
                if (y >= scrollTop && y < scrollBottom) {
                    index = i;
                    return false;
                }
            });
            
            ignoreScroll = true;
            osd.goToPage(index);
        }
        ignoreScroll = false;
    }
    
    function hideViewer() {
        var msg = 'Provide page breaks ('+tagName+') with '+attrName+' attributes \n pointing to image URLs in order to \n display the corresponding images/scans \n for pages in this doument.';
        setMessage(msg);
        w.layoutManager.hideModule('imageViewer');
    }
    
    function resizeImage() {
        var container = $parent.parent();
        var toolbarHeight = 30;
        var cw = container.width();
        var ch = container.height()-toolbarHeight;
        
        var img = $parent.find('.image img');
        var iw = img.width();
        var ih = img.height();
        
        var cratio = ch/cw;
        var iratio = ih/iw;
        
        var nh, nw;
        if (iratio >= 1) { // portrait
            if (iratio > cratio) {
                nh = ch;
                nw = nh / iratio;
            } else {
                nw = cw;
                nh = nw * iratio;
            }
        } else { // landscape
        }
        img.css('height', nh).css('width', nw).css('display', 'block');
    }
    
    function setMessage(msg) {
        osd.drawer.clear();
        osd._showMessage(msg);
    }
    
    $parent.find('.image img').on('load', function() {
        resizeImage();
    });
    
    $parent.find('.currPage').keyup(function(e) {
        if (e.keyCode == 13) { // enter key
            var val = parseInt($(this).val());
            if (!isNaN(val)) {
                loadPage(val-1, true);
            }
        }
    });
    
    osd = OpenSeaDragon({
        id: id+'_osd',
        sequenceMode: true,
        autoHideControls: false,
        showFullPageControl: false,
        previousButton: id+'_prev',
        nextButton: id+'_next',
        zoomInButton: id+'_zoomIn',
        zoomOutButton: id+'_zoomOut',
        homeButton: id+'_home'
    });
    
    osd.addHandler('open-failed', function(event) {
        var msg = event.message;
        if (event.source.url === true) {
            msg = 'No URI found for @'+attrName+'.';
        }
        setMessage(msg);
    });
    
    osd.addHandler('reset-size', function(event) {
        if (event.contentFactor == 0) {
            setMessage('No URI found for @'+attrName+'.');
        }
    });
    
    osd.addHandler('page', function(event) {
        loadPage(event.page, true);
    });
    
    return iv;
}

module.exports = ImageViewer;