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
import { Notify, Schema } from '@src/@types/types';
import { useApp } from '@src/overmind';
import React, { FC, useEffect, useState } from 'react';
import Notification from '../Notification';
import useSettings from '../settings/useSettings';
import AddSchemaDialog from './AddSchemaDialog';

const notifyDefault: Notify = {
  hasUndo: false,
  message: '',
  open: false,
};

const Schema: FC = () => {
  const { state, actions } = useApp();
  const { changeSchema, schemaShouldChange } = useSettings();

  const [dialogMessage, setDialogMessage] = useState<string>();
  const [dialogType, setDialogType] = useState('warning');
  const [notify, setNotify] = useState(notifyDefault);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [schemaSelected, setSchemaSelected] = useState<string>('');

  useEffect(() => {
    if (state.document.schemaId === '') {
      const schema = window.writer.schemaManager.getCurrentSchema();
      actions.document.setInitialStateSchema(schema.id);
    }
    return () => {
      setDialogMessage(undefined);
      setDialogType('warning');
      setNotify(notifyDefault);
      setOpenAddDialog(false);
      setOpenDialog(false);
      setPreviousValue(null);
      setSchemaSelected('');
    };
  }, []);

  const handleChange = async (schemaId: string) => {
    const [shouldChange, message] = await schemaShouldChange(schemaId);

    if (!shouldChange) {
      if (message) {
        setDialogType(message.type);
        setDialogMessage(message.text);
        setOpenDialog(true);
      }
      return;
    }

    //shouldChange: true
    setSchemaSelected(schemaId);

    if (message) {
      setDialogType(message.type);
      setDialogMessage(message.text);
      setOpenDialog(true);
      return;
    }

    doChangeSchema(schemaId);
  };

  const handleConfirmChange = () => {
    doChangeSchema(schemaSelected);
    handleCloseDialog();
  };

  const doChangeSchema = (schemaId: string, isUndo?: boolean) => {
    setPreviousValue(state.document.schemaId);

    const response = changeSchema(schemaId, isUndo);

    setNotify({ open: true, message: response, hasUndo: isUndo ? false : true });
  };

  const handleCloseDialog = () => setOpenDialog(false);

  const handleAddSchema = () => {
    setOpenAddDialog(true);
  };

  const handleCloseAddDialog = () => {
    setOpenAddDialog(false);
  };

  const handleCloseNotification = () => {
    setPreviousValue(null);
    setNotify(notifyDefault);
  };

  const handleUndo = () => {
    previousValue ? doChangeSchema(previousValue, true) : handleCloseNotification();
  };

  return (
    <Box id="fontSize" sx={{ display: 'flex', my: 1.5 }}>
      <Box sx={{ flex: 1, textAlignLast: 'right', pr: 1.5, pt: 1 }}>
        <Typography>Schema</Typography>
      </Box>
      <Box sx={{ display: 'flex', columnGap: 2, flex: 2, mt: 0.5, pl: 1 }}>
        <Select
          value={state.document.schemaId}
          variant="standard"
          onChange={(event) => handleChange(event.target.value)}
        >
          {state.editor.schemas.map(({ id, name }) => (
            <MenuItem key={id} value={id}>
              {name}
            </MenuItem>
          ))}
        </Select>
        <Button color="inherit" onClick={handleAddSchema} variant="outlined">
          Add
        </Button>
      </Box>
      <AddSchemaDialog handleClose={handleCloseAddDialog} open={openAddDialog} />
      <Dialog onClose={handleCloseDialog} open={openDialog}>
        <DialogTitle id="alert-dialog-title">Change Schema?</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">{dialogMessage}</DialogContentText>
          <Typography>Do you wish to continue?</Typography>
        </DialogContent>
        <DialogActions>
          {dialogType === 'error' ? (
            <Button autoFocus onClick={handleCloseDialog}>
              Ok
            </Button>
          ) : (
            <>
              <Button autoFocus onClick={handleCloseDialog}>
                No
              </Button>
              <Button onClick={handleConfirmChange}>Yes</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
      <Notification
        onClose={handleCloseNotification}
        message={notify.message}
        open={notify.open}
        actionName={notify.hasUndo ? 'undo' : undefined}
        callback={notify.hasUndo ? handleUndo : undefined}
      />
    </Box>
  );
};

export default Schema;
