import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getCacheStats, clearCache, cleanExpiredCache } from "../utils/cacheDecorator";

interface CacheStatsData {
  count: number;
  totalSize: number;
  oldestEntry?: Date;
  newestEntry?: Date;
  expiredCount: number;
}

interface PrefixStats {
  [prefix: string]: CacheStatsData;
}

const CacheStatistics: React.FC = () => {
  const [globalStats, setGlobalStats] = useState<CacheStatsData>({ count: 0, totalSize: 0, expiredCount: 0 });
  const [prefixStats, setPrefixStats] = useState<PrefixStats>({});
  const [refreshInterval, setRefreshInterval] = useState<number>(5000); // 5 seconds default
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Known cache prefixes from our implementation
  const knownPrefixes = useMemo(() => ['gifts', 'getGiftAttachments', 'lists', 'queries', 'getConstituent'], []);

  const updateStats = useCallback(async () => {
    try {
      // Get global stats
      const stats = await getCacheStats();
      setGlobalStats(stats);

      // Get stats for each known prefix
      const prefixData: PrefixStats = {};
      for (const prefix of knownPrefixes) {
        prefixData[prefix] = await getCacheStats(prefix);
      }
      setPrefixStats(prefixData);
    } catch (error) {
      console.error('Failed to update cache stats:', error);
    }
  }, [knownPrefixes]);

  useEffect(() => {
    updateStats();

    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(updateStats, refreshInterval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval, updateStats]);

  const handleClearCache = async (prefix?: string) => {
    try {
      const clearedCount = await clearCache(prefix);
      alert(`Cleared ${clearedCount} cache entries${prefix ? ` with prefix "${prefix}"` : ''}`);
      await updateStats();
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert('Failed to clear cache');
    }
  };

  const handleCleanExpired = async (prefix?: string) => {
    try {
      const cleanedCount = await cleanExpiredCache(prefix);
      alert(`Cleaned ${cleanedCount} expired cache entries${prefix ? ` with prefix "${prefix}"` : ''}`);
      await updateStats();
    } catch (error) {
      console.error('Failed to clean expired cache:', error);
      alert('Failed to clean expired cache');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date?: Date): string => {
    return date ? date.toLocaleString() : 'N/A';
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: "1200px",
    margin: "20px auto",
    padding: "20px",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: "10px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: "#f8f9fa",
    padding: "20px",
    borderRadius: "8px",
    marginBottom: "20px",
    border: "1px solid #dee2e6",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "8px 16px",
    margin: "0 5px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: "#007bff",
    color: "white",
  };

  const dangerButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: "#dc3545",
    color: "white",
  };

  const warningButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: "#ffc107",
    color: "black",
  };

  const tableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "15px",
  };

  const thStyle: React.CSSProperties = {
    backgroundColor: "#e9ecef",
    padding: "12px",
    textAlign: "left",
    borderBottom: "2px solid #dee2e6",
    fontWeight: "bold",
  };

  const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderBottom: "1px solid #dee2e6",
  };

  return (
    <div style={containerStyle}>
      <h2>📊 Cache Decorator Statistics</h2>
      <p>Monitor and manage cache performance for API results stored in IndexedDB</p>

      {/* Controls */}
      <div style={cardStyle}>
        <h4>🛠️ Controls</h4>
        <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "15px" }}>
          <label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ marginRight: "8px" }}
            />
            Auto-refresh every
          </label>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            disabled={!autoRefresh}
            style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #ced4da" }}
          >
            <option value={1000}>1 second</option>
            <option value={5000}>5 seconds</option>
            <option value={10000}>10 seconds</option>
            <option value={30000}>30 seconds</option>
          </select>
          <button style={primaryButtonStyle} onClick={updateStats}>
            🔄 Refresh Now
          </button>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button style={dangerButtonStyle} onClick={() => handleClearCache()}>
            🗑️ Clear All Cache
          </button>
          <button style={warningButtonStyle} onClick={() => handleCleanExpired()}>
            🧹 Clean Expired
          </button>
        </div>
      </div>

      {/* Global Statistics */}
      <div style={cardStyle}>
        <h4>🌍 Global Cache Statistics</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
          <div>
            <h5>📈 Total Entries</h5>
            <p style={{ fontSize: "24px", fontWeight: "bold", color: "#007bff", margin: "5px 0" }}>
              {globalStats.count.toLocaleString()}
            </p>
          </div>
          <div>
            <h5>💾 Total Size</h5>
            <p style={{ fontSize: "24px", fontWeight: "bold", color: "#28a745", margin: "5px 0" }}>
              {formatBytes(globalStats.totalSize)}
            </p>
          </div>
          <div>
            <h5>⚠️ Expired Entries</h5>
            <p style={{ fontSize: "24px", fontWeight: "bold", color: "#dc3545", margin: "5px 0" }}>
              {globalStats.expiredCount.toLocaleString()}
            </p>
          </div>
          <div>
            <h5>⏰ Cache Age Range</h5>
            <p style={{ fontSize: "12px", margin: "5px 0" }}>
              <strong>Oldest:</strong> {formatDate(globalStats.oldestEntry)}<br />
              <strong>Newest:</strong> {formatDate(globalStats.newestEntry)}
            </p>
          </div>
        </div>
      </div>

      {/* Per-Prefix Statistics */}
      <div style={cardStyle}>
        <h4>🏷️ Cache Statistics by Prefix</h4>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Prefix</th>
              <th style={thStyle}>Entries</th>
              <th style={thStyle}>Size</th>
              <th style={thStyle}>Expired</th>
              <th style={thStyle}>Oldest Entry</th>
              <th style={thStyle}>Newest Entry</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {knownPrefixes.map(prefix => {
              const stats = prefixStats[prefix] || { count: 0, totalSize: 0, expiredCount: 0 };
              return (
                <tr key={prefix}>
                  <td style={tdStyle}>
                    <strong>{prefix}</strong>
                  </td>
                  <td style={tdStyle}>{stats.count.toLocaleString()}</td>
                  <td style={tdStyle}>{formatBytes(stats.totalSize)}</td>
                  <td style={tdStyle}>
                    <span style={{ color: stats.expiredCount > 0 ? "#dc3545" : "#28a745" }}>
                      {stats.expiredCount.toLocaleString()}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <small>{formatDate(stats.oldestEntry)}</small>
                  </td>
                  <td style={tdStyle}>
                    <small>{formatDate(stats.newestEntry)}</small>
                  </td>
                  <td style={tdStyle}>
                    <button
                      style={{ ...buttonStyle, backgroundColor: "#6c757d", color: "white", fontSize: "12px" }}
                      onClick={() => handleClearCache(prefix)}
                      disabled={stats.count === 0}
                    >
                      Clear
                    </button>
                    <button
                      style={{ ...buttonStyle, backgroundColor: "#fd7e14", color: "white", fontSize: "12px" }}
                      onClick={() => handleCleanExpired(prefix)}
                      disabled={stats.expiredCount === 0}
                    >
                      Clean
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cache Health Indicators */}
      <div style={cardStyle}>
        <h4>🩺 Cache Health</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" }}>
          <div>
            <h5>📊 Hit Rate Estimation</h5>
            <div style={{
              padding: "10px",
              borderRadius: "4px",
              backgroundColor: globalStats.count > 0 ? "#d4edda" : "#f8d7da",
              border: globalStats.count > 0 ? "1px solid #c3e6cb" : "1px solid #f5c6cb"
            }}>
              <p style={{ margin: 0 }}>
                {globalStats.count > 0
                  ? `✅ Active caching with ${globalStats.count} entries`
                  : "❌ No cache entries found"
                }
              </p>
            </div>
          </div>

          <div>
            <h5>🗄️ Storage Efficiency</h5>
            <div style={{
              padding: "10px",
              borderRadius: "4px",
              backgroundColor: globalStats.totalSize < 1024 * 1024 ? "#d4edda" : "#fff3cd", // Green if < 1MB, yellow if larger
              border: globalStats.totalSize < 1024 * 1024 ? "1px solid #c3e6cb" : "1px solid #ffeaa7"
            }}>
              <p style={{ margin: 0 }}>
                {globalStats.totalSize < 1024 * 1024
                  ? `✅ Efficient storage usage`
                  : "⚠️ Consider cleaning old cache"
                }
              </p>
            </div>
          </div>

          <div>
            <h5>🧹 Cache Hygiene</h5>
            <div style={{
              padding: "10px",
              borderRadius: "4px",
              backgroundColor: globalStats.expiredCount === 0 ? "#d4edda" : "#f8d7da",
              border: globalStats.expiredCount === 0 ? "1px solid #c3e6cb" : "1px solid #f5c6cb"
            }}>
              <p style={{ margin: 0 }}>
                {globalStats.expiredCount === 0
                  ? "✅ No expired entries"
                  : `❌ ${globalStats.expiredCount} expired entries need cleaning`
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* API Endpoints with Caching */}
      <div style={cardStyle}>
        <h4>🔗 API Endpoints with Caching</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "15px" }}>
          <div style={{ padding: "15px", backgroundColor: "white", borderRadius: "4px", border: "1px solid #dee2e6" }}>
            <h6>🎁 Gifts API</h6>
            <p><strong>Cache Duration:</strong> 5 minutes</p>
            <p><strong>Entries:</strong> {prefixStats.gifts?.count || 0}</p>
            <p><strong>Size:</strong> {formatBytes(prefixStats.gifts?.totalSize || 0)}</p>
          </div>

          <div style={{ padding: "15px", backgroundColor: "white", borderRadius: "4px", border: "1px solid #dee2e6" }}>
            <h6>📎 Gift Attachments</h6>
            <p><strong>Cache Duration:</strong> 24 hours</p>
            <p><strong>Entries:</strong> {prefixStats.getGiftAttachments?.count || 0}</p>
            <p><strong>Size:</strong> {formatBytes(prefixStats.getGiftAttachments?.totalSize || 0)}</p>
          </div>

          <div style={{ padding: "15px", backgroundColor: "white", borderRadius: "4px", border: "1px solid #dee2e6" }}>
            <h6>📝 Lists API</h6>
            <p><strong>Cache Duration:</strong> 100 minutes</p>
            <p><strong>Entries:</strong> {prefixStats.lists?.count || 0}</p>
            <p><strong>Size:</strong> {formatBytes(prefixStats.lists?.totalSize || 0)}</p>
          </div>

          <div style={{ padding: "15px", backgroundColor: "white", borderRadius: "4px", border: "1px solid #dee2e6" }}>
            <h6>🔍 Queries API</h6>
            <p><strong>Cache Duration:</strong> 15 minutes</p>
            <p><strong>Entries:</strong> {prefixStats.queries?.count || 0}</p>
            <p><strong>Size:</strong> {formatBytes(prefixStats.queries?.totalSize || 0)}</p>
          </div>

          <div style={{ padding: "15px", backgroundColor: "white", borderRadius: "4px", border: "1px solid #dee2e6" }}>
            <h6>👤 Constituents API</h6>
            <p><strong>Cache Duration:</strong> 24 hours</p>
            <p><strong>Entries:</strong> {prefixStats.getConstituent?.count || 0}</p>
            <p><strong>Size:</strong> {formatBytes(prefixStats.getConstituent?.totalSize || 0)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CacheStatistics; 