// filepath: src/ui/components/commerce/SearchBar.tsx
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
interface SearchBarProps { placeholder?: string; className?: string; onSearch?: (query: string) => void; showSuggestions?: boolean; }
export function SearchBar({ placeholder = "Search artworks, categories, or artists...", className = "", onSearch, showSuggestions = true }: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestionsList, setShowSuggestionsList] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showSuggestions || query.length < 2) { setSuggestions([]); setShowSuggestionsList(false); return; }
    const timeoutId = setTimeout(async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}&limit=5`);
        const data = await response.json();
        if (data.success) { setSuggestions(data.suggestions); setShowSuggestionsList(data.suggestions.length > 0); }
      } catch (error) { console.error('Error fetching suggestions:', error); } finally { setIsLoading(false); }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [query, showSuggestions]);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) && !searchInputRef.current?.contains(event.target as Node)) {
        setShowSuggestionsList(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); performSearch(query); };
  const performSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return; setShowSuggestionsList(false);
    if (onSearch) { onSearch(searchQuery); }
    else { const params = new URLSearchParams(searchParams); params.set('q', searchQuery); params.delete('page'); router.push(`/shop?${params.toString()}`); }
  };
  const handleSuggestionClick = (suggestion: string) => { setQuery(suggestion); performSearch(suggestion); };
  const clearSearch = () => { setQuery(''); setSuggestions([]); setShowSuggestionsList(false); searchInputRef.current?.focus(); };
  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input ref={searchInputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => suggestions.length > 0 && setShowSuggestionsList(true)} placeholder={placeholder} className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500" />
          {query && (
            <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
      {showSuggestionsList && (
        <div ref={suggestionsRef} className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mx-auto"></div>
            </div>
          ) : (
            suggestions.map((suggestion, index) => (
              <button key={index} onClick={() => handleSuggestionClick(suggestion)} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 border-b border-gray-100 last:border-b-0">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-900">{suggestion}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
export default SearchBar;
