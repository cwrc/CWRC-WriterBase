import { colors, createTheme } from '@material-ui/core';
import { SimplePaletteColorOptions } from '@material-ui/core/styles';

interface Entity {
  color: SimplePaletteColorOptions;
  icon: string;
}

interface Entities {
  person: Entity;
  place: Entity;
  organization: Entity;
  org: Entity;
  title: Entity;
  referencing_string: Entity;
  rs: Entity;
  citation: Entity;
  note: Entity;
  date: Entity;
  correction: Entity;
  keyword: Entity;
  link: Entity;
}

declare module '@material-ui/core/styles' {
  interface Theme {
    entity: Entities;
  }

  interface ThemeOptions {
    entity: Entities;
  }
}

// Update the Button's color prop options
// declare module '@material-ui/core/Button' {
//   interface ButtonPropsColorOverrides {
//     person: true;
//   }
// }

// declare module '@material-ui/core/Icon' {
//   interface ButtonPropsColorOverrides {
//     person: true;
//   }
// }

// declare module '@material-ui/core/SvgIcon' {
//   interface ButtonPropsColorOverrides {
//     person: true;
//   }
// }

const theme = (darkMode: boolean) =>
  createTheme({
    entity: {
      person: {
        color: { main: colors.red[500] },
        icon: 'person',
      },
      place: {
        color: { main: colors.cyan[500] },
        icon: 'place',
      },
      organization: {
        color: { main: colors.deepPurple[500] },
        icon: 'organization',
      },
      org: {
        color: { main: colors.deepPurple[500] },
        icon: 'organization',
      },
      title: {
        color: { main: colors.deepPurple[700] },
        icon: 'title',
      },
      referencing_string: {
        color: { main: colors.lightGreen[700] },
        icon: 'referencing_string',
      },
      rs: {
        color: { main: colors.lightGreen[700] },
        icon: 'referencing_string',
      },
      citation: {
        color: { main: colors.pink[500] },
        icon: 'citation',
      },
      note: {
        color: { main: colors.blue[800] },
        icon: 'note',
      },
      date: {
        color: { main: colors.orange[500] },
        icon: 'date',
      },
      correction: {
        color: { main: colors.red[800] },
        icon: 'correction',
      },
      keyword: {
        color: { main: colors.green[900] },
        icon: 'keyword',
      },
      link: {
        color: { main: colors.lightBlue[500] },
        icon: 'link',
      },
    },
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: colors.orange[800],
      },
      secondary: {
        main: colors.indigo[500],
      },
      // person: {
      //   main: colors.red[500],
      //   // contrastText: '#fff',
      // }
    },
    typography: {
      fontFamily: 'Lato, Helvetica, Arial, sans-serif',
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: `
          @font-face {
            font-family: 'Lato';
            font-style: normal;
            font-display: swap;
            font-weight: 300;
            src: "local('Lato'), local('Lato-Regular')";
            unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF',
          }
        `,
      },
    },
  });

export default theme;
