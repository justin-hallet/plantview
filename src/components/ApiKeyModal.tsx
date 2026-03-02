import { useState } from "react";

interface ApiKeyModalProps {
  currentKeyHint: string | null; // masked key like "sk-or-...7f2a", or null if none
  onSave: (key: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ApiKeyModal({ currentKeyHint, onSave, onDelete, onClose }: ApiKeyModalProps) {
  const [inputValue, setInputValue] = useState("");
  const hasExistingKey = currentKeyHint !== null;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed) {
      onSave(trimmed);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">OpenRouter API Key</h2>
        <p className="text-sm text-gray-500 mb-4">
          Your key is stored locally in this browser and never sent to any server other than OpenRouter.
        </p>

        {hasExistingKey && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
            <code className="text-sm text-gray-600">{currentKeyHint}</code>
            <button
              type="button"
              onClick={onDelete}
              className="text-sm text-red-600 hover:text-red-800 font-medium ml-3"
            >
              Delete
            </button>
          </div>
        )}

        <form onSubmit={handleSave}>
          <input
            type="password"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={hasExistingKey ? "Enter new key to replace..." : "Enter your OpenRouter API key..."}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
