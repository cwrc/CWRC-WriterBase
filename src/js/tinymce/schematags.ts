import { Editor_CWRC } from '../../@types/types';
import { PossibleResponse } from 'cwrc-worker-validator';


export const getSchemaTags = async (editor: Editor_CWRC) => {

  //update editor selection
  editor.writer.editor.currentBookmark =  editor.writer.editor.selection.getBookmark(1);

  const virtualEditorExists = editor.writer.workerValidator.hasValidator();

  const rng = editor.writer.editor.currentBookmark.rng;

  const element = rng.commonAncestorContainer.nodeType === 1 //element
  ? rng.commonAncestorContainer
  : rng.commonAncestorContainer.parentElement;

  const hasContentSelection = !rng.collapsed;

  const tagId = element.id;

  const xpath = editor.writer.utilities.getElementXPath(element);

  const elementChildren = Array.from(element.childNodes);
  const index = elementChildren.findIndex((child) => child === rng.startContainer);

  let selection;
  if (hasContentSelection) {
    selection = {
      type: 'span',
      startContainerIndex: index,
      startOffset: rng.startOffset,
      endContainerIndex: elementChildren.findIndex((child) => child === rng.endContainer),
      endOffset: rng.endOffset,
    };
  }

  const params = { xpath, index, selection };

  const response: PossibleResponse = await editor.writer.workerValidator.possibleAtContextMenu(
    params
  );

  const tags = response.tags.speculative || response.tags.possible;

  if (tags.length === 0) {
    return [
      {
        type: 'menuitem',
        text: 'No tags available for current parent tag.',
        disabled: true,
        onAction: () => {},
      },
    ];
  }

  const items = tags.map(({ name, fullName }) => {
    const type = 'menuitem';
    const text = fullName ? `${name} (${fullName})` : name;

    return {
      type,
      text,
      onAction: () => editor.writer.tagger.addTagDialog(name, 'add', tagId),
    };
  });

  console.log(items)

  return items;
};

// import $ from 'jquery';
// import { Node } from 'rdflib';
// import { Editor } from 'tinymce';

// /**
//  * Gets the menu items for all tags in the schema.
//  * @param action {String} The action to perform: "add" or "change".
//  * @returns {Array} The array of tags.
//  */
// export const getSchemaTags = ({ editor, action = 'add' }: { editor: any; action?: string }) => {
//   const menuItems = [];
//   // var imageUrl = editor.writer.cwrcRootUrl+'img/';
//   const schemaElements = editor.writer.schemaManager.schema.elements;

//   const items = filterMenu(editor, schemaElements);

//   items.forEach((tag: any) => {
//     const type = 'menuitem';
//     const fullName = editor.writer.schemaManager.getFullNameForTag(tag);
//     let text = tag;
//     if (fullName !== '') text = `${text} (${fullName})`;

//     menuItems.push({
//       type,
//       text,
//       action,
//       onAction: () => {
//         action === 'add'
//           ? editor.writer.tagger.addTagDialog(tag, action)
//           : editor.writer.tagger.changeTagDialog(tag);
//       },
//     });
//   });

//   if (menuItems.length === 0) {
//     menuItems.push({
//       type: 'menuitem',
//       text: 'No tags available for current parent tag.',
//       disabled: true,
//       onAction: () => {},
//     });
//   }

//   return menuItems;
// };

// const filterMenu = (editor: any, schemaElements: any) => {
//   let node: any;
//   let filterKey: string;

//   // get the node from currentBookmark if available, otherwise use currentNode
//   if (editor.currentBookmark !== null) {
//     node = editor.currentBookmark.rng.commonAncestorContainer;
//     while (node.nodeType === 3) {
//       node = node.parentNode;
//     }
//   } else {
//     node = editor.currentNode;
//   }

//   if (node.nodeType === 9) {
//     node = $('body > [_tag]', node)[0]; // we're at the document level so select the root instead
//   }

//   filterKey = node.getAttribute('_tag');

//   if (filterKey === null) {
//     // probably in an entity
//     let id = node.getAttribute('id');
//     if (id === 'entityHighlight') {
//       id = editor.writer.entitiesManager.getCurrentEntity();
//       filterKey = editor.writer.entitiesManager.getEntity(id).getTag();
//     } else {
//       console.warn('schematags: in unknown tag', node);
//     }
//   }

//   let validKeys: any[] = [];

//   if (filterKey !== editor.writer.schemaManager.getHeader()) {
//     const children = editor.writer.schemaManager.getChildrenForTag(filterKey);
//     validKeys = children.map((child: any) => child.name);
//   }

//   const filteredElements = schemaElements.filter((tag: any) => validKeys.indexOf(tag) !== -1);

//   return filteredElements;
// };
