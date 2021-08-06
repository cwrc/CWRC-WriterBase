import { Button, FormControlLabel, MenuItem, Select, Switch } from '@material-ui/core';
import React from 'react';

const getSelectComponent = ({ id, disabled, value, options, onChange }) => {
	return (
		<Select
      disabled={disabled}
      id={id}
      labelId={id}
      onChange={(e) => onChange(e.target.value)}
      value={value}
    >
			{options.map(({ disabled, value, label }) => (
				<MenuItem key={value} disabled={disabled} value={value}>
					{label}
				</MenuItem>
			))}
		</Select>
	);
};

const getSwitchComponent = ({ checked, label, onChange }) => {
	return (
		<FormControlLabel
			control={
				<Switch
          color="primary"
					checked={checked}
          inputProps={{ 'aria-label': label }}
          name={label}
					onChange={onChange}
					size="small"
				/>
			}
			label={label}
		/>
	);
};

const getButtonComponent = ({ id, label, onClick }) => {
	return (
		<Button name={id} onClick={onClick} size="small" variant="outlined" >
			{label}
		</Button>
	);
};

const SettingGroup = ({ label, inputs }) => (
	<div id="fontSizeContainer" style={{ display: 'flex', marginBottom: '10px' }}>
		<div
      style={{ flex: 1, textAlignLast: 'right', paddingRight: '10px', paddingTop: '7px' }}
    >
      {label}
    </div>
		<div style={{ flex: 2 }}>
			{inputs.length > 0 && (
				<div stlye={{ display: 'flex', flexDirection: 'colunm' }}>
					{inputs.map((input, i) => (
						<div key={i} style={{ marginBottom: '5px' }}>
							{input.type === 'select' && getSelectComponent(input)}
							{input.type === 'switch' && getSwitchComponent(input)}
							{input.type === 'button' && getButtonComponent(input)}
						</div>
					))}
				</div>
			)}
		</div>
	</div>
);

export default SettingGroup;
