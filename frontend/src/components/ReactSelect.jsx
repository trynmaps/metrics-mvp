import React, { useState, useEffect, useRef } from 'react';
import Select, { components } from 'react-select';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Fade from '@material-ui/core/Fade';
import Grow from '@material-ui/core/Grow';
import TextField from '@material-ui/core/TextField';
import MenuItem from '@material-ui/core/MenuItem';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';

const useStyles = makeStyles({
  input: {
    display: 'flex',
  },
  valueContainer: {
    display: 'flex',
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    maxWidth: '100%',
  },
  textContent: {
    display: 'flex',
    flex: 1,
    whiteSpace: 'nowrap',
  },
  placeholder: {
    color: 'hsl(0, 0%, 75%)',
  },
  menu: {
    position: 'absolute',
    zIndex: 1000,
  },
});

const selectStyles = {
  dropdownIndicator: provided => ({
    ...provided,
    paddingLeft: 0,
    paddingRight: 0,
  }),
  input: provided => ({
    ...provided,
    marginLeft: 0,
    marginRight: 0,
    maxWidth: '100%',
    overflow: 'hidden',
  }),
};

export default function ReactSelect(selectProps) {
  const classes = useStyles();
  const timeout = 400;
  let textFieldRect;

  const isInitialMount = useRef(true);
  const menuStyle = useRef({});
  const scrollbarWidth = useRef(0);
  const [menuToggle, setMenuToggle] = useState(false);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      let menuWidth = document.getElementById(`${selectProps.inputId}Menu`);
      if (menuWidth) {
        menuWidth = menuWidth.clientWidth;
        const windowWidth = window.innerWidth;
        const rightWillSlice =
          textFieldRect.left + menuWidth + scrollbarWidth.current > windowWidth;
        const leftWillSlice = textFieldRect.right - menuWidth < 0;
        menuStyle.current =
          rightWillSlice && !leftWillSlice
            ? {
                right:
                  textFieldRect.right -
                  document.body.clientWidth +
                  scrollbarWidth.current,
              }
            : {};
      }
    }
  }, [menuToggle, selectProps.inputId, textFieldRect, scrollbarWidth]);

  function Control(props) {
    const {
      innerProps,
      children,
      selectProps: { textFieldProps, inputId },
    } = props;

    return (
      <TextField
        id={inputId}
        fullWidth
        InputProps={{
          inputComponent: 'div',
          inputProps: {
            children,
            ...innerProps,
            className: classes.input,
          },
        }}
        {...textFieldProps}
      />
    );
  }

  function ValueContainer({ children }) {
    const input = children[1];
    const singleValue = children[0];

    return <div className={classes.valueContainer}>{[input, singleValue]}</div>;
  }

  function Placeholder({ children }) {
    return (
      <div className={`${classes.textContent} ${classes.placeholder}`}>
        {children}
      </div>
    );
  }

  function SingleValue({ children }) {
    return <div className={classes.textContent}>{children}</div>;
  }

  function DropdownIndicator(props) {
    return (
      <components.DropdownIndicator {...props}>
        <ArrowDropDownIcon color="action" />
      </components.DropdownIndicator>
    );
  }

  function Menu(props) {
    return (
      <Grow
        in={props.selectProps.menuIsOpen}
        timeout={timeout}
        style={{ transformOrigin: '0 0 0' }}
      >
        <Fade in={props.selectProps.menuIsOpen} timeout={timeout}>
          <Paper
            id={`${props.selectProps.inputId}Menu`}
            style={menuStyle.current}
            className={classes.menu}
            {...props.innerProps}
          >
            {props.children}
          </Paper>
        </Fade>
      </Grow>
    );
  }

  function MenuList(props) {
    textFieldRect = document
      .getElementById(props.selectProps.inputId)
      .getBoundingClientRect();

    return (
      <components.MenuList
        {...props}
        maxHeight={`calc(${document.body.clientHeight}px - ${textFieldRect.bottom}px - 16px)`}
      >
        {props.children}
      </components.MenuList>
    );
  }

  function Option(props) {
    const focused = (function() {
      if (props.isFocused && !props.isSelected) {
        return {
          backgroundColor: 'rgba(0, 0, 0, 0.08)',
        };
      }
      return {};
    })();

    return (
      <MenuItem
        ref={props.innerRef}
        selected={props.isSelected}
        style={focused}
        {...props.innerProps}
      >
        {props.children}
      </MenuItem>
    );
  }

  const replacedComponents = {
    Control,
    ValueContainer,
    Placeholder,
    SingleValue,
    IndicatorSeparator: () => null,
    DropdownIndicator,
    Menu,
    MenuList,
    Option,
  };

  return (
    <Select
      components={replacedComponents}
      onMenuOpen={() => {
        if (!menuToggle) {
          scrollbarWidth.current =
            window.innerWidth - document.body.clientWidth;
        }
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = `${scrollbarWidth.current}px`;
        setMenuToggle(true);
      }}
      onMenuClose={() => {
        document.body.style.overflow = 'visible';
        document.body.style.paddingRight = 0;
        setMenuToggle(false);
      }}
      menuPlacement="auto"
      styles={selectStyles}
      placeholder="Type here to search..."
      value={selectProps.options.filter(
        option => option.value === selectProps.stopId,
      )}
      {...selectProps}
    />
  );
}
