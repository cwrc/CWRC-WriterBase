import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@material-ui/core';
import Brightness7Icon from '@material-ui/icons/Brightness7';
import DarkModeIcon from '@material-ui/icons/DarkMode';
import SettingsBrightnessIcon from '@material-ui/icons/SettingsBrightness';
import { PaletteMode } from '@src/@types/types';
import React, { FC, MouseEvent, useState } from 'react';
import { useActions, useAppState } from '../../overmind';

const options = [
  { name: 'light', Icon: Brightness7Icon },
  { name: 'system', Icon: SettingsBrightnessIcon },
  { name: 'dark', Icon: DarkModeIcon },
];

const PaletteMode: FC = () => {
  const actions = useActions();
  const { ui } = useAppState();
  const [mode, setMode] = useState<PaletteMode>(ui.paletteMode);

  const changePaletteMode = (event: MouseEvent<HTMLElement>, value: PaletteMode | null) => {
    if (!value) return;

    setMode(value);
    if (value === ui.paletteMode) return;
    actions.ui.setPaletteMode(value);
  };

  return (
    <Box id="show_tags" sx={{ display: 'flex', my: 1.5 }}>
      <Box sx={{ flex: 1, textAlignLast: 'right', pr: 1.5, pt: 1 }}>
        <Typography>Paleette Mode</Typography>
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
        <ToggleButtonGroup
          aria-label="Palette Mode"
          exclusive
          size="small"
          onChange={changePaletteMode}
          value={mode}
        >
          {options.map(({ name, Icon }) => (
            <ToggleButton key={name} aria-label={name} size="small" sx={{ px: 1 }} value={name}>
              <Icon sx={{ mr: 1 }} /> {name}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
    </Box>
  );
};

export default PaletteMode;
