import React from 'react'
import Button from '@material-ui/core/Button';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';

const getSelectComponent = ({id, disabled, value, options, onChange}) => {
    return (
        <Select
            disabled={disabled}
            labelId={id}
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            >
            {options.map(({disabled, value,label}) => (
                <MenuItem key={value} disabled={disabled} value={value}>{label}</MenuItem>
            ))}
        </Select>
    )
}

const getSwitchComponent = ({checked, label, onChange}) => {
    return (
        <FormControlLabel
            control={
            <Switch
                checked={checked}
                onChange={onChange}
                name={label}
                color="primary"
                size="small"
                inputProps={{ 'aria-label': label }}
            />
            }
            label={label}
        />
    )
}

const getButtonComponent = ({id, label, onClick}) => {
    return (
        <Button
            variant="outlined"
            size="small"
            name={id}
            onClick={onClick}>
            {label}
        </Button>
    )
}

const SettingGroup = ({label,inputs }) => (
    <div id="fontSizeContainer" style={{display: 'flex', marginBottom: '10px'}}>
        <div style={{flex: 1, textAlignLast: 'right', paddingRight: '10px', paddingTop: '7px'}}>
            {label}
        </div>
        <div style={{flex: 2}}>
            {inputs.length > 0 &&
            <div stlye={{display: 'flex', flexDirection: 'colunm'}}>
            {inputs.map( (input, i) => (
                <div key={i} style={{marginBottom: '5px'}}>
                    {input.type === 'select' && getSelectComponent(input)}
                    {input.type === 'switch' && getSwitchComponent(input)}
                    {input.type === 'button' && getButtonComponent(input)}
                </div>
            ))}
            </div>
            }
        </div>
    </div>
);

export default SettingGroup;
