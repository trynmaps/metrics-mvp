import React, { useState, useEffect, useRef } from 'react';
import Select, { components } from 'react-select';
import { makeStyles, createMuiTheme } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Fade from '@material-ui/core/Fade';
import Grow from '@material-ui/core/Grow';
import TextField from '@material-ui/core/TextField';
import MenuItem from '@material-ui/core/MenuItem';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';

const transitionDuration = 300;
const eventHandlerDelay = 30;
const theme = createMuiTheme({
  palette: {
    background: {
      focus: 'rgba(0, 0, 0, 0.05)',
    },
  },
});
const useStyles = makeStyles({
  input: {
    display: 'flex',
    '&:focus': {
      backgroundColor: theme.palette.background.focus,
    },
  },
  selectInput: {
    minWidth: '100%',
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
  input: (provided, state) => ({
    ...provided,
    marginLeft: 0,
    marginRight: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    minWidth: state.minWidth,
  }),
};

function Control(props) {
  const {
    children,
    innerProps,
    selectProps: {
      inputId,
      classes,
      textFieldProps,
      isInitialMount,
      setTextFieldDOMRect,
      select,
      setMenuIsOpen,
    },
  } = props;

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      setTextFieldDOMRect(
        document.getElementById(inputId).getBoundingClientRect(),
      );
    }
  });

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
          tabIndex: 0,
          onKeyDown: e => {
            if (e.key === 'Enter' || e.key === 'ArrowDown') {
              select.current.focus();
              setMenuIsOpen(true);
            }
          },
        },
      }}
      {...textFieldProps}
    />
  );
}

function ValueContainer({ children, selectProps: { inputId, classes } }) {
  const input = children[1];
  const singleValue = children[0];

  return (
    <div id={`${inputId}Value`} className={classes.valueContainer}>
      {[input, singleValue]}
    </div>
  );
}

function handleInputKeyUp(inputProps) {
  return () => inputProps.selectProps.setTextFieldDOMRect(
    document.getElementById(inputProps.selectProps.inputId).getBoundingClientRect()
  );
}

function handleInputChange(inputProps) {
  const {
    onChange,
    selectProps: { setInputMinWidth },
  } = inputProps;

  return e => {
    onChange(e);
    if (e.target.value) {
      setInputMinWidth('100%');
      e.target.style.minWidth = '100%';
    } else {
      setInputMinWidth(0);
    }
  };
}

function handleInputBlur(inputProps) {
  return e => {
    inputProps.onBlur(e);
    inputProps.selectProps.setInputMinWidth(0);
  };
}

function Input(props) {
  return (
    <components.Input
      {...props}
      tabIndex={-1}
      // min-width used by input wrapper (selectStyles object)
      minWidth={props.selectProps.inputMinWidth}
      className={props.selectProps.classes.selectInput}
      onKeyUp={handleInputKeyUp(props)}
      onChange={handleInputChange(props)}
      onBlur={handleInputBlur(props)}
    />
  );
}

function Placeholder({ children, selectProps: { classes } }) {
  return (
    <div className={`${classes.textContent} ${classes.placeholder}`}>
      {children}
    </div>
  );
}

function SingleValue({ children, selectProps: { classes } }) {
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
  const {
    children,
    innerProps,
    selectProps: {
      classes,
      focusedOption,
      inputId,
      menuIsOpen,
      menuPlacementTop,
      menuTransition,
      textFieldDOMRect,
    },
  } = props;
  const menuStyle = {};
  const timeout = menuTransition.current ? transitionDuration : 0;
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
    const menu = document.getElementById(`${inputId}Menu`);
    // TODO: get label ref via callback? also in menu list
    const labelHeight = document.getElementById(inputId).parentElement
      .previousSibling.clientHeight;
    const inputHeight = textFieldDOMRect.height + labelHeight;
    const rightWillSlice =
      textFieldDOMRect.left + menu.clientWidth > window.innerWidth;
    const leftWillSlice = textFieldDOMRect.right - menu.clientWidth < 0;
    const idealRightPosition =
      textFieldDOMRect.right - document.documentElement.clientWidth;

    /**
     * check if the right side of the menu will be outside the view
     * if so change the 'right' property of the style object
     * but only if the left side is not cut off in the process, otherwise default positon
     */
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

    /**
     * temporary fix to react-select issue not setting focus to selected value by default
     * may or may not be needed after fixing issue with default focus option
     */
    if (focusedOption.current) {
      focusedOption.current.parentNode.scrollTop =
        focusedOption.current.offsetTop -
        menu.clientHeight / 2 +
        focusedOption.current.clientHeight / 2;
    }
  }, [
    focusedOption,
    inputId,
    menuPlacementTop,
    menuStyleBottom,
    menuStyleRight,
    textFieldDOMRect,
  ]);

  return (
    <Grow
      in={menuIsOpen}
      timeout={timeout}
      style={{ transformOrigin: '0 0 0' }}
    >
      <Fade in={menuIsOpen} timeout={timeout}>
        <Paper
          id={`${inputId}Menu`}
          style={menuStyle}
          className={classes.menu}
          {...innerProps}
        >
          {children}
        </Paper>
      </Fade>
    </Grow>
  );
}

function MenuList(props) {
  const {
    children,
    selectProps: { inputId, menuPlacementTop, textFieldDOMRect },
  } = props;
  let maxHeight;
  const maxHeightLimit =
    document.documentElement.clientHeight - theme.spacing(2);

  // calculates appropriate max height depending on top or bottom menu placement
  if (menuPlacementTop.current) {
    maxHeight =
      textFieldDOMRect.top -
      document.getElementById(inputId).parentElement.previousSibling
        .clientHeight -
      theme.spacing(2);
  } else {
    maxHeight =
      document.documentElement.clientHeight -
      textFieldDOMRect.bottom -
      theme.spacing(2);
  }
  if (maxHeight > maxHeightLimit) maxHeight = maxHeightLimit;

  return (
    <components.MenuList {...props} maxHeight={maxHeight}>
      {children}
    </components.MenuList>
  );
}

function Option(props) {
  const {
    children,
    innerProps,
    innerRef,
    isFocused,
    isSelected,
    data: {
      label,
      value: { icon },
    },
    selectProps: { focusedOption, handleItemMouseOver, handleItemMouseOut },
  } = props;
  const focused = (function() {
    if (isFocused && !isSelected) {
      return {
        backgroundColor: theme.palette.action.hover,
      };
    }
    return {};
  })();

  if (isFocused) {
    handleItemMouseOver(icon, label);
  } else {
    handleItemMouseOut(icon);
  }

  return (
    <MenuItem
      ref={element => {
        if (isSelected) focusedOption.current = element;
        if (innerRef) innerRef(element);
      }}
      selected={isSelected}
      style={focused}
      {...innerProps}
    >
      {children}
    </MenuItem>
  );
}

export default function ReactSelect(selectProps) {
  const classes = useStyles();
  const focusedOption = useRef();
  const select = useRef();
  const isInitialMount = useRef(true);
  // determines whether transitionDuration is used, otherwise 0. Set to false on resize
  const menuTransition = useRef(true);
  const menuPlacementTop = useRef(false);
  const [textFieldDOMRect, setTextFieldDOMRect] = useState({});
  const [menuIsOpen, setMenuIsOpen] = useState(false);
  const [inputMinWidth, setInputMinWidth] = useState(0);

  /**
   * updates textfield location on scroll/resize
   * re-renders menu if open which updates menu placement and max height
   */
  function handleReposition() {
    clearTimeout(window[`${selectProps.inputId}Timeout`]);
    window[`${selectProps.inputId}Timeout`] = setTimeout(() => {
      menuTransition.current = false;
      setTextFieldDOMRect(
        document.getElementById(selectProps.inputId).getBoundingClientRect()
      );
    }, eventHandlerDelay);
  }

  const replacedComponents = {
    Control,
    ValueContainer,
    Input,
    Placeholder,
    SingleValue,
    IndicatorSeparator: () => null,
    DropdownIndicator,
    Menu,
    MenuList,
    Option,
  };

  function handleMenuOpen() {
    menuTransition.current = true;
    setMenuIsOpen(true);
    selectProps.onOpen();
  }

  function handleMenuClose() {
    menuTransition.current = true;
    document.activeElement.blur();
    setMenuIsOpen(false);
    selectProps.onClose();
  }

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
      ref={select}
      select={select}
      setMenuIsOpen={setMenuIsOpen}
      menuIsOpen={menuIsOpen}
      classes={classes}
      components={replacedComponents}
      focusedOption={focusedOption}
      inputMinWidth={inputMinWidth}
      setInputMinWidth={setInputMinWidth}
      isInitialMount={isInitialMount}
      menuPlacementTop={menuPlacementTop}
      menuTransition={menuTransition}
      setTextFieldDOMRect={setTextFieldDOMRect}
      onMenuOpen={handleMenuOpen}
      onMenuClose={handleMenuClose}
      placeholder="Type here to search..."
      styles={selectStyles}
      textFieldDOMRect={textFieldDOMRect}
      value={selectProps.options.filter(
        option => option.value.stopId === selectProps.stopId,
      )}
      {...selectProps}
    />
  );
}
