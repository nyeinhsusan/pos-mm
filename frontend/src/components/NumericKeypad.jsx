import React from 'react';

const NumericKeypad = ({ onNumberClick, onClear, onBackspace }) => {
  const buttons = [
    '7', '8', '9',
    '4', '5', '6',
    '1', '2', '3',
    '00', '0', '⌫'
  ];

  const handleClick = (value) => {
    if (value === '⌫') {
      onBackspace();
    } else {
      onNumberClick(value);
    }
  };

  return (
    <div className="w-full">
      {/* Keypad Grid */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {buttons.map((btn, index) => (
          <button
            key={index}
            onClick={() => handleClick(btn)}
            className={`
              h-14 rounded-lg font-bold text-xl
              transition-all duration-150
              ${btn === '⌫'
                ? 'bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white'
              }
              active:scale-95
              shadow-sm hover:shadow-md
            `}
          >
            {btn}
          </button>
        ))}
      </div>

      {/* Clear Button */}
      <button
        onClick={onClear}
        className="w-full h-12 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50
                   text-orange-700 dark:text-orange-300 rounded-lg font-semibold text-lg
                   transition-all duration-150 active:scale-95 shadow-sm hover:shadow-md"
      >
        Clear
      </button>
    </div>
  );
};

export default NumericKeypad;
