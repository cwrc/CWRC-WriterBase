import { Box, FormControlLabel, Switch, Typography } from '@material-ui/core';
import React, { ChangeEvent, FC } from 'react';
import { useActions, useAppState } from '@src/overmind';

const ShowTags: FC = () => {
  const actions = useActions();
  const { editor } = useAppState();

  const handleChangeShowTags = (event: ChangeEvent<HTMLInputElement>) => {
    actions.editor.showTags(event.target.checked);
  };

  const handleChangeShowEntities = (event: ChangeEvent<HTMLInputElement>) => {
    actions.editor.showEntities(event.target.checked);
  };

  return (
    <Box id="show_tags" sx={{ display: 'flex', my: 1.5 }}>
      <Box sx={{ flex: 1, textAlignLast: 'right', pr: 1.5, pt: 1 }}>
        <Typography>Show</Typography>
      </Box>
      <Box
        sx={{
          flex: 2,
          display: 'flex',
          flexDirection: 'column',
          mt: 0.75,
          pl: 1,
        }}
      >
        {/* <FormControlLabel
          control={
            <Switch
              checked={editor.showTags}
              color="primary"
              inputProps={{ 'aria-label': 'Tags' }}
              name="Tags"
              onChange={handleChangeShowTags}
              size="small"
            />
          }
          label="Tags"
        /> */}
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={editor.showEntities}
              inputProps={{ 'aria-label': 'Entities' }}
              name="Entities"
              onChange={handleChangeShowEntities}
              size="small"
            />
          }
          label="Entities"
        />
      </Box>
    </Box>
  );
};

export default ShowTags;
