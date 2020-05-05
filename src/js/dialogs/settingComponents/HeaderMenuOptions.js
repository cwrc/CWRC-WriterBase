import React, {Component} from 'react'
import Icon from '@material-ui/core/Icon';
import IconButton from '@material-ui/core/IconButton';
import { makeStyles } from '@material-ui/core/styles'

export default class HeaderMenuOptions extends Component {

    useStyles = makeStyles((theme) => ({
        root: {
            '& > *': {
                margin: theme.spacing(1),
            },
        },
        colorPrimary: '#FFFFFF'
    }));

    openDialog = () => {
        this.props.dialog.dialog('open');
    }

    render() {
        return (
            <div className={this.useStyles.root} style={{textDecoration: "none"}}>
                <IconButton 
                    size="small"
                    onClick={this.openDialog}
                    color="inherit" 
                    className="settingsLink"
                    aria-label="settings">
                    <Icon fontSize="small">settings</Icon>
                </IconButton>
                <IconButton 
                    size="small"
                    href="https://cwrc.ca/Documentation/CWRC-Writer"
                    target="_blank"
                    rel="noopener noreferrer"
                    color="inherit" 
                    className="helpLink"
                    aria-label="help">
                    <Icon fontSize="small">help</Icon>
                </IconButton>
            </div>
        )
    }
}
