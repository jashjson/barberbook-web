# Calculator Easter Egg 🔢

## What is this?

A fully functional calculator has been added to the login page. Why? Because why not! 🤷

## Features

- ✅ Basic arithmetic operations (+, -, ×, ÷)
- ✅ Decimal support
- ✅ Clear and backspace functions
- ✅ Clean, modern UI matching the app theme
- ✅ Floating action button (bottom-right corner)
- ✅ Modal popup calculator
- ✅ Smooth animations

## How to Use

1. Go to the login page (`/login`)
2. Look for the floating 🔢 button in the bottom-right corner
3. Click it to open the calculator
4. Perform your calculations
5. Close when done

## Implementation Details

### Location
- **File:** `src/pages/auth/AuthPages.jsx`
- **Component:** `Calculator`
- **Trigger:** Floating button on `LoginPage`

### Calculator Features

**Buttons:**
```
C   ⌫   ÷
7   8   9   ×
4   5   6   -
1   2   3   +
0   .   =
```

**Operations:**
- `C` - Clear all
- `⌫` - Backspace (delete last digit)
- `÷` - Division
- `×` - Multiplication
- `-` - Subtraction
- `+` - Addition
- `=` - Calculate result
- `.` - Decimal point
- `0-9` - Number input

### Code Structure

```javascript
// Calculator state
const [display, setDisplay] = useState('0')
const [prevValue, setPrevValue] = useState(null)
const [operation, setOperation] = useState(null)
const [newNumber, setNewNumber] = useState(true)

// Operations
handleNumber(num)      // Input numbers
handleDecimal()        // Add decimal point
handleOperation(op)    // Set operation (+, -, ×, ÷)
handleEquals()         // Calculate result
handleClear()          // Clear all
handleBackspace()      // Delete last digit
```

### Styling

- Matches app's dark theme
- Gold accent color for operations
- Smooth hover effects
- Responsive button grid
- Monospace font for display

## Why?

Sometimes you need to calculate something while logging in. Or maybe you're just bored waiting for your password manager to autofill. Either way, now you have a calculator! 🎉

## Technical Notes

- **No dependencies** - Pure React implementation
- **No external libraries** - All calculations done in JavaScript
- **Lightweight** - Adds minimal bundle size
- **Isolated** - Doesn't affect any other functionality
- **Fun** - Because software should be enjoyable!

## Future Enhancements (if we're feeling crazy)

- [ ] Scientific calculator mode
- [ ] History of calculations
- [ ] Keyboard shortcuts
- [ ] Copy result to clipboard
- [ ] Theme customization
- [ ] Sound effects (please no)

## Removal

If you want to remove this feature (party pooper!):

1. Open `src/pages/auth/AuthPages.jsx`
2. Remove the `Calculator` component
3. Remove the `showCalc` state from `LoginPage`
4. Remove the floating button
5. Remove the calculator modal

Or just leave it. It's harmless and fun! 😊

---

**Added:** 2024
**Reason:** Because we can
**Status:** Working perfectly
**Usefulness:** Questionable but delightful
