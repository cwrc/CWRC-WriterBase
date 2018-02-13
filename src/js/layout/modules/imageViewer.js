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
    
    var styles = ''+
    '.imageViewer { display: table; height: 100%; width: 100%; }'+
    '.imageViewer .toolbar { display: table-row; height: 32px; }'+
    '.imageViewer .image { display: table-row; height: 100%; }'+
    '.imageViewer .toolbar .navigation { float: left; }'+
    '.imageViewer .toolbar .zoom { float: right; }'+
    '.imageViewer .button { display: inline-block; width: 16px; height: 16px; padding: 4px 8px; margin: 3px; background-color: #eee; border: 1px solid #ccc; border-radius: 3px; background-repeat: no-repeat; background-position: center; }'+
    '.imageViewer .button:hover { cursor: pointer; background-color: #ccc; border: 1px solid #aaa; }'+
    '.imageViewer .pageInfo { display: inline-block; position: relative; float: right; margin: 5px 3px; }'+
    '.imageViewer input.currPage { height: 16px; width: 20px; text-align: right; }'+
    '.imageViewer .prev { background-image: url('+w.cwrcRootUrl+'img/arrow_left.png) }'+
    '.imageViewer .next { background-image: url('+w.cwrcRootUrl+'img/arrow_right.png) }'+
    '.imageViewer .zoomIn { background-image: url('+w.cwrcRootUrl+'img/magnifier_zoom_in.png) }'+
    '.imageViewer .zoomOut { background-image: url('+w.cwrcRootUrl+'img/magnifier_zoom_out.png) }'+
    '.imageViewer .home { background-image: url('+w.cwrcRootUrl+'img/house.png) }'+
    '.imageViewer .openseadragon-message { white-space: pre; }';
    
    var styleEl = document.createElement("style");
    styleEl.type = "text/css";
    styleEl.innerHTML = styles;
    $(document.head).append(styleEl);
    
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
            processDocument(body);
            setTimeout(cssHack, 50);
        }
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
        
        osd.drawer.clear();
        osd.close();
        osd.tileSources = []; // hack to remove any previously added images
    }
    
    function processDocument(doc) {
        $pageBreaks = $(doc).find('*[_tag='+tagName+']['+attrName+']');
        if ($pageBreaks.length === 0) {
            var msg = 'Provide page breaks ('+tagName+') with '+attrName+' attributes \n pointing to image URLs in order to \n display the corresponding images/scans \n for pages in this doument.';
            iv.setMessage(msg);
            w.layoutManager.hideModule('imageViewer');
        } else {
            iv.setMessage('');
            var tileSources = [];
            $pageBreaks.each(function(index, el) {
                var url = $(el).attr(attrName);
                if (url === undefined || url === '') {
                    // no url handled by reset-size listener
                }
                tileSources.push({
                    type: 'image',
                    url: url
                });
            });
            
            $parent.find('.totalPages').html($pageBreaks.length);
            $parent.find('.currPage').val(1);
            currentIndex = 0;
            
            w.layoutManager.showModule('imageViewer');
            osd.open(tileSources, 0);
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
               if (y > scrollTop && y < scrollBottom) {
                   index = i;
                   return false;
               }
            });
            
            if (index != -1) {
                iv.loadPage(index, true);
            }
        }
        ignoreScroll = false;
    }
    
    iv.resizeImage = function() {
        var container = $parent.parent();
        var cw = container.width();
        var ch = container.height()-30;
        
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
    
    /**
     * load the specified page
     * @param int index
     * @param boolean external did the request get triggered from outside this module? (e.g. from scrolling)
     */
    iv.loadPage = function(index, external) {
        if (index >= 0 && index < $pageBreaks.length) {
            if (index != currentIndex) {
                currentIndex = index;
                
                osd.goToPage(index);
                if (!external) {
                    ignoreScroll = true; // make sure scrollIntoView doesn't re-trigger loadPage
                    $pageBreaks.get(index).scrollIntoView();
                }
            }
        }
    }
    
    iv.prevPage = function() {
        iv.loadPage(currentIndex-1, false);
    }
    
    iv.nextPage = function() {
        iv.loadPage(currentIndex+1, false);
    }
    
    iv.setMessage = function(msg) {
        osd.drawer.clear();
        osd._showMessage(msg);
    }
    
    $parent.find('.image img').on('load', function() {
        iv.resizeImage();
    });
    
    $parent.find('.currPage').keyup(function(e) {
        if (e.keyCode == 13) { // enter key
            var val = parseInt($(this).val());
            if (!isNaN(val)) {
                iv.loadPage(val-1, false);
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
        iv.setMessage(msg);
    });
    
    osd.addHandler('reset-size', function(event) {
        if (event.contentFactor == 0) {
            iv.setMessage('No URI found for @'+attrName+'.');
        }
    });
    
    osd.addHandler('page', function(event) {
        $parent.find('.currPage').val(event.page+1);
    });
    
    
    return iv;
}


module.exports = ImageViewer;