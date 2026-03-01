import { useState, useRef } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  onFileSelected: (file: File) => void;
  onExport?: () => void;
  isLoading: boolean;
  showExport?: boolean;
}

export function SearchBar({ onSearch, onFileSelected, onExport, isLoading, showExport }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) onSearch(trimmed);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xl mx-auto">
      <div className="flex-1 flex items-center border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent bg-white">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="px-3 py-3 text-gray-400 hover:text-green-600 disabled:opacity-50 transition-colors"
          title="Upload CSV, PDF, or text file"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clipRule="evenodd" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.pdf,.txt,.text"
          onChange={handleFileChange}
          className="hidden"
          disabled={isLoading}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='e.g. "Monstera deliciosa 15cm pot"'
          className="flex-1 px-2 py-3 focus:outline-none text-lg bg-transparent"
          disabled={isLoading}
        />
      </div>
      <button
        type="submit"
        disabled={isLoading || !query.trim()}
        className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Looking up..." : "Go"}
      </button>
      {showExport && (
        <button
          type="button"
          onClick={onExport}
          className="no-print px-4 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
        >
          Export PDF
        </button>
      )}
    </form>
  );
}
