import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Select,
  Typography,
} from '@material-ui/core';
import { Notify } from '@src/@types/types';
import { useAppState } from '@src/overmind';
import React, { FC, useEffect, useState } from 'react';
import Notification from '../Notification';
import useSettings from './useSettings';

const notifyDefault: Notify = {
  hasUndo: false,
  message: '',
  open: false,
};

const EditorMode: FC = () => {
  const { editor } = useAppState();
  const { changeEditorMode, editorModeShouldChange } = useSettings();

  const [dialogMessage, setDialogMessage] = useState<string>();
  const [modeSelected, setModeSelected] = useState<string>();
  const [notify, setNotify] = useState(notifyDefault);
  const [openDialog, setOpenDialog] = useState(false);
  const [previousValue, setPreviousValue] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      setDialogMessage(undefined);
      setModeSelected(undefined);
      setNotify(notifyDefault);
      setOpenDialog(false);
      setPreviousValue(null);
    };
  }, []);

  const handleChange = (editorMode: string) => {
    const [shouldChange, message] = editorModeShouldChange(editorMode);

    if (!shouldChange) return;

    if (!message) return applyChangeEditorMode(editorMode);

    setModeSelected(editorMode);
    setDialogMessage(message.text);
    setOpenDialog(true);
  };

  const handleConfirmChange = () => {
    handleCloseDialog();
    if (!modeSelected) return;
    applyChangeEditorMode(modeSelected);
    setModeSelected(undefined);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const applyChangeEditorMode = (editorModeValue: string, isUndo?: boolean) => {
    setPreviousValue(editor.editorMode);

    const response = changeEditorMode(editorModeValue, isUndo);

    setNotify({ open: true, message: response, hasUndo: isUndo ? false : true });
  };

  const handleCloseNotification = () => {
    setPreviousValue(null);
    setNotify(notifyDefault);
  };

  const handleUndo = () => {
    previousValue ? applyChangeEditorMode(previousValue, true) : handleCloseNotification();
  };

  return (
    <Box id="fontSize" sx={{ display: 'flex', my: 1.5 }}>
      <Box sx={{ flex: 1, textAlignLast: 'right', pr: 1.5, pt: 1 }}>
        <Typography>Editor Mode</Typography>
      </Box>
      <Box sx={{ flex: 2, mt: 0.5, pl: 1 }}>
        <Select
          value={editor.editorMode}
          variant="standard"
          onChange={(event) => handleChange(event.target.value)}
        >
          {editor.editorModes.map(({ value, label }) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </Select>
      </Box>
      <Dialog onClose={handleCloseDialog} open={openDialog}>
        <DialogTitle id="alert-dialog-title">Change Editor Mode?</DialogTitle>
        <DialogContent>
          <DialogContentText>{dialogMessage}</DialogContentText>
          <Typography>Do you wish to continue?</Typography>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={handleCloseDialog}>
            No
          </Button>
          <Button onClick={handleConfirmChange}>Yes</Button>
        </DialogActions>
      </Dialog>
      <Notification
        message={notify.message}
        onClose={handleCloseNotification}
        open={notify.open}
        actionName={notify.hasUndo ? 'undo' : undefined}
        callback={notify.hasUndo ? handleUndo : undefined}
      />
    </Box>
  );
};

export default EditorMode;
