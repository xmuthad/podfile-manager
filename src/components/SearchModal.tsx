interface SearchModalProps {
  show: boolean;
  searchQuery: string;
  isSearching: boolean;
  searchResults: string[];
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onResultClick: (path: string) => void;
  onClose: () => void;
}

export function SearchModal({
  show, searchQuery, isSearching, searchResults,
  onQueryChange, onSearch, onResultClick, onClose,
}: SearchModalProps) {
  if (!show) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🔍 文件搜索</h3>
          <button className="btn btn-small" onClick={onClose}>✕</button>
        </div>
        <div className="modal-content">
          <div className="search-input-container">
            <input
              type="text"
              className="search-input"
              placeholder="输入文件名搜索..."
              value={searchQuery}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            />
            <button className="btn btn-primary" onClick={onSearch}>搜索</button>
          </div>
          {isSearching && <div className="loading">搜索中...</div>}
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((result) => (
                <div
                  key={result}
                  className="search-result-item"
                  onClick={() => onResultClick(result)}
                >
                  📄 {result}
                </div>
              ))}
            </div>
          )}
          {searchQuery && !isSearching && searchResults.length === 0 && (
            <div className="empty-state">
              <p>未找到匹配的文件</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
