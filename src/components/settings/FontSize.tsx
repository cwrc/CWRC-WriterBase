import { Box, MenuItem, Select, Typography } from '@material-ui/core';
import React, { FC } from 'react';
import { useApp } from '../../overmind';

const FontSize: FC = () => {
  const { state, actions } = useApp();

  const handleChange = (value: string) => {
    actions.editor.setFontSize(value);
  };

  return (
    <Box id="fontSize" sx={{ display: 'flex', my: 1.5 }}>
      <Box sx={{ flex: 1, textAlignLast: 'right', pr: 1.5, pt: 1 }}>
        <Typography>Size</Typography>
      </Box>
      <Box sx={{ flex: 2, mt: 0.5, pl: 1 }}>
        <Select
          value={state.editor.currentFontSize}
          variant="standard"
          onChange={(event) => handleChange(event.target.value)}
        >
          {state.editor.fontSizeOptions.map((size) => (
            <MenuItem key={size} value={size}>
              {size}
            </MenuItem>
          ))}
        </Select>
      </Box>
    </Box>
  );
};

export default FontSize;
