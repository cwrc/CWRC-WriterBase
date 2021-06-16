import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { Notify } from '@src/@types/types';
import { useApp } from '@src/overmind';
import React, { FC, MouseEvent, useEffect, useState } from 'react';
import Notification from '../Notification';
import useSettings from '../settings/useSettings';

const notifyDefault: Notify = {
  hasUndo: false,
  message: '',
  open: false,
};

const EditorMode: FC = () => {
  const { state } = useApp();
  const { changeEditorMode, editorModeShouldChange } = useSettings();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [dialogMessage, setDialogMessage] = useState<string>();
  const [modeSelected, setModeSelected] = useState<string>();
  const [notify, setNotify] = useState(notifyDefault);
  const [openDialog, setOpenDialog] = useState(false);
  const [previousValue, setPreviousValue] = useState<string | null>(null);

  const openMenu = Boolean(anchorEl);

  useEffect(() => {
    return () => {
      setDialogMessage(undefined);
      setModeSelected(undefined);
      setNotify(notifyDefault);
      setOpenDialog(false);
      setPreviousValue(null);
    };
  }, []);

  const handleButtonClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleChange = (editorMode: string) => {
    handleMenuClose();
    if (editorMode === state.editor.editorMode) return;

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
    setPreviousValue(state.editor.editorMode);

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
    <Box>
      {/* <Stack direction="row" spacing={1} alignItems="center"> */}
      {/* <Typography variant="caption" sx={{ cursor: 'default' }}>
        Editor
      </Typography> */}
      <Tooltip title="Editor Mode">
        <Button
          aria-controls="editor-mode-menu"
          aria-expanded={openMenu ? 'true' : undefined}
          aria-haspopup="true"
          disabled={state.editor.isReadonly}
          id="editor-mode-select"
          onClick={handleButtonClick}
          size="small"
          sx={{ color: 'text.primary' }}
        >
          {state.editor.editorModeLabel}
        </Button>
      </Tooltip>
      <Menu
        aria-labelledby="editor-mode-select"
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        id="editor-mode-menu"
        MenuListProps={{
          sx: {
            py: 0.5,
            borderRadius: 1,
          },
        }}
        onClose={handleMenuClose}
        open={openMenu}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box
          display="flex"
          justifyContent="center"
          mt={-0.5}
          mb={0.5}
          sx={{
            cursor: 'default',
            background: ({ palette }) => palette.action.hover,
          }}
        >
          <Typography sx={{ cursor: 'default' }} variant="caption">
            Editor Mode
          </Typography>
        </Box>
        {state.editor.editorModes.map(({ value, label }) => (
          <MenuItem
            key={value}
            dense
            onClick={() => handleChange(value)}
            selected={value === state.editor.editorMode}
            sx={{
              mx: 0.5,
              borderRadius: 1,
            }}
            value={value}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>

      <Dialog onClose={handleCloseDialog} open={openDialog}>
        <DialogTitle>Change Editor Mode?</DialogTitle>
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
      {/* </Stack> */}
    </Box>
  );
};

export default EditorMode;
