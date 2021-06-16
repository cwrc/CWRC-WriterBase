import { useApp } from '@src/overmind';

const useSettings = () => {
  const { actions } = useApp();

  return {
    editorModeShouldChange: (
      editorMode: string
    ): [boolean, null | { type: string; text: string }] => {
      const writer = window.writer;

      let doModeChange = false;

      if (editorMode === 'xml' && writer.mode !== writer.XML) {
        doModeChange = true;
      } else if (editorMode === 'xmlrdf') {
        if (writer.mode !== writer.XMLRDF || writer.allowOverlap === true) doModeChange = true;
      } else if (editorMode === 'xmlrdfoverlap') {
        if (writer.mode !== writer.XMLRDF || writer.allowOverlap === false) doModeChange = true;
      } else if (editorMode === 'rdf') {
        if (writer.mode !== writer.RDF || writer.allowOverlap === false) doModeChange = true;
      }

      if (!doModeChange) return [false, null];

      //setModeSelected(editorMode);

      const message = {
        type: '',
        text: '',
      };

      const existingOverlaps = writer.entitiesManager.doEntitiesOverlap();

      // switching to xml mode from an xmlrdf mode
      if (editorMode === 'xml') {
        message.type = 'warning';
        message.text = `
        If you select the XML only mode, no RDF will be created when tagging entities.
        Furthermore, the existing RDF annotations will be discarded.
      `;
      }
      // switching from xml mode to no-overlap
      if (editorMode === 'xmlrdf' && writer.mode === writer.XML) {
        message.type = 'warning';
        message.text = `
        XML tags and RDF/Semantic Web annotations equivalent to the XML tags will be created, consistent with the hierarchy of the XML schema, so annotations will not be allowed to overlap.
      `;
      }
      // switching from no-overlap to overlap
      if (editorMode === 'xmlrdfoverlap' && writer.allowOverlap === false) {
        message.type = 'warning';
        message.text = `
        The editor mode will be switched to XML and RDF (Overlapping Entities) and only RDF will be created for entities that overlap existing XML structures.
      `;
      }
      // switching from overlap to no-overlap
      if (writer.allowOverlap && editorMode !== 'xmlrdfoverlap' && existingOverlaps) {
        message.type = 'warning';
        message.text = `
        You have overlapping entities and are attemping to switch to a mode which prohibits them.
        The overlapping entities will be discarded if you continue.
      `;
      }

      // TODO rdf message
      if (message.text === '') return [true, null];

      return [true, message];
    },

    changeEditorMode: (mode: string, isUndo?: boolean) => {
      const editorMode = actions.editor.setEditorMode(mode);

      let message = isUndo ? 'Editor Mode restored' : 'Editor Mode has changed';
      if (editorMode) message = `${message} to ${editorMode.label}`;

      return message;
    },

    changeAnnotationMode: (value: number, isUndo?: boolean) => {
      const annotationMode = actions.editor.setAnnotationrMode(value);

      let message = isUndo ? 'Annotation Mode restored' : 'Annotation Mode has changed';
      if (annotationMode) message = `${message} to ${annotationMode.label}`;

      return message;
    },

    schemaShouldChange: async (
      schemaId: string
    ): Promise<[boolean, null | { type: string; text: string }]> => {
      const writer = window.writer;

      const currRootName = writer.utilities.getRootTag().attr('_tag');
      const rootName = await writer.schemaManager.getRootForSchema(schemaId);

      const message = {
        type: '',
        text: '',
      };

      if (rootName === null) {
        message.type = 'error';
        message.text =
          'The root element of the schema could not be determined and so it will not be used.';

        return [false, message];
      }

      if (currRootName !== rootName) {
        message.type = 'warning';
        message.text = `
        The root element (${rootName}) required by the selected schema is different from the root element (${currRootName}) of the current document.
        Applying this schema change will cause a document loading error.
        `;
        return [true, message];
      }

      return [true, null];
    },

    changeSchema: (schemaId: string, isUndo?: boolean) => {
      const schema = actions.document.setSchema(schemaId);

      let message = isUndo ? 'Schema restored' : 'Schema has changed';
      if (schema) message = `${message} to ${schema.name}`;

      return message;
    },
  };
};

export default useSettings;
