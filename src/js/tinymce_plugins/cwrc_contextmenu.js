'use strict';

var tinymce = require('tinymce');
var $ = require('jquery');

tinymce.PluginManager.add('cwrc_contextmenu', function(editor) {
    var menu, items, contextmenuNeverUseNative = editor.settings.contextmenu_never_use_native;
    
    var isNativeOverrideKeyEvent = function (e) {
        return e.ctrlKey && !contextmenuNeverUseNative;
    };

    var isMacWebKit = function () {
        return tinymce.Env.mac && tinymce.Env.webkit;
    };

    /**
     * This takes care of a os x native issue where it expands the selection
     * to the word at the caret position to do "lookups". Since we are overriding
     * the context menu we also need to override this expanding so the behavior becomes
     * normalized. Firefox on os x doesn't expand to the word when using the context menu.
     */
    editor.on('mousedown', function (e) {
        if (isMacWebKit() && e.button === 2 && !isNativeOverrideKeyEvent(e)) {
            if (editor.selection.isCollapsed()) {
                editor.once('contextmenu', function (e) {
                    editor.selection.placeCaretAt(e.clientX, e.clientY);
                });
            }
        }
    });
    
    editor.plugins.cwrc_contextmenu = {
        disabled: false,
        entityTagsOnly: false
    };

    editor.on('contextmenu', function(e) {

        if (isNativeOverrideKeyEvent(e)) {
            return;
        }

        e.preventDefault();
        e.stopImmediatePropagation();

        if (editor.plugins.cwrc_contextmenu.disabled === true) {
            return;
        }

        var position = editor.writer.utilities.getOffsetPosition(editor.getContentAreaContainer());
        position.left += e.pageX;
        position.top += e.pageY;

        var $editorBody = $(editor.getDoc().documentElement);
        var editorScrollTop = $editorBody.scrollTop();
        var editorScrollLeft = $editorBody.scrollLeft();

        position.left = position.left - editorScrollLeft;
        position.top = position.top - editorScrollTop;

        e.pageX = position.left;
        e.pageY = position.top;

        editor.writer.tagMenu.show(e, undefined, true);
    });
});
