import $ from 'jquery';
import Mapper from 'mapper';

import 'jquery-ui/ui/widgets/button';
import 'jquery-ui/ui/widgets/selectmenu';
import 'jquery-ui/ui/widgets/tooltip';

/**
 * @class EntitiesList
 * @fires Writer#entitiesListInitialized
 * @param {Object} config destructured
 * @param {Writer} config.writer
 * @param {String} config.parentId
 */
export function EntitiesList({writer,parentId}) {
    const w = writer;
    const id = parentId;

    let enabled = true; // enabled means we update based on events
    let updatePending = false;

    let isConvert = false; // are we in convert mode

    const $entities = $('#' + id);
    $entities.append(
        `<div class="moduleParent entitiesPanel">
            <div class="moduleHeader">
                <div>
                    <button type="button" class="convert">Scrape Candidate Entities</button>
                    <span style="display: none;">Candidate Entities</span>
                </div>
                <div class="convertActions" style="display: none;">
                    <button type="button" class="accept">Accept All</button>
                    <button type="button" class="reject">Reject All</button>
                    <button type="button" class="done">Done</button>
                </div>
            </div>
            <div class="moduleContent">
                <ul class="entitiesList"></ul>
            </div>
            <div class="moduleFooter">
                <div style="display: inline-block;">
                    <label for="filter" title="Filter" class="fas fa-filter"></label>
                    <select name="filter">
                        <option value="all" selected="selected">All</option>
                        <option value="person">Person</option>
                        <option value="place">Place</option>
                        <option value="date">Date</option>
                        <option value="org">Organization</option>
                        <option value="citation">Citation</option>
                        <option value="note">Note</option>
                        <option value="title">Title</option>
                        <option value="correction">Correction</option>
                        <option value="keyword">Keyword</option>
                        <option value="link">Link</option>
                    </select>
                </div>
                <div style="display: inline-block;">
                    <label for="sorting" title="Sorting" class="fas fa-sort"></label>
                    <select name="sorting">
                        <option value="seq" selected="selected">Sequential</option>
                        <option value="alpha">Alphabetical</option>
                        <option value="cat">Categorical</option>
                    </select>
                </div>
            </div>
        </div>`
    );

    if (w.isReadOnly) $entities.find('.moduleHeader').hide();

    $entities.find('select').selectmenu({
        appendTo: w.layoutManager.getContainer(),
        position: {
            my: 'left bottom',
            at: 'left top',
            collision: 'flipfit'
        },
        width: 90
    });

    $entities.find('button.convert').button().click(() => {
        pm.convertEntities();
    });
    $entities.find('button.accept').button().click(() => {
        acceptAll();
        pm.update();
    });
    $entities.find('button.reject').button().click(() => {
        rejectAll();
        pm.update();
    });
    $entities.find('button.done').button().click(() => {
        if (getCandidates().length <= 0) {
            handleDone();
            return;
        }

        w.dialogManager.confirm({
            title: 'Warning',
            msg: `<p>All the remaining entities in the panel will be rejected.</p>
                <p>Do you wish to proceed?</p>`,
            showConfirmKey: 'confirm-reject-candidate-entities',
            type: 'info',
            callback: (doIt) => {
                if (doIt) {
                    rejectAll();
                    handleDone();
                }
            }
        });

    });

    const getFilter = () => $entities.find('select[name="filter"]').val();
    const setFilter = (value) => $entities.find('select[name="filter"]').val(value).selectmenu('refresh');
    const getSorting = () => $entities.find('select[name="sorting"]').val();

    $entities.find('select[name="filter"]').on('selectmenuchange', () => pm.update());
    $entities.find('select[name="sorting"]').on('selectmenuchange', () => pm.update());
    // $entities.find('select[name="filter"]').on('change', () => pm.update() );
    // $entities.find('select[name="sorting"]').on('change', () => { pm.update() );

    /**
     * @lends EntitiesList.prototype
     */
    const pm = {};

    pm.update = () => {
        if (!enabled) {
            updatePending = true;
            return;
        }

        clear();

        let entities = w.entitiesManager.getEntitiesArray(getSorting());

        entities = entities.filter((entry) => entry.getCustomValue('nerve') !== 'true');

        const filter = getFilter();
        if (filter !== 'all') {
            entities = entities.filter((entry) => entry.getType() === filter);
        }

        let entitiesString = '';
        entities.forEach((entry) => entitiesString += getEntityView(entry));

        if (isConvert) {
            $entities.find('ul.entitiesList').addClass('candidates');
        } else {
            $entities.find('ul.entitiesList').removeClass('candidates');
        }

        $entities.find('ul.entitiesList').html(entitiesString);
        $entities.find('ul.entitiesList > li > div')
            .on('click', function () {
                $(this).parent().toggleClass('expanded');
                const id = $(this).parent().data('id');
                w.entitiesManager.highlightEntity(id, null, true);
            })
            .find('.actions > span').hover(function () {
                $(this).removeClass('ui-state-default');
                $(this).addClass('ui-state-active');
            }, function () {
                $(this).addClass('ui-state-default');
                $(this).removeClass('ui-state-active');
            })
            .on('click', function (event) {
                event.stopPropagation();
                const action = $(this).data('action');
                const id = $(this).parents('li').data('id');
                switch (action) {
                    case 'edit':
                        w.tagger.editTagDialog(id);
                        break;
                    case 'accept':
                        acceptEntity(id);
                        pm.update();
                        break;
                    case 'reject':
                        rejectEntity(id);
                        pm.update();
                        break;
                    case 'remove':
                        w.tagger.removeEntity(id);
                        break;
                    case 'acceptmatching':
                        acceptMatching(id);
                        pm.update();
                        break;
                    case 'rejectmatching':
                        rejectMatching(id);
                        pm.update();
                        break;
                }
            });

        $entities.find('.actions').tooltip({
            show: false,
            hide: false,
            classes: {
                'ui-tooltip': 'cwrc-tooltip'
            }
        });

        if (w.entitiesManager.getCurrentEntity()) {
            $entities.find('ul.entitiesList > li[data-id="' + w.entitiesManager.getCurrentEntity() + '"]').addClass('expanded').find('div[class="info"]').show();
        }
    };

    const getEntityView = (entity) => {
        const isCandidate = entity.getAttribute('_candidate') === 'true';

        let infoString = '<ul>';

        // named entity values
        let nevAdded = false;
        const lemma = entity.getLemma();
        if (lemma !== undefined) {
            infoString += `<li><strong>Standard</strong>: ${lemma}</li>`;
            nevAdded = true;
        }
        const uri = entity.getURI()
        if (uri !== undefined) {
            infoString += `<li><strong>URI</strong>: <a href="${uri}" target="_blank" rel="noopener">${uri}</a></li>`;
            nevAdded = true;
        }

        // attribute values
        let attAdded = false;
        const entityAttributes = entity.getAttributes()
        const urlAttributes = w.schemaManager.mapper.getUrlAttributes();
        for (const name in entityAttributes) {
            if (Mapper.reservedAttributes[name] !== true) {
                const value = entityAttributes[name];

                if (value === undefined) {
                    console.warn('entitiesList: undefined value for ' + name + 'in ', entity);
                    continue;
                }

                if (urlAttributes.indexOf(name) !== -1 || value.indexOf('http') === 0) {
                    if (value === uri) continue; // don't duplicate uri

                    if (!attAdded && nevAdded) infoString += '<li><hr /></li>';
                    infoString += `<li><strong>${name}</strong>: <a href="${value}" target="_blank" rel="noopener">${value}</a></li>`;
                    attAdded = true;

                } else {
                    if (value === lemma) continue; // don't duplicate lemma

                    if (!attAdded && nevAdded) infoString += '<li><hr /></li>';
                    infoString += `<li><strong>${name}</strong>: ${value}</li>`;
                    attAdded = true;
                }

            }
        }

        // custom values
        const customValues = entity.getCustomValues();
        for (const name in customValues) {
            const value = customValues[name];
            infoString += `<li><strong>${name}</strong>: ${value}</li>`;
        }

        infoString += '</ul>';

        let actions = '';
        if (w.isReadOnly === false) {
            if (isConvert && isCandidate) {
                actions = '<span data-action="accept" class="ui-state-default" title="Accept"><span class="ui-icon ui-icon-check"/></span>' +
                    '<span data-action="reject" class="ui-state-default" title="Reject"><span class="ui-icon ui-icon-close"/></span>';
                const hasMatching = getMatchesForEntity(entity.getId()).length > 0;
                if (hasMatching) {
                    actions += '<span data-action="acceptmatching" class="ui-state-default" title="Accept All Matching"><span class="ui-icon ui-icon-circle-check"/></span>';
                    actions += '<span data-action="rejectmatching" class="ui-state-default" title="Reject All Matching"><span class="ui-icon ui-icon-circle-close"/></span>';
                }
            } else {
                actions = '<span data-action="edit" class="ui-state-default" title="Edit"><span class="ui-icon ui-icon-pencil"/></span>' +
                    '<span data-action="remove" class="ui-state-default" title="Remove"><span class="ui-icon ui-icon-close"/></span>';
            }
        }

        return `
        <li class="${entity.getType()} ${isCandidate ? 'candidate' : ''}" data-type="${entity.getType()}" data-id="${entity.getId()}">
            <div>
                <div class="header">
                    <span class="icon"/>
                    <span class="entityTitle">${entity.getContent()}</span>
                    <div class="actions">${actions}</div>
                </div>
                <div class="info">${infoString}</div>
            </div>
        </li>`;
    }

    pm.enable = (forceUpdate) => {
        enabled = true;
        if (forceUpdate || updatePending) {
            pm.update();
            updatePending = false;
        }
    }

    pm.disable = () => enabled = false;

    pm.destroy = () => {
        $entities.find('button').button('destroy');
        $entities.find('select').selectmenu('destroy');
        $entities.find('.actions').tooltip('destroy');
        $entities.remove();
    };

    const clear = () => $entities.find('ul').empty();

    const remove = (id) => $entities.find('li[data-id="' + id + '"]').remove();

    // CONVERSION
    pm.convertEntities = () => {
        const typesToFind = ['person', 'place', 'date', 'org', 'title', 'link'];
        const potentialEntitiesByType = w.schemaManager.mapper.findEntities(typesToFind);
        let potentialEntities = [];
        for (const type in potentialEntitiesByType) {
            potentialEntities = potentialEntities.concat(potentialEntitiesByType[type]);
        }

        // filter out duplicates
        potentialEntities = potentialEntities.filter((value, index, array) => {
            return array.indexOf(value) === index;
        });

        if (potentialEntities.length <= 0) {
            w.dialogManager.show('message', {
                title: 'Entities',
                msg: 'No candidate entities were found.',
                type: 'info'
            });
            return;
        }

        isConvert = true;
        $entities.find('.convertActions').show();
        $entities.find('.subheader').show();
        $entities.find('.actionOptions').hide()
        $entities.find('button.convert').button('option', 'disabled', true) //.next('span').show();

        const li = w.dialogManager.getDialog('loadingindicator');
        li.setText('Converting Entities');
        li.show();

        w.event('massUpdateStarted').publish();

        w.utilities.processArray(potentialEntities, (el) => {
            const entity = w.schemaManager.mapper.convertTagToEntity(el);
            if (entity !== null) {
                entity.setAttribute('_candidate', 'true');
                $('#' + entity.id, w.editor.getBody()).attr('_candidate', 'true');
            }
        }).then(function () {
            li.hide();
            w.event('contentChanged').publish();
            w.event('massUpdateCompleted').publish();
        });

    }

    const getCandidates = () => {
        let entities = w.entitiesManager.getEntitiesArray();
        entities = entities.filter((entry) => {
            return entry.getAttribute('_candidate') === 'true' && entry.getCustomValue('nerve') !== 'true';
        });
        return entities;
    }

    const getMatchesForEntity = (entityId) => {
        const matches = [];
        const match = w.entitiesManager.getEntity(entityId);
        w.entitiesManager.eachEntity((i, ent) => {
            if (ent.getId() !== match.getId()) {
                if (JSON.stringify(ent.getAttributes()) === JSON.stringify(match.getAttributes()) &&
                    JSON.stringify(ent.getCustomValues()) === JSON.stringify(match.getCustomValues()) &&
                    ent.getContent() === match.getContent()
                ) {
                    matches.push(ent.getId());
                }
            }
        });
        return matches;
    }

    const acceptEntity = (entityId) => {
        const entity = w.entitiesManager.getEntity(entityId);
        entity.removeAttribute('_candidate');
        $('#' + entity.id, w.editor.getBody()).removeAttr('_candidate');
    }

    const rejectEntity = (entityId) => w.tagger.removeEntity(entityId);

    const acceptMatching = (entityId) => {
        const matches = getMatchesForEntity(entityId);

        acceptEntity(entityId);
        matches.forEach((entId) => acceptEntity(entId));
    }

    const rejectMatching = (entityId) => {
        const matches = getMatchesForEntity(entityId);

        rejectEntity(entityId);
        matches.forEach((entId) => rejectEntity(entId));
    }

    const acceptAll = () => {
        const filter = getFilter();
        w.entitiesManager.eachEntity((i, entity) => {
            if (entity.getAttribute('_candidate') === 'true' && entity.getCustomValue('nerve') !== 'true') {
                if (filter === 'all' || filter === entity.getType()) {
                    acceptEntity(entity.getId());
                }
            }
        });
        setFilter('all');
    }

    const rejectAll = () => {
        w.event('massUpdateStarted').publish();

        const filter = getFilter();
        w.entitiesManager.eachEntity((i, entity) => {
            if (entity.getAttribute('_candidate') === 'true' && entity.getCustomValue('nerve') !== 'true') {
                if (filter === 'all' || filter === entity.getType()) {
                    rejectEntity(entity.getId());
                }
            }
        });
        setFilter('all');

        w.event('massUpdateCompleted').publish();
    }

    const handleDone = () => {
        isConvert = false;
        $entities.find('.convertActions').hide();
        $entities.find('.subheader').hide();
        $entities.find('.actionOptions').show()
        $entities.find('button.convert').button('option', 'disabled', false) //.next('span').hide();
        pm.update();
    }
    // CONVERSION END

    w.event('loadingDocument').subscribe(() => {
        clear();
        handleDone();
        pm.disable();
    });
    w.event('documentLoaded').subscribe(() => pm.enable(true));
    w.event('schemaLoaded').subscribe(() => pm.update());
    w.event('contentChanged').subscribe(() => pm.update());
    w.event('contentPasted').subscribe(() => pm.update());
    w.event('entityAdded').subscribe(() => pm.update());
    w.event('entityEdited').subscribe(() => pm.update());
    w.event('entityRemoved').subscribe((entityId) => remove(entityId));
    w.event('entityFocused').subscribe((entityId) => {
        $entities.find('ul.entitiesList > li[data-id="' + entityId + '"]').addClass('expanded');
    });
    w.event('entityUnfocused').subscribe(() => {
        $entities.find('ul.entitiesList > li').each(function (index, el) {
            $(this).removeClass('expanded');
        });
    });
    w.event('entityPasted').subscribe(() => pm.update());
    w.event('massUpdateStarted').subscribe(() => pm.disable());
    w.event('massUpdateCompleted').subscribe(() => pm.enable(true));

    // add to writer
    w.entitiesList = pm;

    w.event('entitiesListInitialized').publish(pm);

    return pm;
}