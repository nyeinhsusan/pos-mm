/**
 * Command Palette Component
 *
 * A searchable command palette for quick actions and navigation.
 * Activated with Ctrl+K (Cmd+K on Mac).
 *
 * Features:
 * - Fuzzy search through all commands
 * - Keyboard navigation (up/down arrows)
 * - Recent commands at top
 * - Categorized commands (Navigation, Actions, Products)
 * - Visual shortcut indicators
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CommandPalette = ({ isOpen, onClose, onNavigate, onAction }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState([]);
  const searchInputRef = useRef(null);

  // Define all available commands
  const allCommands = [
    // Navigation
    { id: 'nav-pos', label: 'Go to POS', category: 'Navigation', shortcut: 'Ctrl+1', action: () => navigate('/pos') },
    { id: 'nav-products', label: 'Go to Products', category: 'Navigation', shortcut: 'Ctrl+2', action: () => navigate('/products') },
    ...(user?.role === 'owner' ? [
      { id: 'nav-reports', label: 'Go to Reports', category: 'Navigation', shortcut: 'Ctrl+3', action: () => navigate('/reports') },
      { id: 'nav-ai', label: 'Go to AI Insights', category: 'Navigation', shortcut: 'Ctrl+4', action: () => navigate('/ai-insights') },
    ] : []),

    // Actions
    { id: 'action-logout', label: 'Logout', category: 'Actions', shortcut: 'Ctrl+L', action: () => { logout(); navigate('/login'); } },
    { id: 'action-help', label: 'Show Keyboard Shortcuts', category: 'Actions', shortcut: 'Ctrl+H', action: () => onAction('help') },
    { id: 'action-search', label: 'Focus Search', category: 'Actions', shortcut: 'Ctrl+F', action: () => onAction('focusSearch') },
  ];

  // Load recent commands from localStorage
  useEffect(() => {
    const recent = JSON.parse(localStorage.getItem('pos-recent-commands') || '[]');
    setRecentCommands(recent);
  }, []);

  // Focus search input when palette opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Filter commands based on search
  const filteredCommands = search
    ? allCommands.filter(cmd =>
        cmd.label.toLowerCase().includes(search.toLowerCase()) ||
        cmd.category.toLowerCase().includes(search.toLowerCase())
      )
    : allCommands;

  // Get recent command objects
  const recentCommandObjects = recentCommands
    .map(id => allCommands.find(cmd => cmd.id === id))
    .filter(Boolean)
    .slice(0, 3);

  // Commands to display: recent first, then filtered
  const displayCommands = search
    ? filteredCommands
    : [
        ...recentCommandObjects,
        ...allCommands.filter(cmd => !recentCommands.includes(cmd.id))
      ];

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % displayCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + displayCommands.length) % displayCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(displayCommands[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Execute selected command
  const executeCommand = (command) => {
    if (!command) return;

    // Save to recent commands
    const updatedRecent = [
      command.id,
      ...recentCommands.filter(id => id !== command.id)
    ].slice(0, 5);
    setRecentCommands(updatedRecent);
    localStorage.setItem('pos-recent-commands', JSON.stringify(updatedRecent));

    // Execute action
    command.action();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 fade-in"
        onClick={onClose}
      />

      {/* Command Palette */}
      <div className="fixed top-20 left-1/2 transform -translate-x-1/2 w-full max-w-2xl z-50 fade-in-up">
        <div className="bg-elevated rounded-lg shadow-2xl border border-default overflow-hidden">
          {/* Search Input */}
          <div className="p-4 border-b border-default">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="🔍 Type a command or search..."
              className="w-full px-4 py-3 bg-transparent text-primary text-lg focus:outline-none placeholder:text-muted"
            />
          </div>

          {/* Commands List */}
          <div className="max-h-96 overflow-y-auto">
            {displayCommands.length === 0 ? (
              <div className="p-8 text-center text-muted">
                No commands found
              </div>
            ) : (
              <div className="py-2">
                {!search && recentCommandObjects.length > 0 && (
                  <div className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider">
                    Recent
                  </div>
                )}

                {displayCommands.map((command, index) => {
                  const isRecent = !search && recentCommands.includes(command.id) && index < recentCommandObjects.length;
                  const showCategoryHeader = !search && index === recentCommandObjects.length;

                  return (
                    <div key={command.id}>
                      {showCategoryHeader && (
                        <div className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider mt-2">
                          All Commands
                        </div>
                      )}

                      <button
                        onClick={() => executeCommand(command)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`w-full px-4 py-3 flex items-center justify-between transition-colors focus:outline-none ${
                          index === selectedIndex
                            ? 'bg-section'
                            : 'hover:bg-section'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          {isRecent && (
                            <span className="text-muted">🕐</span>
                          )}
                          <div className="text-left">
                            <div className="text-sm font-medium text-primary">
                              {command.label}
                            </div>
                            <div className="text-xs text-muted">
                              {command.category}
                            </div>
                          </div>
                        </div>

                        {command.shortcut && (
                          <kbd className="px-2 py-1 text-xs font-semibold text-muted bg-section border border-default rounded">
                            {command.shortcut}
                          </kbd>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-section border-t border-default flex items-center justify-between text-xs text-muted">
            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-1">
                <kbd className="px-1.5 py-0.5 bg-elevated border border-default rounded">↑↓</kbd>
                <span>Navigate</span>
              </span>
              <span className="flex items-center space-x-1">
                <kbd className="px-1.5 py-0.5 bg-elevated border border-default rounded">↵</kbd>
                <span>Select</span>
              </span>
              <span className="flex items-center space-x-1">
                <kbd className="px-1.5 py-0.5 bg-elevated border border-default rounded">Esc</kbd>
                <span>Close</span>
              </span>
            </div>
            <div>
              Press <kbd className="px-1.5 py-0.5 bg-elevated border border-default rounded">Ctrl+H</kbd> for all shortcuts
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CommandPalette;
