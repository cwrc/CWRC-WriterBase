import $ from 'jquery';
import tinymce, { TinyMCE, Editor } from 'tinymce/tinymce';
import { Editor_CWRC } from '../@types/types';

declare global {
  interface Window {
    tinymce: TinyMCE;
  }
}

window.tinymce = tinymce;
import 'tinymce/icons/default';
import 'tinymce/themes/silver';
import 'tinymce/plugins/paste';

//TODO: Reassess plugins on tinymce 5.0
// import './tinymce_plugins/cwrc_path.js';
import './tinymce_plugins/treepaste.js';
import './tinymce_plugins/prevent_delete.js';

import { addIconPack } from './tinymce/tinymceIconPack';
import { configureToolbar, toolbarOptions } from './tinymce/tinymceToolbar';

interface TinymceWrapperConfig {
  writer: any;
  editorId: string;
  layoutContainerId: string;
  buttons1: string[];
  buttons2?: string[];
  buttons3?: string[];
}

function TinymceWrapper() {}

TinymceWrapper.init = function ({
  writer,
  editorId,
  layoutContainerId,
  buttons1,
  buttons2,
  buttons3,
}: TinymceWrapperConfig) {
  tinymce.baseURL = `${writer.cwrcRootUrl}/js`; // need for skin
  tinymce.init({
    selector: `#${editorId}`,
    ui_container: `#${layoutContainerId}`,

    // skin_url: `${writer.cwrcRootUrl}css/tinymce/skins/ui/oxide`,
    skin_url: window.matchMedia('(prefers-color-scheme: dark)').matches
      ? `${writer.cwrcRootUrl}css/tinymce/skins/ui/oxide-dark`
      : `${writer.cwrcRootUrl}css/tinymce/skins/ui/oxide`,

    height: '100%',
    width: '100%',
    // content_css: `${writer.cwrcRootUrl}css/editor.css`,
    content_css: window.matchMedia('(prefers-color-scheme: dark)').matches
      ? [
          `${writer.cwrcRootUrl}css/tinymce/skins/content/dark/content.min.css`,
          `${writer.cwrcRootUrl}css/editor.css`,
        ]
      : [
          `${writer.cwrcRootUrl}css/tinymce/skins/content/writer/content.min.css`,
          `${writer.cwrcRootUrl}css/editor.css`,
        ],

    doctype:
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
    element_format: 'xhtml',

    forced_root_block: writer.schemaManager.getBlockTag(),
    keep_styles: false, // false, otherwise tinymce interprets our spans as style elements

    paste_postprocess: (plugin: any, args: any) => {
      writer.tagger.processNewContent(args.node);
      setTimeout(() => {
        // need to fire contentPasted here, after the content is actually within the document
        writer.event('contentPasted').publish();
      }, 0);
    },

    valid_elements: '*[*]', // allow everything

    // ? TRY TO IMPLEMENT PLUGIN SCHEMA TAG AS A WRAPPER FOR MENUITEM
    // ? PERHAPS IT IS BETTER TO HAVE THE RIBBON OUTSIDE OF TINYMCE (USING REACT)

    //TODO: Reassess plugins on tinymce 5.0
    plugins: [
      // 'cwrcpath',  //!This was broken before the upgrade
      'preventdelete', //TODO: need to be tested
      'paste', //TODO: need to be tested
    ],

    toolbar1: !buttons1 ? toolbarOptions.join(' ') : buttons1.join(' '),
    toolbar2: buttons2 === undefined ? 'cwrcpath' : buttons2.join(' '),
    toolbar3: buttons3 === undefined ? '' : buttons3.join(' '),

    menubar: false,
    elementpath: true,
    statusbar: false,
    branding: false,

    // disables style keyboard shortcuts
    formats: {
      //@ts-ignore
      bold: {},
      //@ts-ignore
      italic: {},
      //@ts-ignore
      underline: {},
    },

    setup: (editor: Editor_CWRC) => {
      // link the writer and editor
      writer.editor = editor;
      editor.writer = writer;

      // custom properties added to the editor
      editor.currentBookmark = undefined; // for storing a bookmark used when adding a tag
      editor.currentNode = undefined; // the node that the cursor is currently in
      editor.copiedElement = { selectionType: undefined, element: undefined }; // the element that was copied (when first selected through the structure tree)
      editor.copiedEntity = undefined; // the entity element that was copied
      editor.lastKeyPress = undefined; // the last key the user pressed

      editor.on('init', (event) => {
        if (writer.isReadOnly === true) {
          writer.layoutManager.hideToolbar();
          editor.setMode('readonly');
        }

        // modify isBlock method to check _tag attributes
        editor.dom.isBlock = (node) => {
          if (!node) return false;

          // If it's a node then check the type and use the nodeName
          if (typeof node !== 'string') {
            if (node.nodeType === 1) {
              const element = node as Element;
              const tag = element.getAttribute('_tag') || element.nodeName;
              return !!editor.schema.getBlockElements()[tag];
            }
          }

          const node_string = node as string;
          return !!editor.schema.getBlockElements()[node_string];
        };

        writer.overmindActions.editor.applyInitialSettings();

        const body = editor.getBody();

        // highlight tracking
        body.addEventListener('keydown', onKeyDownHandler);
        body.addEventListener('keyup', onKeyUpHandler);

        // attach mouseUp to doc because body doesn't always extend to full height of editor panel
        if (editor.iframeElement?.contentDocument) {
          editor.iframeElement.contentDocument.addEventListener('mouseup', onMouseUpHandler);
        }

        writer.event('tinymceInitialized').publish(writer);

        editor.on('Change', onChangeHandler);
        editor.on('Undo', onUndoHandler);
        editor.on('Redo', onRedoHandler);
        editor.on('BeforeAddUndo', (event) => {
          // console.log('before add undo');
        });
        editor.on('NodeChange', onNodeChangeHandler);
        editor.on('copy', onCopyHandler);

        editor.on('contextmenu', (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();

          if (writer.isReadOnly) return;

          const editorPosition = writer.utilities.getOffsetPosition(
            editor.getContentAreaContainer(),
            window.document.documentElement
          );

          const $editorBody = $(editor.getDoc().documentElement);
          const editorScrollTop = $editorBody.scrollTop();
          const editorScrollLeft = $editorBody.scrollLeft();

          const adjustLeft = editorScrollLeft
            ? editorPosition.left - editorScrollLeft
            : editorPosition.left;
          const adjustTop = editorScrollTop
            ? editorPosition.top - editorScrollTop
            : editorPosition.top;

          const posX = event.pageX + adjustLeft;
          const posY = event.pageY + adjustTop;

          writer.overmindActions.ui.showContextMenu({
            show: true,
            position: { posX, posY },
            useSelection: true,
          });

          // writer.tagMenu.show({ event, posX, posY, useSelection: true });
        });
      });

      addIconPack(editor);
      configureToolbar(writer, editor);
    },
  });

  // writer listeners

  writer.event('contentChanged').subscribe(() => {
    // console.log('contentChanged');
  });

  writer.event('documentLoaded').subscribe(() => {
    writer.editor.undoManager.clear();
    writer.editor.isNotDirty = true;
    // need to explicitly set focus
    // otherwise writer.editor.selection.getBookmark doesn't work until the user clicks inside the editor
    writer.editor.getBody().focus();
  });

  writer.event('documentSaved').subscribe(() => (writer.editor.isNotDirty = true));
  writer.event('entityAdded').subscribe(() => (writer.editor.isNotDirty = false));
  writer.event('entityRemoved').subscribe(() => (writer.editor.isNotDirty = false));
  writer.event('entityEdited').subscribe(() => (writer.editor.isNotDirty = false));

  // tinymce handlers

  const fireNodeChange = (element: Element) => {
    // fire the onNodeChange event
    const parents: Node[] = [];
    writer.editor.dom.getParent(element, (node: Node) => {
      if (node.nodeName === 'BODY') return true;
      parents.push(node);
    });
    writer.editor.fire('NodeChange', { element, parents });
  };

  const onMouseUpHandler = (event: MouseEvent) => {
    doHighlightCheck(event);
    // doHighlightCheck(writer.editor, event);
    writer.event('selectionChanged').publish();
  };

  const onUndoHandler = (event: any) => {
    console.log('undoHandler', event);
    writer.event('contentChanged').publish();
  };

  const onRedoHandler = (event: any) => {
    console.log('redoHandler', event);
    writer.event('contentChanged').publish();
  };

  const onKeyDownHandler = (event: KeyboardEvent) => {
    writer.editor.lastKeyPress = event.code; // store the last key press
    if (writer.isReadOnly) {
      if ((tinymce.isMac ? event.metaKey : event.ctrlKey) && event.code === 'f') {
        // allow search
        return;
      }
      event.preventDefault();
      return;
    }

    writer.event('writerKeydown').publish(event);
  };

  function onKeyUpHandler(event: KeyboardEvent) {
    // nav keys and backspace check
    switch (event.code) {
      case 'Home':
      case 'End':
      case 'PageUp':
      case 'PageDown':
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowRight':
      case 'ArrowLeft':
      case 'Backspace': {
        doHighlightCheck(event);
        // doHighlightCheck(writer.editor, event);
      }
    }

    // update current entity
    const entityId = writer.entitiesManager.getCurrentEntity();
    if (entityId !== null) {
      const content = $('.entityHighlight', writer.editor.getBody()).text();
      const entity = writer.entitiesManager.getEntity(entityId);
      if (entity.isNote()) {
        entity.setNoteContent($(`#${entityId}`, writer.editor.getBody()).html());
      }
      entity.setContent(content);
      writer.event('entityEdited').publish(entityId);
    }

    if (writer.editor.currentNode) {
      // check if the node still exists in the document
      if (writer.editor.currentNode.parentNode === null) {
        let rng = writer.editor.selection.getRng(true);
        const parent = rng.commonAncestorContainer.parentNode;
        // trying to type inside a bogus node?
        // (this can happen on webkit when typing "over" a selected structure tag)
        if (parent.getAttribute('data-mce-bogus') !== null) {
          const $parent = $(parent);
          let collapseToStart = true;

          let newCurrentNode = $parent.nextAll('[_tag]')[0];
          if (newCurrentNode === null) {
            newCurrentNode = $parent.parent().nextAll('[_tag]')[0];
            if (newCurrentNode === null) {
              collapseToStart = false;
              newCurrentNode = $parent.prevAll('[_tag]')[0];
            }
          }

          if (newCurrentNode !== null) {
            rng.selectNodeContents(newCurrentNode);
            rng.collapse(collapseToStart);
            writer.editor.selection.setRng(rng);

            window.setTimeout(() => {
              fireNodeChange(newCurrentNode);
            }, 0);
          }
        }
      }

      // check if text is allowed in this node
      if (writer.editor.currentNode.getAttribute('_textallowed') === 'false') {
        if (tinymce.isMac ? event.metaKey : event.ctrlKey) {
          // don't show message if we got here through undo/redo
          const node = $('[_textallowed="true"]', writer.editor.getBody()).first();
          let rng = writer.editor.selection.getRng(true);
          rng.selectNodeContents(node[0]);
          rng.collapse(true);
          writer.editor.selection.setRng(rng);
        } else {
          if (writer.editor.currentNode.getAttribute('_entity') !== 'true') {
            // exception for entities since the entity parent tag can actually encapsulate several tags
            const currentTag = writer.editor.currentNode.getAttribute('_tag');
            writer.dialogManager.show('message', {
              title: 'No Text Allowed',
              msg: `Text is not allowed in the current tag: ${currentTag}.`,
              type: 'error',
            });
          }

          //? commented out, seems a bit drastic
          // remove all text
          // $(writer.editor.currentNode).contents().filter(() => {
          //     return this.nodeType === 3;
          // }).remove();
        }
      }
    }

    // enter key
    if (event.code === 'Enter') {
      const node = writer.editor.currentNode; // the new element inserted by tinymce
      if (node === null) {
        console.warn('tinymceWrapper: user pressed enter but no new node found');
      } else {
        if (event.shiftKey) {
          // TODO replace linebreaks inserted on shift+enter with schema specific linebreak tag
          // for now just undo the linebreak in the text
          node.normalize();
        } else {
          // empty tag check
          // insert zero-width non-breaking space so empty tag takes up space
          const $node = $(node);
          if ($node.text() === '') $node.text('\uFEFF');
          writer.tagger.processNewContent(node);

          writer.editor.undoManager.add();
          writer.event('contentChanged').publish();
        }
      }
    }

    writer.event('writerKeyup').publish(event);
  }

  const onChangeHandler = (event: any) => {
    $('br', writer.editor.getBody()).remove(); // remove br tags that get added by shift+enter
    writer.event('contentChanged').publish();
  };

  const onNodeChangeHandler = (event: any) => {
    let element = event.element;
    if (element.nodeType !== 1) {
      writer.editor.currentNode = writer.utilities.getRootTag()[0];
    } else {
      if (element.getAttribute('id') === 'mcepastebin') return;

      if (
        element.getAttribute('_tag') === null &&
        element.classList.contains('entityHighlight') === false
      ) {
        // TODO review is this is still necessary
        if (element.getAttribute('data-mce-bogus') !== null) {
          // artifact from utilities.selectElementById
          let sibling: any;
          let rng = writer.editor.selection.getRng(true);
          if (rng.collapsed) {
            // the user's trying to type in a bogus tag
            // find the closest valid tag and correct the cursor location
            var backwardDirection = true;
            if (
              writer.editor.lastKeyPress === 'Home' ||
              writer.editor.lastKeyPress === 'ArrowLeft' ||
              writer.editor.lastKeyPress === 'ArrowUp'
            ) {
              sibling = $(element).prevAll('[_tag]')[0];
              backwardDirection = false;
            } else {
              sibling = $(element).nextAll('[_tag]')[0] ?? $(element).parent().nextAll('[_tag]')[0];
            }
            if (sibling !== null) {
              rng.selectNodeContents(sibling);
              rng.collapse(backwardDirection);
              writer.editor.selection.setRng(rng);
            }
          } else {
            // the structure is selected
            sibling = $(element).next('[_tag]')[0];
          }

          element = sibling !== null ? sibling : element.parentNode;
        } else if (element === writer.editor.getBody()) {
          return;
        } else {
          element = element.parentNode;
        }

        // use setTimeout to add to the end of the onNodeChange stack
        window.setTimeout(() => {
          fireNodeChange(element);
        }, 0);
      } else {
        writer.editor.currentNode = element;
      }
    }

    writer.editor.currentBookmark = writer.editor.selection.getBookmark(1);

    writer.event('nodeChanged').publish(writer.editor.currentNode);
  };

  const onCopyHandler = (event: any) => {
    if (writer.editor.copiedElement.element !== null) {
      $(writer.editor.copiedElement.element).remove();
      writer.editor.copiedElement.element = null;
    }
    writer.event('contentCopied').publish();
  };

  const doHighlightCheck = (event: any, _ev?: any) => {
    let range = writer.editor.selection.getRng(true);

    // check if inside boundary tag
    const parent = range.commonAncestorContainer;
    if (parent.nodeType === Node.ELEMENT_NODE && parent.hasAttribute('_entity')) {
      writer.entitiesManager.highlightEntity(); // remove highlight
      if (
        (writer.editor.dom.hasClass(parent, 'start') && event.code === 'ArrowLeft') ||
        (writer.editor.dom.hasClass(parent, 'end') && event.code !== 'ArrowRight')
      ) {
        const prevNode = writer.utilities.getPreviousTextNode(parent);
        range.setStart(prevNode, prevNode.length);
        range.setEnd(prevNode, prevNode.length);
      } else {
        const nextNode = writer.utilities.getNextTextNode(parent);
        range.setStart(nextNode, 0);
        range.setEnd(nextNode, 0);
      }
      writer.editor.selection.setRng(range);
      range = writer.editor.selection.getRng(true);
    }

    const entity = $(range.startContainer).parents('[_entity]')[0];

    if (!entity) {
      writer.entitiesManager.highlightEntity();
      // const parentNode = $(writer.editor.selection.getNode());
      // if (parentNode.attr('_tag')) id = parentNode.attr('id');
      return;
    }

    const id = entity.getAttribute('name');
    if (id === writer.entitiesManager.getCurrentEntity()) return;

    writer.entitiesManager.highlightEntity(id, writer.editor.selection.getBookmark());
  };
};

export default TinymceWrapper;
