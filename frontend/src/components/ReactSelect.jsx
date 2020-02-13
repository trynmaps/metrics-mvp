import React, { useState, useEffect, useRef } from 'react';
import Select, { components } from 'react-select';
import { makeStyles, createMuiTheme } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Fade from '@material-ui/core/Fade';
import Grow from '@material-ui/core/Grow';
import TextField from '@material-ui/core/TextField';
import MenuItem from '@material-ui/core/MenuItem';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';

const transitionDuration = 350;
const scrollHandlerDelay = 30;
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

/**
 * handles keyup when textfield is focused via tab key
 * input element is focused on Enter/ArrowDown
 */
function handleTextKeyUp(controlProps) {
  return e => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      controlProps.selectProps.selectRef.current.focus();
      controlProps.selectProps.setMenuIsOpen(true);
    }
  };
}

function Control(props) {
  const {
    children,
    innerProps,
    selectProps: { labelRef, textRef, classes, textFieldProps },
  } = props;
  const inputLabelProps = textFieldProps.InputLabelProps;
  inputLabelProps.ref = labelRef;

  return (
    <TextField
      ref={textRef}
      fullWidth
      InputProps={{
        inputComponent: 'div',
        inputProps: {
          children,
          ...innerProps,
          className: classes.input,
          tabIndex: 0,
          onKeyUp: handleTextKeyUp(props),
        },
      }}
      label={textFieldProps.label}
      InputLabelProps={inputLabelProps}
    />
  );
}

function ValueContainer(props) {
  const {
    children,
    selectProps: { classes },
  } = props;
  const input = children[1];
  const singleValue = children[0];

  return <div className={classes.valueContainer}>{[input, singleValue]}</div>;
}

function handleInputKeyUp(inputProps) {
  const {
    selectProps: { setTextFieldDOMRect, textRef },
  } = inputProps;
  return () => setTextFieldDOMRect(textRef.current.getBoundingClientRect());
}

/**
 * sets min-width of select input wrapper to 100% when input value exists
 * allows input cursor to be moved by clicking on blank space within textfield
 */
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
      // min-width used by select input wrapper (selectStyles object)
      minWidth={props.selectProps.inputMinWidth}
      className={props.selectProps.classes.selectInput}
      onKeyUp={handleInputKeyUp(props)}
      onChange={handleInputChange(props)}
      onBlur={handleInputBlur(props)}
    />
  );
}

function Placeholder(props) {
  const {
    children,
    selectProps: { classes },
  } = props;

  return (
    <div className={`${classes.textContent} ${classes.placeholder}`}>
      {children}
    </div>
  );
}

function SingleValue(props) {
  return (
    <div className={props.selectProps.classes.textContent}>
      {props.children}
    </div>
  );
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
      focusedOptionRef,
      labelRef,
      menuRef,
      menuIsOpenTransition,
      menuPlacementTop,
      menuTransition,
      textFieldDOMRect,
    },
  } = props;
  const menuStyle = {};
  const timeout = menuTransition.current ? transitionDuration : 0;
  const [menuStyleRight, setMenuStyleRight] = useState(0);
  const [menuStyleBottom, setMenuStyleBottom] = useState(0);

  // evaluates true if there is more space for the menu above the textfield rather than below
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
    const labelHeight = labelRef.current.clientHeight;
    const inputHeight = textFieldDOMRect.height + labelHeight;
    const rightWillSlice =
      textFieldDOMRect.left + menuRef.current.clientWidth > window.innerWidth;
    const leftWillSlice =
      textFieldDOMRect.right - menuRef.current.clientWidth < 0;
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

    // temporary fix to react-select issue not setting focus to selected value by default
    if (focusedOptionRef.current) {
      focusedOptionRef.current.parentNode.scrollTop =
        focusedOptionRef.current.offsetTop -
        menuRef.current.clientHeight / 2 +
        focusedOptionRef.current.clientHeight / 2;
    }
  }, [
    focusedOptionRef,
    labelRef,
    menuRef,
    menuPlacementTop,
    menuStyleBottom,
    menuStyleRight,
    textFieldDOMRect,
  ]);

  return (
    <Grow
      in={menuIsOpenTransition}
      timeout={timeout}
      style={{ transformOrigin: '0 0 0' }}
    >
      <Fade in={menuIsOpenTransition} timeout={timeout}>
        <Paper
          ref={menuRef}
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
    selectProps: { labelRef, menuPlacementTop, textFieldDOMRect },
  } = props;
  let maxHeight;
  const maxHeightLimit =
    document.documentElement.clientHeight - theme.spacing(2);

  // calculates appropriate max height depending on top or bottom menu placement
  if (menuPlacementTop.current) {
    maxHeight =
      textFieldDOMRect.top - labelRef.current.clientHeight - theme.spacing(2);
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

function optionRef(optionProps) {
  const {
    innerRef,
    isSelected,
    selectProps: { focusedOptionRef },
  } = optionProps;

  return element => {
    if (isSelected) focusedOptionRef.current = element;
    if (innerRef) innerRef(element);
  };
}

function Option(props) {
  const {
    children,
    innerProps,
    isFocused,
    isSelected,
    data: { value },
    selectProps: { onItemMouseOver, onItemMouseOut },
  } = props;
  const focusedStyle = {};

  if (isFocused) {
    if (onItemMouseOver) {
      onItemMouseOver(value);
    }
    if (!isSelected) focusedStyle.backgroundColor = theme.palette.action.hover;
  } else if (onItemMouseOut) {
    onItemMouseOut(value);
  }

  return (
    <MenuItem
      ref={optionRef(props)}
      selected={isSelected}
      style={focusedStyle}
      {...innerProps}
    >
      {children}
    </MenuItem>
  );
}

function handleMenuOpen(
  menuTransition,
  setMenuIsOpenTransition,
  setMenuIsOpen,
  onOpen,
) {
  const allowTransition = menuTransition;

  return () => {
    allowTransition.current = true;
    setMenuIsOpenTransition(true);
    setMenuIsOpen(true);
    if (onOpen) {
      onOpen();
    }
  };
}

function handleMenuClose(
  menuTransition,
  setMenuIsOpenTransition,
  setMenuIsOpen,
  onClose,
) {
  const allowTransition = menuTransition;

  return () => {
    allowTransition.current = true;
    document.activeElement.blur();
    setMenuIsOpenTransition(false);
    setTimeout(() => setMenuIsOpen(false), transitionDuration);

    if (onClose) {
      onClose();
    }
  };
}

const reposition = {};
/**
 * updates textfield location on scroll/resize
 * re-renders menu if open which updates menu placement and max height
 */
function handleReposition(
  eventType,
  inputId,
  menuTransition,
  setTextFieldDOMRect,
  textRef,
) {
  reposition[`${inputId}${eventType}`] = () => {
    clearTimeout(window[`${inputId}Timeout`]);
    window[`${inputId}Timeout`] = setTimeout(
      () => {
        menuTransition.current = false;
        setTextFieldDOMRect(textRef.current.getBoundingClientRect());
      },
      eventType === 'scroll' ? scrollHandlerDelay : 0,
    );
  };

  return reposition[`${inputId}${eventType}`];
}

function filterValue(value) {
  return option => option.value === value;
}

export default function ReactSelect(props) {
  const classes = useStyles();
  const labelRef = useRef();
  const menuRef = useRef();
  const selectRef = useRef();
  const textRef = useRef();
  const focusedOptionRef = useRef();
  const [menuIsOpen, setMenuIsOpen] = useState(false);
  // similar to menuIsOpen, but triggers transition immediately while actual menu close is on timeout
  const [menuIsOpenTransition, setMenuIsOpenTransition] = useState(false);
  const menuPlacementTop = useRef(false);
  // determines whether transitionDuration is used. Set to false on resize/scroll
  const menuTransition = useRef(true);
  // contains position and dimensions of textfield
  const [textFieldDOMRect, setTextFieldDOMRect] = useState({});
  const [inputMinWidth, setInputMinWidth] = useState(0);
  const replacedComponents = {
    Control,
    ValueContainer,
    Input,
    Placeholder,
    SingleValue,
    IndicatorSeparator: null,
    DropdownIndicator,
    Menu,
    MenuList,
    Option,
  };

  useEffect(() => {
    const inputEl = document.getElementById(props.inputId);
    window.addEventListener(
      'scroll',
      handleReposition(
        'Scroll',
        props.inputId,
        menuTransition,
        setTextFieldDOMRect,
        textRef,
      ),
    );
    window.addEventListener(
      'resize',
      handleReposition(
        'Resize',
        props.inputId,
        menuTransition,
        setTextFieldDOMRect,
        textRef,
      ),
    );
    inputEl.addEventListener(
      'focus',
      handleReposition(
        'Focus',
        props.inputId,
        menuTransition,
        setTextFieldDOMRect,
        textRef,
      ),
    );

    return () => {
      window.removeEventListener(
        'scroll',
        reposition[`${props.inputId}Scroll`],
      );
      window.removeEventListener(
        'resize',
        reposition[`${props.inputId}Resize`],
      );
      inputEl.removeEventListener('focus', reposition[`${props.inputId}Focus`]);
    };
  }, [props.inputId, setTextFieldDOMRect]);

  return (
    <Select
      // react-select/react props
      components={replacedComponents}
      menuIsOpen={menuIsOpen}
      onMenuOpen={handleMenuOpen(
        menuTransition,
        setMenuIsOpenTransition,
        setMenuIsOpen,
        props.onOpen,
      )}
      onMenuClose={handleMenuClose(
        menuTransition,
        setMenuIsOpenTransition,
        setMenuIsOpen,
        props.onClose,
      )}
      ref={selectRef}
      styles={selectStyles}
      {...props}
      value={props.options.filter(filterValue(props.value))}
      // other props accessed via selectProps object of child props
      focusedOptionRef={focusedOptionRef}
      labelRef={labelRef}
      menuRef={menuRef}
      selectRef={selectRef}
      textRef={textRef}
      classes={classes}
      inputMinWidth={inputMinWidth}
      menuIsOpenTransition={menuIsOpenTransition}
      menuPlacementTop={menuPlacementTop}
      menuTransition={menuTransition}
      setInputMinWidth={setInputMinWidth}
      setMenuIsOpen={setMenuIsOpen}
      setTextFieldDOMRect={setTextFieldDOMRect}
      textFieldDOMRect={textFieldDOMRect}
    />
  );
}
