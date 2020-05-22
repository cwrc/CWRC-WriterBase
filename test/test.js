'use strict';

import $ from 'jquery';
import path from 'path';
import fetchMock from 'fetch-mock/cjs/server';
import CWRCWriter from '../src/js/writer.js';
import { act } from "react-dom/test-utils";

// uncomment to show ui
// const eWin = require('electron').remote.getCurrentWindow();
// eWin.setSize(900, 700);
// eWin.show();

const WAIT_TIME = 150;
// jest.setTimeout(30000);

// override alert function so it doesn't hold up tests
window.alert = (msg) => {
    console.warn('window.alert:', msg);
}

const config = require('./mocks/config.json');
config.cwrcRootUrl = path.resolve('./build') + '\\';
config.storageDialogs = require('./mocks/storage-dialogs-mock');
config.entityLookupDialogs = require('./mocks/entity-dialogs-mock');
config.container = 'cwrcWriterContainer';
config.modules = {
    west: [{id: 'structure'}, {id: 'entities'}, {id: 'nerve', config: {nerveUrl: 'https://localhost/nerve/'}}], // TODO entities selectmenu is messing up ui-layout panel heights
    south: [{id: 'selection'}, {id: 'validation',config: {'validationUrl': 'https://localhost/validator/validate.html'}}]
};

const teiSchema = require('./mocks/tei-schema');
const teiCss = require('./mocks/tei-css');
const teiDoc = require('./mocks/tei-doc');
const nerveMock = require('./mocks/nerve-mock.json');

fetchMock.mock(/.*schema\/xml/, teiSchema);
fetchMock.mock(/.*schema\/css/, teiCss);
fetchMock.mock(/.*\/ner/, nerveMock);


let writer = undefined;

const initAndLoadDoc = (writer, doc) => {
    return new Promise((resolve) => {

        const handleInitialized = () => {
            writer.layoutManager.getContainer().height(700) // need to manually set the height otherwise it's 0
            writer.setDocument(doc)
        }

        const handleDocLoaded = (success, body) => {
            dialogClickOk()
            writer.event('writerInitialized').unsubscribe(handleInitialized)
            writer.event('documentLoaded').unsubscribe(handleDocLoaded)
            resolve([success, body])
        }

        writer.event('writerInitialized').subscribe(handleInitialized)
        writer.event('documentLoaded').subscribe(() => {
            setTimeout(handleDocLoaded, 50) // wait for doc load message to be shown
        })
    })
}

const getWriterInstance = () => {
    const w = new CWRCWriter(config);
    w.eventManager.debug(false);
    return w;
}

const resetWriter = () => {
    if (writer) {
        writer.destroy();
        writer = undefined;
    }
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.write('<html><body><div id="cwrcWriterContainer" style="width:900px;height:700px;"></div></body></html>')
}

beforeEach(() => {
    resetWriter();
})

test('writer constructor', () => {
    expect.assertions(1);

    writer = getWriterInstance();

    return new Promise((resolve) => {
        writer.event('writerInitialized').subscribe(() => {
            expect(writer.isInitialized).toBe(true);
            resolve(true);
        })
    })
});

test('writer.setDocument writer.getDocumentString writer.getDocumentXML', () => {
    expect.assertions(2);

    writer = getWriterInstance();

    return new Promise((resolve) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            writer.getDocumentXML((xmlDoc) => {
                expect(xmlDoc.firstElementChild.textContent.indexOf('Sample letter content')).toBeGreaterThan(-1);

                writer.getDocumentString((xmlString) => {
                    expect(xmlString.indexOf('Sample letter content')).toBeGreaterThan(-1);
                    resolve();
                });
            });
        })
    })
});

test('writer.setDocument convertEntities', async () => {
    expect.assertions(1);

    writer = getWriterInstance()
    await initAndLoadDoc(writer, teiDoc);

    return new Promise((resolve) => {
        writer.event('contentChanged').subscribe(() => {
            expect($('[_entity]', writer.editor.getBody()).length).toBeGreaterThan(1);
            resolve();
        });
        writer.entitiesList.convertEntities();
    })
});


test('writer.validate pass', () => {
    expect.assertions(1);

    writer = getWriterInstance();

    return initAndLoadDoc(writer, teiDoc).then(() => {
        writer.event('documentValidated').subscribe((valid, data) => {
            jest.restoreAllMocks();
            expect(valid).toBe(true);
        });

        jest.spyOn(window.$, 'ajax').mockImplementation(({
            success
        }) => {
            success('<?xml version="1.0" encoding="UTF-8"?><validation-result><status>pass</status></validation-result>');
        });

        writer.validate();
    })
});

test('writer.validate fail', () => {
    expect.assertions(1);

    writer = getWriterInstance()

    return initAndLoadDoc(writer, teiDoc).then(() => {
        writer.event('documentValidated').subscribe((valid, data) => {
            jest.restoreAllMocks();
            expect(valid).toBe(false);
        });

        jest.spyOn(window.$, 'ajax').mockImplementation(({
            success
        }) => {
            success('<?xml version="1.0" encoding="UTF-8"?><validation-result><status>fail</status><warning><line>19</line><column>15</column><message></message><element>title</element><path>/TEI/text[1]/body[1]/div[1]</path></warning></validation-result>');
        });

        writer.validate();
    })
});

test('tagger.addTagDialog tagger.addStructureTag tagger.removeStructureTag', () => {
    expect.assertions(2);

    writer = getWriterInstance()

    const tagToAdd = 'label';

    return new Promise((resolve) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            writer.event('tagAdded').subscribe((tag) => {
                expect(tag.getAttribute('_tag')).toBe(tagToAdd);
                writer.tagger.removeStructureTag(tag.getAttribute('id'));
            });

            writer.event('tagRemoved').subscribe((tagId) => {
                expect(window.$('#' + tagId, writer.editor.getBody()).length).toBe(0);
                resolve();
            });

            writer.utilities.selectElementById('dom_' + (getLastIdCounter(tinymce)), true);
            writer.tagger.addTagDialog(tagToAdd, 'add');
            setTimeout(dialogClickOk, WAIT_TIME);
        })
    });
});

test('tagger.removeStructureTagContents', () => {
    expect.assertions(1);

    writer = getWriterInstance()

    const tagToAdd = 'label';

    return new Promise((resolve) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            writer.event('tagContentsRemoved').subscribe((tagId) => {
                expect(window.$('#' + tagId, writer.editor.getBody()).contents().length).toBe(1);
                resolve();
            });

            writer.tagger.removeStructureTagContents('dom_' + (getLastIdCounter(tinymce)))
        })
    });
});

test('tagger.editTagDialog tagger.editStructureTag', () => {
    expect.assertions(1);

    writer = getWriterInstance()

    let attributeName;
    const attributeValue = 'test';

    return new Promise((resolve) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            writer.event('tagEdited').subscribe((tag) => {
                expect(tag.getAttribute(attributeName)).toBe(attributeValue);
                resolve();
            });

            writer.utilities.selectElementById('dom_' + (getLastIdCounter(tinymce)), true);
            writer.tagger.editTagDialog();
            setTimeout(() => {
                let li = window.$('.attributeSelector:visible li:eq(0)');
                attributeName = li.attr('data-name');
                li.click();
                let input = window.$('.attsContainer:visible input[name="' + attributeName + '"]');
                input.val(attributeValue);
                dialogClickOk();
            }, WAIT_TIME);
        })
    })
});

test('tagger.editEntity', async () => {
    expect.assertions(1);

    writer = getWriterInstance()

    let attributeName;
    const attributeValue = 'test';

    await initAndLoadDoc(writer, teiDoc);

    return new Promise((resolve) => {
        
        writer.event('entityEdited').subscribe((entityId) => {
            const entry = writer.entitiesManager.getEntity(entityId);
            expect(entry.getAttribute(attributeName)).toBe(attributeValue);
            resolve();
        });

        const entityEl = window.$('[_entity]', writer.editor.getBody()).first();
        const entry = writer.entitiesManager.getEntity(entityEl.attr('id'));

        writer.dialogManager.show(`schema/${entry.getType()}`, {
            entry: entry
        })

        setTimeout(() => {
            let li = window.$('.attributeSelector:visible li:eq(0)');
            attributeName = li.attr('data-name');
            li.click();
            let input = window.$('.attsContainer:visible input[name="' + attributeName + '"]');
            input.val(attributeValue);
            dialogClickOk();
        }, WAIT_TIME);

    })
});

test('tagger.changeTagDialog', () => {
    expect.assertions(1);

    writer = getWriterInstance()

    const tagName = 'name';

    return new Promise((resolve) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            writer.event('tagEdited').subscribe((tag) => {
                expect(tag.getAttribute('_tag')).toBe(tagName);
                resolve();
            });

            writer.utilities.selectElementById('dom_' + (getLastIdCounter(tinymce)), true);
            writer.tagger.changeTagDialog(tagName);
            setTimeout(() => {
                dialogClickOk();
            }, WAIT_TIME);
        })
    });
});

test('tagger.addEntityDialog tagger.removeEntity', () => {
    expect.assertions(2);

    writer = getWriterInstance()

    const entityType = 'link';

    return new Promise((resolve) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            writer.event('entityAdded').subscribe((entityId) => {
                expect(window.$('#' + entityId, writer.editor.getBody()).attr('_type')).toBe(entityType);
                writer.tagger.removeEntity(entityId);
            });

            writer.event('entityRemoved').subscribe((entityId) => {
                expect(window.$('#' + entityId, writer.editor.getBody()).length).toBe(0);
                resolve();
            });

            writer.utilities.selectElementById('dom_' + (getLastIdCounter(tinymce)), true);
            writer.tagger.addEntityDialog(entityType);
            setTimeout(() => {
                dialogClickOk();
            }, WAIT_TIME);
        })
    });
});

test('tagger.copyTag tagger.pasteTag', () => {
    expect.assertions(2);

    writer = getWriterInstance()

    // const entityType = 'link';

    return initAndLoadDoc(writer, teiDoc).then(() => {
        let tagId = 'dom_' + (getLastIdCounter(tinymce));
        let tagType = $('#' + tagId, writer.editor.getBody()).attr('_tag');
        let tagTypeCount = $('[_tag="' + tagType + '"]', writer.editor.getBody()).length;
        writer.tagger.copyTag(tagId);
        expect(writer.editor.copiedElement.element).not.toBeNull();

        writer.tagger.pasteTag();
        expect($('[_tag="' + tagType + '"]', writer.editor.getBody()).length).toBe(tagTypeCount + 1);
    })
});

test('tagger.splitTag tagger.mergeTags', () => {
    expect.assertions(2);

    writer = getWriterInstance()

    let pTagCount;
    let textNode;

    let splitHandler = () => {
        expect(window.$('[_tag="body"] [_tag="p"]', writer.editor.getBody()).length).toBe(pTagCount + 1);

        let tag1 = textNode.parentElement;
        let tag2 = tag1.nextElementSibling;

        writer.event('contentChanged').unsubscribe(splitHandler);
        writer.event('contentChanged').subscribe(mergeHandler);

        writer.tagger.mergeTags([tag1, tag2]);
    }

    let mergeHandler = () => {
        expect(window.$('[_tag="body"] [_tag="p"]', writer.editor.getBody()).length).toBe(pTagCount);
        writer.event('contentChanged').unsubscribe(mergeHandler);
    }

    return initAndLoadDoc(writer, teiDoc).then(() => {
        pTagCount = window.$('[_tag="body"] [_tag="p"]', writer.editor.getBody()).length;
        textNode = window.$('[_tag="body"] [_tag="p"]', writer.editor.getBody())[0].firstChild;

        writer.event('contentChanged').subscribe(splitHandler);

        let range = writer.editor.selection.getRng(1);
        range.setStart(textNode, 3);
        range.setEnd(textNode, 3);
        writer.editor.selection.setRng(range);
        writer.tagger.splitTag();
    })
});

test('schemaManager.getRootForSchema', () => {
    expect.assertions(1);

    writer = getWriterInstance()

    return new Promise((resolve) => {
        initAndLoadDoc(writer, teiDoc).then(async () => {
            const result = await writer.schemaManager.getRootForSchema('tei');
            expect(result).toBe('TEI');
            resolve();
        })
    })
});

test('mapper.convertTagToEntity', () => {
    expect.assertions(1);

    writer = getWriterInstance()

    return initAndLoadDoc(writer, teiDoc).then(() => {
        writer.event('entityAdded').subscribe((entityId) => {
            let tag = window.$('#' + entityId, writer.editor.getBody());
            expect(tag.attr('_type')).toBe('person');
        });

        let persTag = window.$('[_tag="persName"]', writer.editor.getBody())[0];
        writer.schemaManager.mapper.convertTagToEntity(persTag);
    })
});

test('mapper.findEntities', () => {
    expect.assertions(1);

    writer = getWriterInstance()

    return initAndLoadDoc(writer, teiDoc).then(() => {
        let entities = writer.schemaManager.mapper.findEntities();
        expect(entities.person.length).toBe(1);
    })
});

test('tagContextMenu.show', () => {
    expect.assertions(1);

    writer = getWriterInstance()

    return new Promise((resolve) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            writer.editor.fire('contextmenu')
            setTimeout(() => {
                expect(window.$('.tagContextMenu').length).toBe(1);
                resolve();
            }, 50)
        })
    });
});

test('dialogs.settings', async () => {
    expect.assertions(2);

    writer = getWriterInstance()
    await initAndLoadDoc(writer, teiDoc);

    const initShowTagSetting = writer.settings.getSettings().showTags;

    //use react
    const button = document.querySelector("[aria-label=settings]");
    act(() => {
        button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    //use jquery because the modal is still jquery
    const settingsDialog = window.$('.cwrcDialogWrapper .ui-dialog:visible');
    expect(settingsDialog.find('.ui-dialog-title').text()).toBe('Settings');

    //use react
    const buttonShowTags = document.querySelector("[name=Tags]");
    act(() => {
        buttonShowTags.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(writer.settings.getSettings().showTags).not.toBe(initShowTagSetting);

});

test.skip('dialogs.header', () => {
    expect.assertions(2);

    writer = getWriterInstance()

    return new Promise((resolve) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            window.$('.editHeader', writer.layoutManager.getHeaderButtonsParent()).click();

            let headerDialog = window.$('.cwrcDialogWrapper .ui-dialog:visible');
            expect(headerDialog.find('.ui-dialog-title').text()).toBe('Edit Header');

            headerDialog.find('textarea').val('<test>Test Header</test>');

            dialogClickOk();

            expect(window.$('[_tag="teiHeader"] > [_tag="test"]', writer.editor.getBody()).length).toBe(1);

            resolve();
        })
    });
});

test('dialogs.message confirm', () => {
    expect.assertions(2);

    writer = getWriterInstance()

    return new Promise((resolve) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            writer.dialogManager.confirm({
                title: 'Confirm Test',
                msg: 'Test',
                callback: (doIt) => {
                    expect(doIt).toBe(true);
                    resolve();
                }
            })

            let confirmDialog = window.$('.cwrcDialogWrapper .ui-dialog:visible');
            expect(confirmDialog.find('.ui-dialog-title').text()).toBe('Confirm Test');

            dialogClickYes();
        })
    });
});

test('dialogs.editSource', () => {
    expect.assertions(2);

    writer = getWriterInstance()

    return new Promise((resolve) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            writer.dialogManager.show('editSource');
            dialogClickYes();

            setTimeout(() => {
                let editDialog = window.$('.cwrcDialogWrapper .ui-dialog:visible');
                expect(editDialog.find('.ui-dialog-title').text()).toBe('Edit Source');

                editDialog.find('textarea').val('<?xml version="1.0" encoding="UTF-8"?><?xml-model href="https://cwrc.ca/schemas/cwrc_tei_lite.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?><?xml-stylesheet type="text/css" href="https://cwrc.ca/templates/css/tei.css"?><TEI xmlns="http://www.tei-c.org/ns/1.0" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><text><body>Test</body></text></TEI>');
                dialogClickOk();

                setTimeout(() => {
                    expect(window.$('[_tag="teiHeader"]', writer.editor.getBody()).length).toBe(0);
                    resolve();
                }, 50);
            }, 50);
        })
    });
});

test('dialogs.popup', () => {
    expect.assertions(1);

    writer = getWriterInstance()

    return new Promise((resolve) => {
        initAndLoadDoc(writer, teiDoc).then(() => {
            window.$('[_tag="ref"][_type="link"]', writer.editor.getBody()).trigger('mouseover');

            setTimeout(() => {
                let popup = window.$('.cwrcDialogWrapper .ui-dialog.popup:visible');
                expect(popup.length).toBe(1);
                resolve();
            }, 50)
        })
    });
});

test('modules.nerve', async () => {
    expect.assertions(2);

    writer = getWriterInstance();
    await initAndLoadDoc(writer, teiDoc);

    return new Promise( (resolve) => {
        writer.event('entityAdded').subscribe((entityId) => {
            expect(writer.entitiesManager.getEntity(entityId)).toBeDefined();
            jest.restoreAllMocks();
            setTimeout(() => {
                $('.ui-layout-west .ui-layout-content > div:eq(2) button.accept').click();
            }, 50);
        });

        writer.event('tagAdded').subscribe((tag) => {
            expect($(tag, writer.editor.getBody())).toBeDefined();
            resolve();
        });

        $('.ui-layout-west ul li:eq(2) a').click();
        $('.ui-layout-west .ui-layout-content > div:eq(2) button.run').click();
    })
});

const getLastIdCounter = (tinymce) => {
    return parseInt(tinymce.DOM.uniqueId('foo').split('foo')[1]) - 1;
}


const dialogClickOk = () => {
    const ok = window.$('.cwrcDialogWrapper .ui-dialog:visible .ui-dialog-buttonset .ui-button[role="ok"]');
    if (ok.length === 0) console.warn('ok button not visible');
    ok.click();
}

const dialogClickCancel = () => {
    let cancel = window.$('.cwrcDialogWrapper .ui-dialog:visible .ui-dialog-buttonset .ui-button[role="cancel"]');
    if (cancel.length === 0) console.warn('cancel button not visible');
    cancel.click();
}

const dialogClickYes = () => {
    let yes = window.$('.cwrcDialogWrapper .ui-dialog:visible .ui-dialog-buttonset .ui-button[role="yes"]');
    if (yes.length === 0) console.warn('yes button not visible');
    yes.click();
}

const dialogClickNo = () => {
    let no = window.$('.cwrcDialogWrapper .ui-dialog:visible .ui-dialog-buttonset .ui-button[role="no"]');
    if (no.length === 0) console.warn('no button not visible');
    no.click();
}