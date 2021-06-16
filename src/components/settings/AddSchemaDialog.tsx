import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@material-ui/core';
import { Schema } from '@src/@types/types';
import { Formik } from 'formik';
import React, { FC } from 'react';
import * as yup from 'yup';
import { useApp } from '../../overmind';

interface AddSchemaDialogProps {
  handleClose: (schema?: Schema) => void;
  open: boolean;
}

const initialValues: Schema = {
  name: '',
  cssUrl: '',
  xmlUrl: '',
};

const formValidation = yup.object().shape({
  name: yup.string().min(3).required('must be have at least ${min} chatacters'),
  cssUrl: yup.string().required().url('Must be a valid URL'),
  xmlUrl: yup.string().required().url('Must be a valid URL'),
});

const AddSchemaDialog: FC<AddSchemaDialogProps> = ({ handleClose, open }) => {
  const { actions } = useApp();

  const submit = (schema: Schema) => {
    actions.editor.addShema(schema);
    handleClose();
  };

  const close = () => handleClose();

  return (
    <Dialog aria-labelledby="form-dialog-title" onClose={close} open={open}>
      <DialogTitle id="form-dialog-title">Add Schema</DialogTitle>
      <Formik
        enableReinitialize={true}
        initialValues={initialValues}
        onSubmit={submit}
        validationSchema={formValidation}
      >
        {({ errors, handleBlur, handleChange, handleSubmit, touched, values }) => (
          <form onSubmit={handleSubmit}>
            <DialogContent>
              <TextField
                autoFocus
                error={Boolean(touched.name && errors.name)}
                fullWidth
                helperText={touched.name && errors.name}
                label="Schema Name"
                margin="dense"
                name="name"
                onBlur={handleBlur}
                onChange={handleChange}
                value={values.name}
                variant="standard"
              />
              <TextField
                error={Boolean(touched.xmlUrl && errors.xmlUrl)}
                fullWidth
                helperText={touched.xmlUrl && errors.xmlUrl}
                label="Schema URL"
                margin="dense"
                name="xmlUrl"
                onBlur={handleBlur}
                onChange={handleChange}
                placeholder="https://"
                value={values.xmlUrl}
                variant="standard"
              />
              <TextField
                error={Boolean(touched.cssUrl && errors.cssUrl)}
                fullWidth
                helperText={touched.cssUrl && errors.cssUrl}
                label="Schema CSS URL"
                margin="dense"
                name="cssUrl"
                onBlur={handleBlur}
                onChange={handleChange}
                placeholder="https://"
                value={values.cssUrl}
                variant="standard"
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={close}>Cancel</Button>
              <Button type="submit">Add</Button>
            </DialogActions>
          </form>
        )}
      </Formik>
    </Dialog>
  );
};

export default AddSchemaDialog;
