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
    '.imageViewer .toolbar { display: table-row; height: 25px; text-align: center; }'+
    '.imageViewer .pageInfo { display: inline-block; margin: 0 5px; }'+
    '.imageViewer input.currPage { width: 20px; text-align: right; }'+
    '.imageViewer .msg { display: table-row; height: 25px; text-align: center; margin-top: 10px; }'+
    '.imageViewer .image { display: table-row; }';
    
    var styleEl = document.createElement("style");
    styleEl.type = "text/css";
    styleEl.innerHTML = styles;
    $(document.head).append(styleEl);
    
    $('#'+config.parentId).append(''+
        '<div id="'+id+'" class="imageViewer">'+
            '<div class="toolbar">'+
                '<button class="prev">&#8592;</button><span class="pageInfo"><input type="text" class="currPage" /> / <span class="totalPages" /></span><button class="next">&#8594;</button>'+
            '</div>'+
            '<div id="'+id+'_msg" class="msg"></div>'+
            '<div id="'+id+'_osd" class="image"></div>'+
        '</div>');
    $('#'+config.parentId).css('overflow', 'hidden');
    
    var $parent = $('#'+id);
    var pageBreaks;
    var currentIndex = -1;
    
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
        pageBreaks = null;
        currentIndex = -1;
    }
    
    function processDocument(doc) {
        pageBreaks = $(doc).find('*[_tag='+tagName+']');
        if (pageBreaks.length == 0) {
            $('#'+id+'_msg').show().html('No '+tagName+' elements found.');
            osd.close();
        } else {
            $('#'+id+'_msg').hide();
            $parent.find('.totalPages').html(pageBreaks.length);
            iv.loadPage(0, true);
        }
    }
    
    function handleScroll() {
        var ifr = $('iframe', w.editor.getContainer());
        var scrollHeight = ifr.height();
        var el = w.editor.getDoc().scrollingElement;
        var scrollTop = el.scrollTop;
        var scrollBottom = scrollTop+scrollHeight;
        
        var index = -1;
        pageBreaks.each(function(i, el) {
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
    
    function setImage(url) {
        osd.addSimpleImage({
            url: url
        });
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
        if (index >= 0 && index < pageBreaks.length) {
            if (index != currentIndex) {
                currentIndex = index;
                $parent.find('.currPage').val(index+1);
                var pageBreak = $(pageBreaks.get(index));
                var url = pageBreak.attr(attrName);
                setImage(url);
                
                if (index == 0) {
                    $parent.find('button.prev').button('disable');
                } else {
                    $parent.find('button.prev').button('enable')
                }
                if (index == pageBreaks.legnth-1) {
                    $parent.find('button.next').button('disable');
                } else {
                    $parent.find('button.next').button('enable');
                }
                
                if (!external) {
                    pageBreak[0].scrollIntoView();
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
    
    $parent.find('.image img').on('load', function() {
        iv.resizeImage();
    });
    
    $parent.find('button.prev').button().click(iv.prevPage);
    $parent.find('button.next').button().click(iv.nextPage);
    
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
        prefixUrl: w.cwrcRootUrl+'img/osd/'
    });
    
    
    return iv;
}


module.exports = ImageViewer;