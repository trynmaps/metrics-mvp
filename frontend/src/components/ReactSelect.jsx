import React, { useState, useEffect, useRef } from 'react';
import Select, { components } from 'react-select';
import { makeStyles, createMuiTheme } from '@material-ui/core/styles';
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
    zIndex: 1200,
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
  const theme = createMuiTheme();
  const transitionDuration = 400;
  const eventHandlerDelay = 100;
  const scrollbarWidth = useRef(0);
  const isInitialMount = useRef(true);
  const menuPlacementTop = useRef(false);
  const [textFieldDOMRect, setTextFieldDOMRect] = useState({});

  function handleReposition() {
    clearTimeout(window[`${selectProps.inputId}Timeout`]);
    window[`${selectProps.inputId}Timeout`] = setTimeout(() => {
      setTextFieldDOMRect(
        document.getElementById(selectProps.inputId).getBoundingClientRect(),
      );
    }, eventHandlerDelay);
  }

  function Control({ children, innerProps }) {
    useEffect(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        setTextFieldDOMRect(
          document.getElementById(selectProps.inputId).getBoundingClientRect(),
        );
      }
    });

    return (
      <TextField
        id={selectProps.inputId}
        fullWidth
        InputProps={{
          inputComponent: 'div',
          inputProps: {
            children,
            ...innerProps,
            className: classes.input,
          },
        }}
        {...selectProps.textFieldProps}
      />
    );
  }

  function ValueContainer({ children }) {
    const input = children[1];
    const singleValue = children[0];

    return (
      <div
        id={`${selectProps.inputId}Value`}
        className={classes.valueContainer}
      >
        {[input, singleValue]}
      </div>
    );
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
    const menuStyle = {};
    const [menuStyleRight, setMenuStyleRight] = useState(0);
    const [menuStyleBottom, setMenuStyleBottom] = useState(0);
    menuPlacementTop.current =
      textFieldDOMRect.top >
      document.documentElement.clientHeight - textFieldDOMRect.bottom;

    if (menuStyleRight) {
      menuStyle.right = menuStyleRight;
    }

    if (menuStyleBottom) {
      menuStyle.bottom = menuStyleBottom;
    }

    useEffect(() => {
      const menu = document.getElementById(`${selectProps.inputId}Menu`);
      const inputHeight =
        textFieldDOMRect.height +
        document.getElementById(selectProps.inputId).parentElement
          .previousSibling.clientHeight;
      const rightWillSlice =
        textFieldDOMRect.left + menu.clientWidth + scrollbarWidth.current >
        window.innerWidth;
      const leftWillSlice = textFieldDOMRect.right - menu.clientWidth < 0;
      const idealRightPosition =
        textFieldDOMRect.right -
        document.documentElement.clientWidth +
        scrollbarWidth.current;

      if (rightWillSlice && !leftWillSlice) {
        if (menuStyleRight !== idealRightPosition) {
          setMenuStyleRight(idealRightPosition);
        }
      } else if (menuStyleRight) {
        setMenuStyleRight(0);
      }

      if (menuPlacementTop.current) {
        if (menuStyleBottom !== inputHeight) {
          setMenuStyleBottom(inputHeight);
        }
      } else if (menuStyleBottom) {
        setMenuStyleBottom(0);
      }

      document
        .getElementById(`${selectProps.inputId}Value`)
        .firstChild.firstChild.firstChild.focus();
    }, [menuStyleRight, menuStyleBottom]);

    return (
      <Grow
        in={props.selectProps.menuIsOpen}
        timeout={transitionDuration}
        style={{ transformOrigin: '0 0 0' }}
      >
        <Fade in={props.selectProps.menuIsOpen} timeout={transitionDuration}>
          <Paper
            id={`${selectProps.inputId}Menu`}
            style={menuStyle}
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
    let maxHeight;

    if (menuPlacementTop.current) {
      maxHeight =
        textFieldDOMRect.top -
        document.getElementById(selectProps.inputId).parentElement
          .previousSibling.clientHeight -
        theme.spacing(2);
    } else {
      maxHeight =
        document.documentElement.clientHeight -
        textFieldDOMRect.bottom -
        theme.spacing(2);
    }

    return (
      <components.MenuList {...props} maxHeight={maxHeight}>
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

  useEffect(() => {
    window.addEventListener('scroll', handleReposition);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition);
      window.removeEventListener('resize', handleReposition);
    };
  });

  return (
    <Select
      components={replacedComponents}
      onMenuOpen={() => {
        const overflow = document.body.style.overflow;
        if (overflow === 'visible' || !overflow) {
          scrollbarWidth.current =
            window.innerWidth - document.documentElement.clientWidth;
        }
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = `${scrollbarWidth.current}px`;
      }}
      onMenuClose={() => {
        document.body.style.overflow = 'visible';
        document.body.style.paddingRight = 0;
      }}
      styles={selectStyles}
      placeholder="Type here to search..."
      value={selectProps.options.filter(
        option => option.value === selectProps.stopId,
      )}
      {...selectProps}
    />
  );
}
