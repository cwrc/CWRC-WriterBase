import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grow,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import { Notify } from '@src/@types/types';
import { useApp } from '@src/overmind';
import React, { FC, MouseEvent, useEffect, useState } from 'react';
import Notification from '../Notification';
import AddSchemaDialog from '../settings/AddSchemaDialog';
import useSettings from '../settings/useSettings';

const notifyDefault: Notify = {
  hasUndo: false,
  message: '',
  open: false,
};

const Schema: FC = () => {
  const { state } = useApp();
  const { changeSchema, schemaShouldChange } = useSettings();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [dialogType, setDialogType] = useState('warning');
  const [dialogMessage, setDialogMessage] = useState<string>();
  const [notify, setNotify] = useState(notifyDefault);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [schemaSelected, setSchemaSelected] = useState<string>('');

  const openMenu = Boolean(anchorEl);

  useEffect(() => {
    // if (state.document.schemaId === '') {
    //   const schema = window.writer.schemaManager.getCurrentSchema();
    //   actions.document.setInitialStateSchema(schema.id);
    // }
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

  const handleButtonClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleChange = async (schemaId?: string) => {
    handleMenuClose();
    if (!schemaId) return;
    if (schemaId === state.document.schemaId) return;

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
    <Grow in={state.document.schemaId !== ''}>
      <Box>
        {/* <Stack direction="row" spacing={1} alignItems="center"> */}
        {/* <Typography variant="caption" sx={{ cursor: 'default' }}>
                Schema
              </Typography> */}
        <Tooltip title="Schema">
          <Button
            aria-controls="schema-menu"
            aria-expanded={openMenu ? 'true' : undefined}
            aria-haspopup="true"
            disabled={state.editor.isReadonly}
            id="schema-select"
            onClick={handleButtonClick}
            size="small"
            sx={{ color: 'text.primary' }}
          >
            {state.document.schemaName}
          </Button>
        </Tooltip>
        <Menu
          anchorEl={anchorEl}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          aria-labelledby="schema-select"
          id="schema-menu"
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
            justifyContent="space-between"
            alignItems="center"
            mt={-0.5}
            mb={0.5}
            px={0.5}
            sx={{
              cursor: 'default',
              background: ({ palette }) => palette.action.hover,
            }}
          >
            <Box height={1.5} width={1.5} p="3px" />
            <Typography sx={{ cursor: 'default' }} variant="caption">
              Schema
            </Typography>
            <IconButton aria-label="add" onClick={handleAddSchema} size="small">
              <AddIcon
                fontSize="inherit"
                sx={{
                  height: ({ spacing }) => spacing(1.5),
                  width: ({ spacing }) => spacing(1.5),
                }}
              />
            </IconButton>
          </Box>
          {/* <Box mx={0.5}>
          <Button
            onClick={handleAddSchema}
            size="small"
            color="inherit"
            variant="outlined"
            fullWidth
          >
            Add Schema
          </Button>
        </Box> */}
          {state.editor.schemas.map(({ id, name }) => (
            <MenuItem
              key={id}
              dense
              onClick={() => handleChange(id)}
              selected={id === state.document.schemaId}
              sx={{
                mx: 0.5,
                borderRadius: 1,
              }}
              value={id}
            >
              {name}
            </MenuItem>
          ))}
        </Menu>
        <AddSchemaDialog handleClose={handleCloseAddDialog} open={openAddDialog} />
        <Dialog onClose={handleCloseDialog} open={openDialog}>
          <DialogTitle>Change Schema?</DialogTitle>
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
        {/* </Stack> */}
      </Box>
    </Grow>
  );
};

export default Schema;
