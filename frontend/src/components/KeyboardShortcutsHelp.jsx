/**
 * Keyboard Shortcuts Help Modal
 *
 * Displays all available keyboard shortcuts organized by category.
 * Activated with Ctrl+H (Cmd+H on Mac).
 *
 * Features:
 * - Categorized shortcuts (Navigation, Actions, POS, Cart)
 * - Visual keyboard key representations
 * - Dark mode support
 * - Responsive design
 */

import { useAuth } from '../context/AuthContext';

const KeyboardShortcutsHelp = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  if (!isOpen) return null;

  const shortcuts = [
    {
      category: 'Navigation',
      items: [
        { keys: ['Ctrl', '1'], description: 'Go to POS page' },
        { keys: ['Ctrl', '2'], description: 'Go to Products page' },
        ...(user?.role === 'owner' ? [
          { keys: ['Ctrl', '3'], description: 'Go to Reports page' },
          { keys: ['Ctrl', '4'], description: 'Go to AI Insights page' },
        ] : []),
      ]
    },
    {
      category: 'General Actions',
      items: [
        { keys: ['Ctrl', 'K'], description: 'Open command palette' },
        { keys: ['Ctrl', 'H'], description: 'Show this help dialog' },
        { keys: ['Ctrl', 'F'], description: 'Focus search input' },
        { keys: ['Ctrl', 'L'], description: 'Logout' },
        { keys: ['Esc'], description: 'Close modals / Clear cart' },
      ]
    },
    {
      category: 'POS Page - Quick Add',
      items: [
        { keys: ['F1'], description: 'Add #1 top product to cart' },
        { keys: ['F2'], description: 'Add #2 top product to cart' },
        { keys: ['F3'], description: 'Add #3 top product to cart' },
        { keys: ['F4'], description: 'Add #4 top product to cart' },
        { keys: ['F5'], description: 'Add #5 top product to cart' },
        { keys: ['F6'], description: 'Add #6 top product to cart' },
        { keys: ['F7'], description: 'Add #7 top product to cart' },
        { keys: ['F8'], description: 'Add #8 top product to cart' },
        { keys: ['F9'], description: 'Add #9 top product to cart' },
      ]
    },
    {
      category: 'Cart Management',
      items: [
        { keys: ['Enter'], description: 'Complete sale (when cart not empty)' },
        { keys: ['Backspace'], description: 'Remove last item from cart' },
        { keys: ['+'], description: 'Increase quantity of selected item' },
        { keys: ['-'], description: 'Decrease quantity of selected item' },
      ]
    },
  ];

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center fade-in"
        onClick={handleBackdropClick}
      >
        {/* Modal */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden fade-in-up">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              ⌨️ Keyboard Shortcuts
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)]">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Use these keyboard shortcuts to navigate and perform actions faster.
            </p>

            {/* Shortcuts Grid */}
            <div className="space-y-6">
              {shortcuts.map((section, sectionIndex) => (
                <div key={sectionIndex}>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                    {section.category}
                  </h3>
                  <div className="space-y-2">
                    {section.items.map((shortcut, itemIndex) => (
                      <div
                        key={itemIndex}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {shortcut.description}
                        </span>
                        <div className="flex items-center space-x-1">
                          {shortcut.keys.map((key, keyIndex) => (
                            <span key={keyIndex} className="flex items-center">
                              <kbd className="px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">
                                {key}
                              </kbd>
                              {keyIndex < shortcut.keys.length - 1 && (
                                <span className="mx-1 text-gray-400">+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Tip */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>💡 Pro Tip:</strong> Press <kbd className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded text-xs">Ctrl+K</kbd> to open the command palette for quick access to all actions.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default KeyboardShortcutsHelp;
