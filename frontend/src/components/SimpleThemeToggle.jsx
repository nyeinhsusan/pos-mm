import { useState } from 'react';

export default function SimpleThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  const handleClick = () => {
    console.log('BUTTON CLICKED!');
    setIsDark(!isDark);

    const html = document.documentElement;
    if (isDark) {
      html.classList.remove('dark');
      html.classList.add('light');
      console.log('Switched to LIGHT');
    } else {
      html.classList.remove('light');
      html.classList.add('dark');
      console.log('Switched to DARK');
    }
  };

  return (
    <button
      onClick={handleClick}
      style={{
        position: 'fixed',
        top: '100px',
        right: '20px',
        zIndex: 9999,
        padding: '12px 24px',
        backgroundColor: 'red',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: 'pointer'
      }}
    >
      TEST TOGGLE {isDark ? 'DARK' : 'LIGHT'}
    </button>
  );
}
