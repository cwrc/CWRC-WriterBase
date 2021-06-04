import dedent from 'dedent';
import $ from 'jquery';
import 'jquery-contextmenu';
import { v4 as uuidv4 } from 'uuid';

const SUBMENU_MAX_VISIBLE_OPTIONS = 7;

//Search box
$.contextMenu.types.search = function (item, opt) {
  $(
    dedent(`
		<label for="contextmenu_search" class="contextmenu_search">
      <input type="input" id="contextmenu_search" placeholder="Search">
      <i class="fas fa-search contextmenu_search__icon"></i>
		</label>
  `)
  ).appendTo(this);

  this.addClass('contextmenu_search_container');
  this.on('contextmenu:focus', (event) => event.stopImmediatePropagation());
  this.on('keyup', (e) => item.events.keyup(e, opt));
};

const logStyle =
  'color: #333; font-weight: bold; background-color: #ededed;padding: 5px; border-radius: 5px';
class TagContextMenu {
  constructor(writer) {
    this.w = writer;
    this.container = `#${writer.containerId}`;
    this.selector = `#${writer.layoutManager.$containerid}`; //`#${writer.containerId}`;

    // these properties are set in the show method
    this.id = null;
    this.rng = null;
    this.hasValidator = false;
    this.tagId = null;
    this.tagName = null;
    this.isEntity = false;
    this.isMultiple = false;
    this.virtualEditorExists = false;
    this.useSelection = false;
    this.hasContentSelection = false;
    this.allowsTagAround = false;

    this.element = null;

    // dynamically built context menu
    $.contextMenu({
      selector: this.selector,
      trigger: 'none',
      // eslint-disable-next-line no-unused-vars
      build: ($trigger, event) => {
        return {
          appendTo: `#${this.w.layoutManager.$containerid}`,
          className: 'tagContextMenu cwrc',
          animation: { duration: 0, show: 'show', hide: 'hide' },
          items: this.#getItems(),
          // general callback
          callback: (key, options, event) => {
            this.w.editor.currentBookmark = this.w.editor.selection.getBookmark(1);
            console.log({ key, options, event });
          },
        };
      },
    });
  }

  /**
   * Show the tag contextmenu
   * @param {Event} event The original contextmenu event
   * @param {String|Array} tagId The id of the tag. Can be undefined and will be determined by tagger.getCurrentTag. Can be an array to allow for merge action.
   * @param {Boolean} useSelection
   */
  async show({ event, posX, posY, source, ...rest }) {
    if (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    this.source = source ? source : '';

    if (this.w.isReadOnly || this.w.isEditorReadOnly()) return;

    //set unique ID
    this.id = uuidv4();

    //update editor selection
    this.w.editor.currentBookmark = this.w.editor.selection.getBookmark(1);

    //store current selection range
    this.rng = this.w.editor.currentBookmark.rng;

    const procced = this.#processContext(rest);
    if (!procced) return;

    console.log(`${'%c'}Context Menu for ${this.tagName}`, logStyle);
    this.virtualEditorExists = this.w.workerValidator.hasValidator();

    $(this.selector).contextMenu({ x: posX, y: posY });
  }

  /**
   * Destroy the tag contextmenu
   */
  destroy() {
    $(this.container).contextMenu('destroy');
  }

  //--- PRIVATE METHODS ---//
  #processContext({ tagId, useSelection }) {
    this.element =
      this.rng.commonAncestorContainer.nodeType === 1 //element
        ? this.rng.commonAncestorContainer
        : this.rng.commonAncestorContainer.parentElement;

    this.hasContentSelection = !this.rng.collapsed;
    this.allowsTagAround = this.hasContentSelection ? this.#selectionOverlapNodes() : true;

    this.tagId = this.element.id;
    this.tagName = this.element.getAttribute('_tag');

    if (
      this.tagName === this.w.schemaManager.getRoot() ||
      this.tagName === this.w.schemaManager.getHeader()
    ) {
      return false;
    }

    if (tagId !== undefined && Array.isArray(tagId)) {
      this.isMultiple = true;
      this.isEntity = false;
      this.useSelection = false;
    } else {
      this.isMultiple = false;
      this.isEntity = this.element.getAttribute('_entity') !== null;
      this.useSelection = useSelection === undefined ? false : useSelection;
    }

    return true;
  }

  #selectionOverlapNodes() {
    const { startContainer, endContainer } = this.rng;

    if (startContainer.nodeType !== 3) return false;
    if (endContainer.nodeType !== 3) return false;

    if (startContainer.parentNode.id !== endContainer.parentNode.id) {
      return false;
    }

    return true;
  }

  #paramsForAddTag() {
    const xpath = this.w.utilities.getElementXPath(this.element);

    const elementChildren = Array.from(this.element.childNodes);
    const index = elementChildren.findIndex((child) => child === this.rng.startContainer);

    let selection;
    if (this.hasContentSelection) {
      selection = {
        type: 'span',
        startContainerIndex: index,
        startOffset: this.rng.startOffset,
        endContainerIndex: elementChildren.findIndex((child) => child === this.rng.endContainer),
        endOffset: this.rng.endOffset,
      };
    }

    return { xpath, index, selection };
  }

  #paramsForChangeTag() {
    const xpath = this.w.utilities.getElementXPath(this.element.parentNode);

    const elementChildren = Array.from(this.element.parentNode.childNodes);
    const index = elementChildren.findIndex((child) => child === this.element);
    const skip = this.element.getAttribute('_tag');

    const selection = {
      type: 'change',
      xpath: this.w.utilities.getElementXPath(this.element),
      startContainerIndex: 0,
      endContainerIndex: elementChildren.length,
      skip,
    };

    return { xpath, index, selection };
  }

  #paramsForAddTagBefore() {
    const xpath = this.w.utilities.getElementXPath(this.element.parentNode);
    const index = 0;

    const elementChildren = Array.from(this.element.parentNode.childNodes);
    let containerIndex = elementChildren.findIndex((child) => child === this.element) - 1;
    if (containerIndex < 0) containerIndex = 0;

    const selection = {
      type: 'before',
      xpath,
      containerIndex,
    };

    return { xpath, index, selection };
  }

  #paramsForAddTagAfter() {
    const xpath = this.w.utilities.getElementXPath(this.element.parentNode);

    const elementChildren = Array.from(this.element.parentNode.childNodes);
    const index = elementChildren.findIndex((child) => child === this.element) + 1;

    const selection = {
      type: 'after',
      xpath: xpath,
      containerIndex: index,
    };

    return { xpath, index, selection };
  }

  #paramsForAddTagAround() {
    const xpath = this.w.utilities.getElementXPath(this.element.parentNode);

    const elementChildren = Array.from(this.element.parentNode.childNodes);
    const index = elementChildren.findIndex((child) => child === this.element);

    const selection = {
      type: 'around',
      xpath: this.w.utilities.getElementXPath(this.element),
    };

    return { xpath, index, selection };
  }

  #paramsForAddTagInside() {
    const xpath = this.w.utilities.getElementXPath(this.element);
    const index = 0;

    const selection = {
      type: 'inside',
      xpath: this.w.utilities.getElementXPath(this.element),
    };

    return { xpath, index, selection };
  }

  async #getTagsFor(params) {
    const response = await this.w.workerValidator.possibleAtContextMenu(params);
    const tags = response.tags.speculative || response.tags.possible;
    return tags;
  }

  #getItems() {
    // if (this.source === 'ribbon') return this.#getItemsForRibbonTags();
    
    if (this.w.isAnnotator) {
      this.#getEntitiesOptions(items);
      return items;
    }

    const tagId = this.tagId;

    const items = {};

    if (this.virtualEditorExists && this.isMultiple) {
      items.add_tag_around = {
        name: 'Add Tag Around',
        icon: 'fas fa-plus-circle',
        className: 'context-menu-item-new',
        items: (async () => {
          const params = this.#paramsForAddTagAround();
          const tags = await this.#getTagsFor(params);
          const submenu = this.#getSubmenu({ options: tags, action: 'around' });
          return submenu;
        })(),
      };

      items.sep0 = '---';

      items.merge_tags = {
        name: 'Merge Tags',
        icon: 'fas fa-code-branch',
        className: 'context-menu-item-new',
        callback: () => {
          const tags = $(`'#${tagId.join(',#')}`, this.w.editor.getBody());
          this.w.tagger.mergeTags(tags);
        },
      };

      return items;
    }

    if (this.virtualEditorExists && this.useSelection && this.allowsTagAround) {
      items.add_tag = {
        name: 'Add Tag',
        icon: 'fas fa-plus-circle',
        className: 'context-menu-item-new',
        items: (async () => {
          const params = this.#paramsForAddTag();
          const tags = await this.#getTagsFor(params);
          const submenu = this.#getSubmenu({ options: tags, action: 'add' });
          return submenu;
        })(),
      };

      if (this.w.schemaManager.isSchemaCustom() === false) {
        this.#getEntitiesOptions(items);
      }

      items.sep0 = '---';
    }

    if (this.virtualEditorExists && !this.useSelection) {
      items.add_tag_before = {
        name: 'Add Tag Before',
        icon: 'fas fa-plus-circle',
        className: 'context-menu-item-new',
        items: (async () => {
          const params = this.#paramsForAddTagBefore();
          const tags = await this.#getTagsFor(params);
          const submenu = this.#getSubmenu({ options: tags, action: 'before' });
          return submenu;
        })(),
      };

      items.add_tag_after = {
        name: 'Add Tag After',
        icon: 'fas fa-plus-circle',
        className: 'context-menu-item-new',
        items: (async () => {
          const params = this.#paramsForAddTagAfter();
          const tags = await this.#getTagsFor(params);
          const submenu = this.#getSubmenu({ options: tags, action: 'after' });
          return submenu;
        })(),
      };

      items.add_tag_around = {
        name: 'Add Tag Around',
        icon: 'fas fa-plus-circle',
        className: 'context-menu-item-new',
        items: (async () => {
          const params = this.#paramsForAddTagAround();
          const tags = await this.#getTagsFor(params);
          const submenu = this.#getSubmenu({ options: tags, action: 'around' });
          return submenu;
        })(),
      };

      items.add_tag_inside = {
        name: 'Add Tag Inside',
        icon: 'fas fa-plus-circle',
        className: 'context-menu-item-new',
        items: (async () => {
          const params = this.#paramsForAddTagInside();
          const tags = await this.#getTagsFor(params);
          const submenu = this.#getSubmenu({ options: tags, action: 'inside' });
          return submenu;
        })(),
      };

      items.sep1 = '---';
    }

    items.edit_tag = {
      name: 'Edit Tag/Entity Annotation',
      icon: 'fas fa-edit',
      className: 'context-menu-item-new',
      callback: () => this.w.tagger.editTagDialog(tagId),
    };

    if (!this.isEntity) {
      const tagName = this.element.getAttribute('_tag');
      if (this.w.schemaManager.isTagEntity(tagName)) {
        items.convert_tag = {
          name: 'Convert to Entity Annotation',
          icon: 'fas fa-edit',
          className: 'context-menu-item-new',
          callback: () => this.w.schemaManager.mapper.convertTagToEntity(this.element, true),
        };
      }
    }

    if (
      (this.virtualEditorExists && !this.useSelection) ||
      (this.useSelection && !this.hasContentSelection)
    ) {
      items.change_tag = {
        name: 'Change Tag',
        icon: 'fas fa-edit',
        className: 'context-menu-item-new',
        items: (async () => {
          const params = this.#paramsForChangeTag();
          const tags = await this.#getTagsFor(params);
          const submenu = this.#getSubmenu({ options: tags, action: 'change' });
          return submenu;
        })(),
      };
    }

    if (this.isEntity) {
      items.copy_entity = {
        name: 'Copy Entity',
        icon: 'fas fa-clone',
        className: 'context-menu-item-new',
        callback: () => this.w.tagger.copyTag(tagId),
      };
    } else {
      items.copy_tag = {
        name: 'Copy Tag and Contents',
        icon: 'fas fa-clone',
        className: 'context-menu-item-new',
        callback: () => this.w.tagger.copyTag(tagId),
      };
    }

    if (this.w.editor.copiedElement.element !== null) {
      items.paste_tag = {
        name: 'Paste Tag',
        icon: 'fas fa-clone',
        className: 'context-menu-item-new',
        callback: () => this.w.tagger.pasteTag(),
      };
    } else if (this.w.editor.copiedEntity !== null) {
      items.paste_entity = {
        name: 'Paste Entity',
        icon: 'fas fa-clone',
        className: 'context-menu-item-new',
        callback: () => this.w.tagger.pasteEntity(),
      };
    }

    if (this.useSelection) {
      items.split_tag = {
        name: 'Split Tag',
        icon: 'fas fa-code-branch',
        className: 'context-menu-item-new',
        callback: () => this.w.tagger.splitTag(),
      };
    }

    items.sep2 = '---';

    if (this.isEntity) {
      items.remove_entity = {
        name: 'Remove Entity',
        icon: 'fas fa-minus-circle',
        className: 'context-menu-item-new',
        callback: () => this.w.tagger.removeEntity(tagId),
      };
    }

    items.remove_tag = {
      name: 'Remove Tag',
      icon: 'fas fa-minus-circle',
      className: 'context-menu-item-new',
      callback: () => this.w.tagger.removeStructureTag(tagId, false),
    };

    items.remove_content = {
      name: 'Remove Content Only',
      icon: 'fas fa-minus-circle',
      className: 'context-menu-item-new',
      callback: () => this.w.tagger.removeStructureTagContents(tagId),
    };

    items.remove_all = {
      name: 'Remove All',
      icon: 'fas fa-minus-circle',
      className: 'context-menu-item-new',
      callback: () => this.w.tagger.removeStructureTag(tagId, true),
    };

    return items;
  }

  #getEntitiesOptions(items) {
    const entityMappings = this.w.schemaManager.mapper.getMappings().entities;
    const menu = {};

    Object.entries(entityMappings).forEach(([key, { label }]) => {
      const name = label ? label : `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
      menu[key] = {
        name,
        icon: `fas ${key}`,
        className: `entities context-menu-item-new ${key}`,
        callback: () => this.w.tagger.addEntityDialog(key),
      };
    });

    items.add_entity = {
      name: 'Add Entity Annotation',
      icon: 'fas fa-plus-circle',
      className: 'entities context-menu-item-new',
      items: menu,
    };
  }

  #getSubmenu = ({ options, action }) => {
    const submenu = {};

    if (options.length === 0) {
      submenu['no_tags'] = {
        name: 'No Tags Available',
        disabled: true,
        className: 'context-menu-item-new submenu',
      };
      return submenu;
    }

    const handleKeyUp = (e, opt) => {
      const query = e.target.value;
      const collection = Object.entries(opt.items);

      const result = collection.filter(([key, itemValue]) => {
        const { name, type, $node } = itemValue;
        if (type === 'search' || key === 'noresult') return;

        const match = query === '' || name.toLowerCase().indexOf(query.toLowerCase()) != -1;
        itemValue.visible = match ? true : false;
        itemValue.visible = match ? $node.show() : $node.hide();

        return match;
      });

      // show/hide noResult
      let noResultItem = collection.find(([key]) => key === 'noresult');
      const [, noResultValue] = noResultItem;
      // noResultValue.visible = result.length === 0 ? true : false;
      noResultValue.visible =
        result.length === 0 ? noResultValue.$node.show() : noResultValue.$node.hide();
    };

    if (options.length > SUBMENU_MAX_VISIBLE_OPTIONS) {
      submenu['search'] = {
        type: 'search',
        callback: () => false,
        events: { keyup: handleKeyUp },
      };
    }

    options.forEach(({ name, fullName }) => {
      const label = fullName ? `${name}<br/><span class="fullName">${fullName}</span>` : name;
      submenu[name] = {
        name: label,
        isHtmlName: true,
        className: 'context-menu-item-new submenu',
        visible: true,
        callback: action ? (key) => this.#actionCallback({ key, action }) : undefined,
      };
      // if (action)
      // 	submenu[name].callback = (key) => {
      // 		this.#actionCallback({ key, action });
      // 	};
    });

    submenu['noresult'] = {
      name: 'No result',
      className: 'context-menu-item-new submenu',
      disabled: true,
      visible: false,
    };

    return submenu;
  };

  #actionCallback({ key, action }) {
    // general callback used for addTagDialog and changeTagDialog
    if (action === undefined) return;

    this.w.editor.currentBookmark = this.w.editor.selection.getBookmark(1);

    switch (action) {
      case 'change':
        this.w.tagger.changeTagDialog(key, this.tagId);
        break;
      default:
        this.w.editor.currentBookmark.tagId = this.tagId;
        this.w.tagger.addTagDialog(key, action, this.tagId);
        break;
    }
  }

  async #getItemsForRibbonTags() {
    // const params = this.#paramsForAddTag();
    // const tags = await this.#getTagsFor(params);
    // const items = this.#getSubmenu({ options: tags, action: 'add' });
    // console.log(items)
    // // return items;

    const items = {};

    // items.add_tag = {
    //     name: 'Add Tag',
    //     icon: 'fas fa-plus-circle',
    //     className: 'context-menu-item-new',
    //     items: (async () => {
    //       const params = this.#paramsForAddTag();
    //       const tags = await this.#getTagsFor(params);
    //       const submenu = this.#getSubmenu({ options: tags, action: 'add' });
    //       return submenu;
    //     })(),
    //   };

    items.remove_all = {
      name: 'Remove All',
      icon: 'fas fa-minus-circle',
      className: 'context-menu-item-new',
      // callback: () => this.w.tagger.removeStructureTag(tagId, true),
    };

    return items;

    // return {
    //         callback: function(key, options) {
    //             var m = "clicked: " + key;
    //             window.console && console.log(m) || alert(m);
    //         },
    //         items: {
    //             "edit": {name: "Edit", icon: "edit"},
    //             "cut": {name: "Cut", icon: "cut"},
    //             "copy": {name: "Copy", icon: "copy"}
    //         }
    //     };
  }
}

export default TagContextMenu;
