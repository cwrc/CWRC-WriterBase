import { createMuiTheme, colors } from '@material-ui/core';

const theme = (darkMode) =>
  createMuiTheme({
    palette: {
      type: darkMode ? 'dark' : 'light',
      primary: {
        main: colors.orange[800],
      },
      secondary: {
        main: colors.indigo[500],
      },
    },
  });

export default theme;
