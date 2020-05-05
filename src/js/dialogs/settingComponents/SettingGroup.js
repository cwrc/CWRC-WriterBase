import React, {Component} from 'react'
import Button from '@material-ui/core/Button';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';

const getSelectComponent = input => {
    return (
        <Select
            labelId={input.label}
            id={input.label}
            value={input.value}
            onChange={(e) => input.onChange(e.target.value)}
            >
            {input.options.map(({value,label}) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
        </Select>
    )
}

const getSwitchComponent = input => {
    return (
        <FormControlLabel
            control={
            <Switch
                checked={input.checked}
                onChange={input.onChange}
                name={input.label}
                color="primary"
                size="small"
                inputProps={{ 'aria-label': input.label }}
            />
            }
            label={input.label}
        />
    )
}

const getButtonComponent = input => {
    return (
        <Button
            variant="outlined"
            size="small"
            name={input.id}
            onClick={input.click}>
            {input.label}
        </Button>
    )
}

const SettingGroup = props => (
    <div id="fontSizeContainer" style={{display: 'flex', marginBottom: '10px'}}>
        <div style={{flex: 1, textAlignLast: 'right', paddingRight: '10px', paddingTop: '7px'}}>
            {props.label}
        </div>
        <div style={{flex: 2}}>
        {props.inputs.length > 0 &&
        <div stlye={{display: 'flex', flexDirection: 'colunm'}}>
            {props.inputs.map( (input, i) => {
                return (
                    <div key={i} style={{marginBottom: '5px'}}>
                        {input.type === 'select' && getSelectComponent(input)}
                        {input.type === 'switch' && getSwitchComponent(input)}
                        {input.type === 'button' && getButtonComponent(input)}
                    </div>
                )   
            })}
        </div>
        }
        </div>
    </div>
);

export default SettingGroup;
