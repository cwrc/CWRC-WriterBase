'use strict';

var $ = require('jquery');

require('jquery-ui/ui/widgets/dialog');
require('jquery-ui/ui/widgets/progressbar');
    
function LoadingIndicator(writer, parentEl) {
    var w = writer;
    
    var $loadingIndicator = $(''+
    '<div class="loadingIndicatorDialog">'+
        '<div class="progressBar"><div class="progressLabel"></div></div>'+
    '</div>').appendTo(parentEl)
    
    $loadingIndicator.dialog({
        title: 'CWRC-Writer',
        modal: true,
        resizable: false,
        closeOnEscape: false,
        height: 160,
        width: 300,
        position: { my: 'center', at: 'center', of: w.layoutManager.getContainer() },
        buttons: {},
        autoOpen: false,
        open: function(event, ui) {
            $('.ui-dialog-titlebar-close', ui.dialog).hide();
        }
    });
    
    var progressBar = $loadingIndicator.find('.progressBar');
    progressBar.progressbar({
        value: 0
    });
    var progressLabel = $loadingIndicator.find('.progressLabel');
    
    w.event('loadingDocument').subscribe(function() {
        w.dialogManager.show('loadingindicator');
        progressLabel.text('Loading Document');
        progressBar.progressbar('value', 5);
    });
    w.event('loadingSchema').subscribe(function() {
        w.dialogManager.show('loadingindicator');
        progressLabel.text('Loading Schema');
        progressBar.progressbar('value', 10);
    });
    w.event('processingDocument').subscribe(function(percentComplete) {
        var val = percentComplete === undefined ? 50 : percentComplete;
        progressLabel.text('Processing Document');
        progressBar.progressbar('value', val);
    });
    w.event('documentLoaded').subscribe(function(success, docBody) {
        progressBar.progressbar('value', 100);
        $loadingIndicator.dialog('close');
    });
    w.event('schemaLoaded').subscribe(function() {
        progressLabel.text('Schema Loaded');
    });
    
    w.event('savingDocument').subscribe(function() {
        w.dialogManager.show('loadingindicator');
        progressLabel.text('Saving Document');
        progressBar.progressbar('value', 5);
    });

    w.event('documentSaved').subscribe(function(success) {
        progressBar.progressbar('value', 100);
        if (success !== true) {
            progressLabel.text('Error Saving Document');
            $loadingIndicator.dialog('option', 'buttons', {
                'Ok': function() {
                    $loadingIndicator.dialog('close');
                }
            });
        } else {
            $loadingIndicator.dialog('close');
            // FIXME need to close immediately because of problems if there's another modal showing
//            progressLabel.text('Document Loaded');
//            $loadingIndicator.fadeOut(1000, function() {
//                $loadingIndicator.dialog('close');
//            });
        }
    });



    return {
        setText: function(text) {
            progressLabel.text(text);
        },
        /**
         * Set the progress value.
         * @param {Number|Boolean} percent If false, the progress is indeterminate
         */
        setValue: function(percent) {
            progressBar.progressbar('value', percent);
        },
        show: function(config) {
            $loadingIndicator.dialog('open');
        },
        hide: function() {
            $loadingIndicator.dialog('close');
        },
        destroy: function() {
            progressBar.progressbar('destroy');
            $loadingIndicator.dialog('destroy');
        }
    };
};

module.exports = LoadingIndicator;
