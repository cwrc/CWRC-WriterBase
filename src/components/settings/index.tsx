import { Box, Dialog, DialogContent, DialogTitle, Divider } from '@material-ui/core';
import React, { FC, useEffect } from 'react';
import { useApp } from '../../overmind';
import AnnotationMode from './AnnotationMode';
import EditorMode from './EditorMode';
import FontSize from './FontSize';
import Resets from './Resets';
import Schema from './Schema';
import ShowTags from './ShowTags';

interface SettingsDialogProps {
  open: boolean;
  handleClose: () => void;
}

const SettingsDialog: FC<SettingsDialogProps> = ({ open, handleClose }) => {
  const { state, actions } = useApp();

  useEffect(() => {
    if (!window.writer) return;
    if (window.writer.isReadOnly) actions.editor.toggleAdvancedSettings(false);
    return () => {};
  }, []);

  return (
    <Dialog aria-labelledby="title" fullWidth maxWidth="sm" onClose={handleClose} open={open}>
      <DialogTitle id="title">Settings</DialogTitle>
      <DialogContent>
        <FontSize />
        <ShowTags />
        {/* {!state.editor.isReadonly && (
          <Box>
            <Divider/>
            <EditorMode />
            <AnnotationMode />
            <Divider/>
            <Schema />
          </Box>
        )} */}
        <Divider />
        <Resets />
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
