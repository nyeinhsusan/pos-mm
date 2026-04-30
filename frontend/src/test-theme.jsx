// Quick Theme Test Component
// Import this in POSPage.jsx temporarily to test

export default function ThemeTest() {
  const toggleTest = () => {
    const html = document.documentElement;
    const hasDark = html.classList.contains('dark');

    if (hasDark) {
      html.classList.remove('dark');
      console.log('Removed dark class');
    } else {
      html.classList.add('dark');
      console.log('Added dark class');
    }

    console.log('HTML classes:', html.className);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 p-4 bg-red-500 text-white rounded shadow">
      <div className="mb-2">Theme Test Component</div>
      <button
        onClick={toggleTest}
        className="px-4 py-2 bg-white text-black rounded"
      >
        Toggle Dark Class
      </button>
      <div className="mt-2 text-xs">
        <div className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
          This should change color
        </div>
      </div>
    </div>
  );
}
